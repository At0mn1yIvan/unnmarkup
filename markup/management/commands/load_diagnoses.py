import json
from typing import Optional

from django.core.management.base import BaseCommand
from markup.models import Diagnose


class Command(BaseCommand):
    def add_arguments(self, parser) -> None:
        parser.add_argument("json_file", type=str, help="Путь к JSON файлу с болезнями")

    def handle(self, *args, **options) -> None:
        with open(options["json_file"], "r", encoding="utf-8") as f:
            diseases_data = json.load(f)

        self.fill_data(diseases_data)

    def fill_data(self, data: dict[str, Optional[dict]], parent=None) -> None:
        for name, children in data.items():

            disease = Diagnose.objects.create(name=name, parent=parent)

            if children:
                self.fill_data(children, disease)
