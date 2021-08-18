import logging
import json
from django.http import JsonResponse
from django.http import HttpResponseNotFound
from django.http import HttpResponse
from django.conf import settings
from django.utils.module_loading import import_string
from django.views import View
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404
from .models import CustomDatetimeJSONEncoder
from .models import CalculationError
from .models import AsyncMathModel
from .models import Notification
from .tasks import async_task_handler
from django.core.serializers.json import DjangoJSONEncoder


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
    if hasattr(model_instance, 'is_ready'):
        res['is_ready'] = model_instance.is_ready
    if hasattr(model_instance, 'is_processing'):
        res['is_processing'] = model_instance.is_processing
    return res


grouped_models_dict = {}
models_classes_dict = {}
models_classes_path_dict = {}

for key, classes_list in settings.MATH_MODELS_AVAILABLE.items():
    for class_path in classes_list:
        try:
            cls = import_string(class_path)
            if key not in grouped_models_dict:
                grouped_models_dict[key] = []

            res = dict_from_model_class(cls)
            grouped_models_dict[key].append(res)
            models_classes_dict[res['id']] = cls
            models_classes_path_dict[res['id']] = class_path
        except ImportError:
            logger.warning(
                'Unable to load class "{}" defined in settings.MATH_MODELS_AVAILABLE'.format(class_path))


class LoginRequiredTemplateView(LoginRequiredMixin, TemplateView):
    pass


class UnicodeJsonResponse(JsonResponse):

    def __init__(self, *args, **kwargs):
        super(UnicodeJsonResponse, self).__init__(*args, encoder=DjangoJSONEncoder, safe=False, json_dumps_params={'ensure_ascii': False}, **kwargs)
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
        requested_model_external_id = kwargs.get('model_id')
        cls = models_classes_dict.get(requested_model_external_id)
        if not cls:
            logger.warning('Unable to put data into non existing "{}" API endpoint'.format(requested_model_external_id))
            return HttpResponseNotFound()

        request_data = json.loads(request.body.decode("utf-8"))

        model_instance = get_object_or_404(cls, user=request.user)
        model_instance.input_data = request_data

        if isinstance(model_instance, AsyncMathModel):
            model_instance.save()
            async_task_handler(cls_path=models_classes_path_dict.get(requested_model_external_id), internal_id=model_instance.pk)
            return HttpResponse()
        else:
            try:
                model_instance.calculate()
                model_instance.save()
                return UnicodeJsonResponse(model_instance.output_data)
            except CalculationError as e:
                error_text = str(e)
                logger.warning('Calculation error for model "{}". Reason "{}"'.format(requested_model_external_id, error_text))
                return UnicodeJsonResponse({'bad_request_reason': error_text}, status=400)


class NotificationAPIView(LoginRequiredMixin, View):
    """
    REST JSON API for Notification
    """
    is_only_new = False

    def get(self, request, **kwargs):
        requested_id = kwargs.get('id')
        if not requested_id:
            res = []
            notifications = Notification.objects.order_by('-created_timestamp').filter(user=request.user)
            if self.is_only_new:
                notifications = notifications.filter(is_acknowledged=False)

            requested_limit = kwargs.get('limit')
            if requested_limit:
                notifications = notifications[:requested_limit]

            for n in notifications:
                res.append({
                    'id': n.pk,
                    'math_model_id': n.math_model_id,
                    'created_timestamp': n.created_timestamp,
                    'is_success': n.is_success,
                    'description': n.description,
                    'is_acknowledged': n.is_acknowledged
                })
            return UnicodeJsonResponse(res)
        else:
            pass
