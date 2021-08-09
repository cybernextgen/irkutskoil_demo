from django.db import models
from django.contrib.auth import get_user_model
from pathlib import Path


class BaseMathModel(models.Model):
    """
    Generic abstract math model
    """

    user = models.ForeignKey(get_user_model(), on_delete=models.CASCADE)

    input_data = models.JSONField(null=True)

    output_data = models.JSONField(null=True)

    def calculate(self):
        raise NotImplementedError

    @staticmethod
    def get_icon_path():
        return 'core/img/default_model_icon.png'

    @staticmethod
    def get_description():
        return 'Description not written yet'

    class Meta:
        abstract = True


class AsyncMathModel(BaseMathModel):
    """
    Async math models
    """
    is_ready = models.BooleanField(default=False)

    class Meta:
        abstract = True


class WellProductionModel(BaseMathModel):
    """
    Model predicts oil production
    """
    def calculate(self):
        pass

    @staticmethod
    def get_icon_path():
        return 'core/img/well.png'

    @staticmethod
    def get_description():
        return 'Модель позволяет прогнозировать добычу на основании таблицы “Отбор от НИЗ / Обводненность”.'

    class Meta:
        verbose_name = 'Прогнозирование добычи'


class SimpleCalculatorModel(BaseMathModel):
    """
    Model predicts oil production
    """
    def calculate(self):
        pass

    @staticmethod
    def get_icon_path():
        return 'core/img/CH.png'

    @staticmethod
    def get_description():
        return 'Простая модель, выполняющая арифметические операции с числами.'

    class Meta:
        verbose_name = 'Простой калькулятор'


class AsyncCalculatorModel(AsyncMathModel):
    """
    Model predicts oil production
    """
    def calculate(self):
        pass

    @staticmethod
    def get_icon_path():
        return 'core/img/oil1.png'

    @staticmethod
    def get_description():
        return 'Асинхронная модель, выполняющая арифметические операции с числами.'

    class Meta:
        verbose_name = 'Асинхронный калькулятор'
