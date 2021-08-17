import logging
import json
from django.http import JsonResponse
from django.http import HttpResponseNotFound
from django.conf import settings
from django.utils.module_loading import import_string
from django.views import View
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404
from .models import CustomDatetimeJSONEncoder
from .models import CalculationError


logger = logging.getLogger(__name__)


def dict_from_model_class(model_class):
    return {
        'verbose_name': model_class._meta.verbose_name,
        'id': model_class.__name__.lower(),
        'description': model_class.get_description(),
        'icon_path': model_class.get_icon_path()
    }


def dict_from_model_instance(model_instance):
    res = dict_from_model_class(type(model_instance))
    res['input_data'] = model_instance.input_data
    res['output_data'] = model_instance.output_data
    return res


grouped_models_dict = {}
models_classes_dict = {}


for key, classes_list in settings.MATH_MODELS_AVAILABLE.items():
    for class_path in classes_list:
        try:
            cls = import_string(class_path)
            if key not in grouped_models_dict:
                grouped_models_dict[key] = []

            res = dict_from_model_class(cls)
            grouped_models_dict[key].append(res)
            models_classes_dict[res['id']] = cls
        except ImportError:
            logger.warning(
                'Unable to load class "{}" defined in settings.MATH_MODELS_AVAILABLE'.format(class_path))


class LoginRequiredTemplateView(LoginRequiredMixin, TemplateView):
    pass


class UnicodeJsonResponse(JsonResponse):

    def __init__(self, *args, **kwargs):
        super(UnicodeJsonResponse, self).__init__(*args, encoder=CustomDatetimeJSONEncoder, json_dumps_params={'ensure_ascii': False}, **kwargs)
        # super(UnicodeJsonResponse, self).__init__(*args, json_dumps_params={'ensure_ascii': False}, **kwargs)


class MathModelAPIView(LoginRequiredMixin, View):
    """
    REST JSON API for MathModel
    """
    def get(self, request, **kwargs):
        requested_model_id = kwargs.get('model_id')
        if not requested_model_id:
            return UnicodeJsonResponse(grouped_models_dict)
        else:
            cls = models_classes_dict.get(requested_model_id)
            if not cls:
                return HttpResponseNotFound()

            model_instance, created_flag = cls.objects.get_or_create(user=request.user)
            return UnicodeJsonResponse(dict_from_model_instance(model_instance))

    def put(self, request, **kwargs):
        requested_model_id = kwargs.get('model_id')
        cls = models_classes_dict.get(requested_model_id)
        if not cls:
            logger.warning('Unable to put data into non existing "{}" API endpoint'.format(requested_model_id))
            return HttpResponseNotFound()

        request_data = json.loads(request.body.decode("utf-8"))

        model_instance = get_object_or_404(cls, user=request.user)
        model_instance.input_data = request_data
        try:
            model_instance.calculate()
            model_instance.save()
            return UnicodeJsonResponse(model_instance.output_data)

        except CalculationError as e:
            error_text = str(e)
            logger.warning('Calculation error for model "{}". Reason "{}"'.format(requested_model_id, error_text))
            return UnicodeJsonResponse({'bad_request_reason': error_text}, status=400)
