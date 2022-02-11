# coding: utf-8
import logging
from django.utils.module_loading import import_string
from django.core.exceptions import ObjectDoesNotExist
from .models import Notification
from .models import CalculationError
from django.conf import settings
import os


if settings.DEBUG:
    def spool(func):
        def func_wrapper(**arguments):
            return func(arguments)

        return func_wrapper
else:
    from uwsgidecorators import spool  # type: ignore


import django


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'math_server.settings')
django.setup()
logger = logging.getLogger(__name__)


@spool
def async_task_handler(args):
    """
    Spooler function
    :param args: input parameters, must contains cls_path and internal_id parameter, encoded as byte string for UWSGI
    spooler, and unicode instance for debug mode
    """
    cls_path = args.get('cls_path')
    model_internal_id = args.get('internal_id')
    cls = import_string(cls_path)
    try:
        instance = cls.objects.get(id=model_internal_id)
        try:
            instance.is_processing = True
            instance.is_ready = False
            instance.save()
            instance.calculate()
            instance.is_ready = True
            instance.is_processing = False
            instance.save()
            Notification.objects.create(
                user=instance.user,
                is_success=True,
                math_model_id=cls.__name__.lower(),
                description='{}: операция завершена успешно'.format(cls._meta.verbose_name)
            )
        except CalculationError as e:
            logger.warning('Calculation error in async model "{}" with id="{}" '.format(cls_path, model_internal_id))
            instance.is_processing = False
            instance.is_ready = False
            instance.save()
            Notification.objects.create(
                user=instance.user,
                is_success=False,
                math_model_id=cls.__name__.lower(),
                description='{}: ошибка. {}'.format(cls._meta.verbose_name, str(e))
            )
    except ObjectDoesNotExist:
        logger.warning('Async model "{}" with id="{}" does not exist'.format(cls_path, model_internal_id))
