import json
from typing import Optional

from django.core.management.base import BaseCommand
from django.db import IntegrityError
from markup.models import Diagnosis
from tqdm import tqdm

# from icd10parser.parser_with_cookie import web_scraper


class Command(BaseCommand):
    """
    Заполнение таблицы Diagnosis диагнозами из МКБ-10.
    Пример вызова команды: python manage.py load_diagnoses markup/static/markup/data/diagnoses.json
    """

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "json_file", type=str, help="Путь к JSON файлу с болезнями"
        )

    def handle(self, *args, **options) -> None:
        try:
            with open(options["json_file"], "r", encoding="utf-8") as f:
                diseases_data = json.load(f)
        except FileNotFoundError:
            self.stderr.write(f"Ошибка: файл {options['json_file']} не найден")
            return
        except json.JSONDecodeError:
            self.stderr.write("Ошибка: файл не является валидным JSON")
            return

        try:
            if Diagnosis.objects.exists():
                raise IntegrityError("Таблица диагнозов не пуста")
        except IntegrityError as e:
            self.stderr.write(f"Ошибка: {e}")
            return

        self.fill_data(diseases_data)

    def fill_data(self, data: dict[str, Optional[dict]], parent=None) -> None:
        for name, children in tqdm(data.items()):

            diagnosis = Diagnosis.objects.create(name=name, parent=parent)

            if children:
                self.fill_data(children, diagnosis)
