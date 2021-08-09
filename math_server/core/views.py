from django.shortcuts import render
import logging
from django.http import HttpResponse, JsonResponse
from django.conf import settings
from django.utils.module_loading import import_string
from django.views import View


logger = logging.getLogger(__name__)


grouped_models_dict = {}
models_classes_dict = {}

for key, classes_list in settings.MATH_MODELS_AVAILABLE.items():
    for class_path in classes_list:
        try:
            cls = import_string(class_path)
            if key not in grouped_models_dict:
                grouped_models_dict[key] = []

            res = {
                'verbose_name': cls._meta.verbose_name,
                'id': cls.__name__.lower(),
                'description': cls.get_description(),
                'icon_path': cls.get_icon_path()
            }
            grouped_models_dict[key].append(res)
            models_classes_dict[res['id']] = cls
        except ImportError:
            logger.warning(
                'Unable to load class "{}" defined in settings.MATH_MODELS_AVAILABLE'.format(class_path))


class MathModelAPIView(View):
    """
    REST JSON API for MathModel
    """

    def get(self, *args, **kwargs):
        requested_model_id = kwargs.get('model_id')
        if not requested_model_id:
            return JsonResponse(grouped_models_dict, json_dumps_params={'ensure_ascii': False})
        else:
            pass
        return HttpResponse()
