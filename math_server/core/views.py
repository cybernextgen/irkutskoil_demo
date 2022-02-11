import logging
import json
from django.http import HttpResponseForbidden, JsonResponse
from django.http import HttpResponseNotFound
from django.http import HttpResponse
from django.conf import settings
from django.utils.module_loading import import_string
from django.views import View
from django.views.generic import TemplateView
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404
from .models import CalculationError
from .models import AsyncMathModel
from .models import Notification
from .models import NSIDataImportStatus
from .tasks import async_task_handler
from django.core.serializers.json import DjangoJSONEncoder
from .nsi_data_import import import_nsi_data_from_xml
from .nsi_data_import import ImportNSIDataError

logger = logging.getLogger(__name__)


def dict_from_model_class(model_class):
    """
    Returns dict of class fields for json serializing
    :param model_class: BaseMathModel ancestor
    :return: dict with class fields
    """
    return {
        'verbose_name': model_class._meta.verbose_name,
        'id': model_class.__name__.lower(),
        'description': model_class.get_description(),
        'icon_path': model_class.get_icon_path()
    }


def dict_from_model_instance(model_instance):
    """
    Returns dict of instance fields for json serializing
    :param model_instance:
    :return: dict with class and instance fields
    """
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
    """
    Base class for views, where login required is needed
    """
    pass


class UnicodeJsonResponse(JsonResponse):
    """
    JSON-response with non ASCII data
    """

    def __init__(self, *args, **kwargs):
        super(UnicodeJsonResponse, self).__init__(*args, encoder=DjangoJSONEncoder,
                                                  safe=False, json_dumps_params={'ensure_ascii': False}, **kwargs)


def prepare_spooler_args(**kwargs):
    """
    Encodes arguments to binary string fo using in uWSGI spooler
    :param kwargs:arguments to encoding
    :return: dict with encoded arguments
    """
    args = {}
    for name, value in kwargs.items():
        args[name.encode('utf-8')] = str(value).encode('utf-8')
    return args


class PermissionsAPIView(LoginRequiredMixin, View):
    """
    REST JSON API for current user permissions
    """

    def get(self, request, **kwargs):
        return UnicodeJsonResponse(list(request.user.get_all_permissions()))


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

            if not request.user.has_perm(f'core.view_{requested_model_id}'):
                return HttpResponseForbidden("Отсутствуют права доступа для просмотра данной модели!")

            model_instance, created_flag = cls.objects.get_or_create(user=request.user)
            return UnicodeJsonResponse(dict_from_model_instance(model_instance))

    def put(self, request, **kwargs):
        requested_model_external_id = kwargs.get('model_id')
        cls = models_classes_dict.get(requested_model_external_id)
        if not cls:
            logger.warning('Unable to put data into non existing "{}" API endpoint'.format(requested_model_external_id))
            return HttpResponseNotFound()

        if not request.user.has_perm(f'core.change_{requested_model_external_id}'):
            return HttpResponseForbidden("Отсутствуют права доступа для изменения данной модели!")

        request_data = json.loads(request.body.decode("utf-8"))

        model_instance = get_object_or_404(cls, user=request.user)
        model_instance.input_data = request_data

        if isinstance(model_instance, AsyncMathModel):
            model_instance.save()

            if settings.DEBUG:
                async_task_handler(cls_path=models_classes_path_dict.get(                   # type: ignore
                    requested_model_external_id), internal_id=model_instance.pk)            # type: ignore
            else:
                async_task_handler(prepare_spooler_args(cls_path=models_classes_path_dict.get(
                    requested_model_external_id), internal_id=model_instance.pk))
            return HttpResponse()
        else:
            try:
                model_instance.calculate()
                model_instance.save()
                return UnicodeJsonResponse(model_instance.output_data)
            except CalculationError as e:
                error_text = str(e)
                logger.warning('Calculation error for model "{}". Reason "{}"'.format(
                    requested_model_external_id, error_text))
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
            return HttpResponse()

    def put(self, request):
        request_data = json.loads(request.body.decode("utf-8"))
        if not request_data:
            return UnicodeJsonResponse({'bad_request_reason': 'Список уведомлений для квитирования пуст'}, status=400)
        Notification.objects.filter(pk__in=request_data).filter(user=request.user).update(is_acknowledged=True)
        return HttpResponse()


class NSIDataImportAPIView(LoginRequiredMixin, View):
    """
    REST API for NSI data import
    """

    def put(self, request, **kwargs):
        status = NSIDataImportStatus.objects.filter(is_pending=True).first()
        if not status:
            current_status = NSIDataImportStatus.objects.create(user=request.user)
            try:
                import_nsi_data_from_xml()
                Notification.objects.create(
                    user=request.user,
                    is_success=True,
                    description='Импорт данных НСИ: операция завершена успешно'
                )
            except ImportNSIDataError:
                Notification.objects.create(
                    user=request.user,
                    is_success=False,
                    description='Импорт данных НСИ: операция не выполнена!'
                )

            current_status.is_pending = False
            current_status.save()
            return HttpResponse(status=200)
        else:
            return UnicodeJsonResponse({'created_timestamp': status.created_timestamp,
                                        'user': status.user.get_full_name()}, status=202)

    def get(self, request, **kwargs):
        status = NSIDataImportStatus.objects.filter(is_pending=True).first()
        if not status:
            return HttpResponse()
        else:
            return UnicodeJsonResponse({'created_timestamp': status.created_timestamp,
                                        'user': status.user.get_full_name()}, status=202)


class NSIAPIView(LoginRequiredMixin, View):
    """
    REST-API for NSI objects
    """

    def put(self, request, **kwargs):
        print('worked')
