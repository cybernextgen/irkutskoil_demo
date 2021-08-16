from django.db import models
from django.contrib.auth import get_user_model
from pathlib import Path
from datetime import datetime
from datetime import date
from dateutil.relativedelta import relativedelta
from bisect import bisect_left
from decimal import Decimal
from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
import dateutil.parser


class CustomDatetimeJSONEncoder(DjangoJSONEncoder):
    """
    Same as DjangoJSONEncoder, but datetime serialized using settings.CUSTOM_DATETIME_FORMAT format string
    """
    def default(self, o):
        if isinstance(o, datetime):
            r = o.strftime(settings.CUSTOM_DATETIME_FORMAT)
            return r
        elif isinstance(o, date):
            return o.strftime(settings.CUSTOM_DATETIME_FORMAT)

        return DjangoJSONEncoder.default(self, o)


class CalculationError(RuntimeError):
    pass


class BaseMathModel(models.Model):
    """
    Generic abstract math model
    """

    user = models.ForeignKey(get_user_model(), on_delete=models.CASCADE)

    input_data = models.JSONField(default=dict, encoder=CustomDatetimeJSONEncoder)

    output_data = models.JSONField(default=dict, encoder=CustomDatetimeJSONEncoder)

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


def take_closest_index(src_list, number):
    """
    Assumes myList is sorted. Returns closest value to myNumber.
    If two numbers are equally close, return the smallest number.
    """
    pos = bisect_left(src_list, number)
    if pos == 0:
        return pos
    if pos == len(src_list):
        return pos - 1

    after = src_list[pos]
    # if after - number < number - before:
    if after > number:
        return pos - 1
    else:
        return pos


class WellProductionModel(BaseMathModel):
    """
    Model predicts oil production
    """
    def calculate(self):
        if not self.input_data:
            raise CalculationError('Отсутствуют входные данные для алгоритма')

        niz_table = self.input_data.get('niz_table')
        if not niz_table:
            raise CalculationError('Не заполнена таблица “Отбор от НИЗ / Обводненность”')

        kin = self.input_data.get('kin')
        if not kin:
            raise CalculationError('Не указан КИН')
        kin = Decimal(kin)

        debit = self.input_data.get('debit')
        if not debit:
            raise CalculationError('Не указан дебит жидкости')
        debit = Decimal(debit)

        total = self.input_data.get('total')
        if not total:
            raise CalculationError('Не указана величина геологических запасов')
        total = Decimal(total)

        datetime_format = settings.CUSTOM_DATETIME_FORMAT
        production_table = []
        current_sum = 0
        niz = total * kin
        niz_search_column = [Decimal(row[1]) for row in niz_table]
        current_debit = 0

        for index, niz_row in enumerate(niz_table):
            current_date = dateutil.parser.isoparse(niz_row[0])
            if index < (len(niz_table) - 1):
                next_date = dateutil.parser.isoparse(niz_table[index + 1][0])
            else:
                next_date = current_date.replace(day=1) + relativedelta(months=1)

            days_in_month = (next_date - current_date).days
            month_sum = days_in_month * debit

            niz_current = current_sum / niz
            i = take_closest_index(niz_search_column, niz_current)

            delta = 1 - Decimal(niz_table[i][2])
            month_sum *= delta

            current_debit = month_sum / days_in_month

            current_sum += month_sum
            production_table.append([current_date, float(month_sum), float(current_debit)])

        self.output_data = {'production_table': production_table, 'niz': float(niz)}
        return self.output_data

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
