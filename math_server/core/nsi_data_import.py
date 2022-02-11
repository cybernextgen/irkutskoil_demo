from typing import Dict, Generic, List, Optional, TypeVar
import xml.etree.ElementTree as ET
from xml.etree.ElementTree import ElementTree, Element
import multiprocessing
from pathlib import Path
from django.conf import settings
from .models import Employee, Individual
import logging
from datetime import date
from django.db.models.base import ModelBase as DomainObjectModel
from django.db import transaction
from django.db.utils import IntegrityError
from .models import Notification
from django.template.loader import render_to_string
import time


logger = logging.getLogger(__name__)


class ImportNSIDataError(RuntimeError):
    pass


class NSIRecordsParser(object):
    """
    Общий класс для xml парсеров
    """

    def __init__(self, record_type: str, fields_ns: str, model_class: DomainObjectModel,
                 fields_mapping: Dict[str, str]) -> None:
        self.record_type = record_type
        self.fields_ns = fields_ns
        self.fields_mapping = fields_mapping
        self.model_class = model_class
        self.record_ns = '{http://www.w3.org/2001/XMLSchema-instance}'

    def parse(self, xml_data: ElementTree) -> List[DomainObjectModel]:
        parsed_objects = []
        root = xml_data.getroot()

        for el in list(root):
            if el.attrib[f'{self.record_ns}type'] == self.record_type:
                parsed_object = self.model_class()  # type: ignore
                for f in list(el):
                    tag = f.tag.split('}')[1]
                    domain_object_field_name = self.fields_mapping.get(tag)
                    if domain_object_field_name:
                        if type(domain_object_field_name) == tuple and callable(domain_object_field_name[1]):
                            setattr(parsed_object, domain_object_field_name[0], domain_object_field_name[1](f))
                        else:
                            setattr(parsed_object, domain_object_field_name, f.text)

                parsed_objects.append(parsed_object)
        return parsed_objects


def individual_parser(xml_data: ElementTree, result: dict) -> None:
    """
    Функция парсинга для объектов Individual
    """
    fields_mapping = {
        'ИдентификаторВБазе': 'nsi_id',
        'ПометкаУдаления': ('is_deleted', lambda s: s.text.capitalize()),
        'Имя': 'name',
        'Фамилия': 'surname',
        'Отчество': 'patronymic',
        'ДатаРождения': ('birth_date', lambda s: date.fromisoformat(s.text)),
        'ИНН': 'inn',
        'СНИЛС': 'snils',
        'Код': 'code',
    }

    p = NSIRecordsParser(
        record_type='d2p1:ФизическоеЛицо',
        fields_ns='{http://replication-message-person.org}',
        model_class=Individual,
        fields_mapping=fields_mapping
    )
    result[Individual] = p.parse(xml_data)


def foreign_key_parser(node: Element) -> Optional[str]:
    """
    Извлекает значение id для внешнего ключа xml-записи
    """
    child_elements = list(node)
    if child_elements:
        return child_elements[0].text


def employeeParser(xml_data: ElementTree, result: dict) -> None:
    """
    Функция парсинга для объектов Employee
    """
    fields_mapping = {
        'ИдентификаторВБазе': 'nsi_id',
        'ПометкаУдаления': ('is_deleted', lambda s: s.text.capitalize()),
        'ФизическоеЛицо': ('individual_id', foreign_key_parser),
        'ТабельныйНомер': 'employee_number',
        'Наименование': 'full_name',
        'ДатаПриемаНаРаботу': ('employment_date', lambda s: date.fromisoformat(s.text)),
        'ДатаУвольнения': ('dismissal_date', lambda s: date.fromisoformat(s.text)),
        'ОсновноеМестоРаботы': ('is_primary_workplace', lambda s: s.text.capitalize()),
        'Код': 'code',
    }

    p = NSIRecordsParser(
        record_type='d2p1:Сотрудник',
        fields_ns='{http://replication-message-employee.org}',
        model_class=Employee,
        fields_mapping=fields_mapping
    )
    result[Employee] = p.parse(xml_data)


def get_models_from_xml(exported_data_file_path: Path) -> Dict[DomainObjectModel, List[DomainObjectModel]]:
    """
    Возвращает словарь объектов доменной модели, полученных путем парсинга входного файла
    """
    manager = multiprocessing.Manager()
    parsed_objects: Dict[DomainObjectModel, List[DomainObjectModel]] = manager.dict()

    try:
        with exported_data_file_path.open() as f:
            xml_data = ET.parse(f, parser=ET.XMLParser(encoding="utf-8"))
    except OSError as e:
        logger.error(f"Unable to read xml file, {e}")
        raise ImportNSIDataError("Ошибка чтения данных из НСИ!")

    workers_pool = []
    for worker, args in (
        (individual_parser, (xml_data, parsed_objects)),
            (employeeParser, (xml_data, parsed_objects)),):
        p = multiprocessing.Process(target=worker, args=args)
        p.start()
        workers_pool.append(p)

    for worker in workers_pool:
        worker.join()
    return parsed_objects


def save_models_to_database(models_dict: Dict[DomainObjectModel, List[DomainObjectModel]]) -> List[DomainObjectModel]:
    """
    Содержит логику сохранения объектов доменной модели в базу данных приложения
    """
    ack_records: List[DomainObjectModel] = []
    try:
        with transaction.atomic():
            individuals_list: List[DomainObjectModel] = models_dict.get(Individual, [])
            for i in individuals_list:
                i.save()  # type: ignore
        ack_records = individuals_list
    except IntegrityError as e:
        logger.error(f'Integrity error: {e}')

    # with transaction.atomic():
    for e in models_dict.get(Employee, []):
        try:
            e.save()  # type: ignore
            ack_records.append(e)
        except IntegrityError as e:
            logger.error(f'Integrity error: {e}')
    return ack_records


def generate_ack_file(models: List[DomainObjectModel]) -> None:
    """
    Генерирует файл-квитанцию для сохраненных в базе данных объектов
    """
    ack_xml = render_to_string('nsi_data_import/ack.xml', {'ack_records': models})
    Path(settings.NSI_ACK_FILE_PATH).write_text(ack_xml)


def import_nsi_data_from_xml() -> None:
    """
    Импорт данных из xml-файла систем НСИ
    """
    xml_file_path = Path(settings.NSI_EXPORTED_DATA_FILE_PATH)
    parsed_objects = get_models_from_xml(xml_file_path)
    ack_records = save_models_to_database(parsed_objects)
    generate_ack_file(ack_records)
    time.sleep(30)
