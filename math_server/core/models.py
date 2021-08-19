from django.db import models
from django.contrib.auth import get_user_model
from dateutil.relativedelta import relativedelta
from bisect import bisect_left
from decimal import Decimal
from django.core.serializers.json import DjangoJSONEncoder
import dateutil.parser
import time


class CalculationError(RuntimeError):
    """
    Trows from calculate() method of BaseMathModel
    """
    pass


class BaseMathModel(models.Model):
    """
    Generic abstract math model
    """

    user = models.ForeignKey(get_user_model(), on_delete=models.CASCADE)

    input_data = models.JSONField(default=dict, encoder=DjangoJSONEncoder)

    output_data = models.JSONField(default=dict, encoder=DjangoJSONEncoder)

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

    is_processing = models.BooleanField(default=False)

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

        production_table = []
        current_sum = 0
        niz = total * kin
        niz_search_column = [Decimal(row[1]) for row in niz_table]

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


class Calculator(object):
    """
    Basic calculator class for using in both sync and async math models
    """
    @staticmethod
    def get_operations():
        return {
            'add': lambda a, b: a + b,
            'sub': lambda a, b: a - b,
            'mul': lambda a, b: a * b,
            'div': lambda a, b: a / b if b > 0 else 0,
        }

    @staticmethod
    def calculate(input_data):
        if not input_data:
            raise CalculationError('Отсутствуют входные данные для алгоритма')

        val1 = input_data.get('val1')
        if val1 is None or val1 == '':
            raise CalculationError('Не указан опертор №1')
        val1 = Decimal(val1)

        val2 = input_data.get('val2')
        if val2 is None or val2 == '':
            raise CalculationError('Не указан опертор №2')
        val2 = Decimal(val2)

        requested_opeartion = Calculator.get_operations().get(input_data.get('op'))
        if not requested_opeartion:
            raise CalculationError('Не указана арифметическая операция, либо операция не поддерживается')
        return float(requested_opeartion(val1, val2))


class SimpleCalculatorModel(BaseMathModel):
    """
    Model predicts oil production
    """
    def calculate(self):
        self.output_data['result'] = Calculator.calculate(self.input_data)
        return self.output_data

    @staticmethod
    def get_operations():
        return Calculator.get_operations()

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
        self.output_data['result'] = Calculator.calculate(self.input_data)
        time.sleep(30)
        return self.output_data

    @staticmethod
    def get_operations():
        return Calculator.get_operations()

    @staticmethod
    def get_icon_path():
        return 'core/img/oil1.png'

    @staticmethod
    def get_description():
        return 'Асинхронная модель, выполняющая арифметические операции с числами.'

    class Meta:
        verbose_name = 'Асинхронный калькулятор'


class Notification(models.Model):
    """
    Notification for user about calculation was done or failed
    """
    user = models.ForeignKey(get_user_model(), on_delete=models.CASCADE)

    math_model_id = models.CharField(max_length=50)

    created_timestamp = models.DateTimeField(auto_now_add=True)

    is_success = models.BooleanField(default=False)

    description = models.CharField(max_length=255, null=True)

    is_acknowledged = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Уведомление'
        verbose_name_plural = 'Уведомления'
