from io import BytesIO

import numpy as np
from django import forms
from django.db.models.functions import Random
from django.forms import ValidationError

from .models import Signal


class MultipleFileInput(forms.ClearableFileInput):
    allow_multiple_selected = True


class MultipleFileField(forms.FileField):
    def __init__(self, *args, **kwargs):
        kwargs.setdefault("widget", MultipleFileInput())
        super().__init__(*args, **kwargs)

    def clean(self, data, initial=None):
        if data is None:
            return []
        if not isinstance(data, (list, tuple)):
            data = [data]
        result = []
        for file in data:
            result.append(super().clean(file, initial))
        return result


class SignalUploadForm(forms.ModelForm):
    files = MultipleFileField(
        label="Файлы ЭКГ",
        help_text="Выберите один или несколько .npy файлов",
        widget=MultipleFileInput(
            attrs={"accept": ".npy", "multiple": True, "class": "form-control"}
        ),
    )

    class Meta:
        model = Signal
        fields = ["sample_rate"]
        widgets = {
            "sample_rate": forms.NumberInput(
                attrs={"class": "form-control", "min": 100, "max": 1000}
            )
        }

    def __init__(self, *args, **kwargs):
        self.supplier = kwargs.pop("supplier", None)
        super().__init__(*args, **kwargs)
        self.fields["sample_rate"].initial = 500
        self.total_files = 0

    def clean_files(self):
        files = self.cleaned_data.get("files", [])
        self.total_files = len(files)
        valid_files = []

        for file in files:
            if not file.name.lower().endswith(".npy"):
                raise ValidationError(
                    f"Файл {file.name} должен быть в формате .npy"
                )

            try:
                content = file.read()
                data = np.load(BytesIO(content), allow_pickle=False)
                file.seek(0)
                if not isinstance(data, np.ndarray):
                    raise ValidationError(
                        f"Некорректный формат данных файла {file.name}"
                    )

                if self.is_duplicate_data(data):
                    raise ValidationError(
                        "Эти данные уже были загружены ранее"
                    )

                valid_files.append(file)
            except Exception:
                continue

        if not valid_files:
            raise ValidationError(
                "Необходимо загрузить хотя бы один валидный файл"
            )

        return valid_files

    def is_duplicate_data(self, data):
        existing_signals = (
            Signal.objects.filter(
                supplier=self.supplier,
                sample_rate=self.cleaned_data["sample_rate"],
            )
            .only("data_file")
            .extra(select={"random_id": "random()"})
            .order_by("random_id")[:100]
        )

        for signal in existing_signals:
            try:
                with signal.data_file.open("rb") as f:
                    existing_data = np.load(f, allow_pickle=False)
                    # Как поступаем с rtol и atol?
                    if np.allclose(data, existing_data, rtol=1e-4, atol=1e-5):
                        return True
            except Exception:
                continue
        return False

    def save(self, commit=True):
        files = self.cleaned_data.get("files", [])
        instances = []

        for file in files:
            try:
                instance = Signal(
                    supplier=self.supplier,
                    data_file=file,
                    sample_rate=self.cleaned_data["sample_rate"],
                    original_filename=file.name,
                )
                if commit:
                    instance.save()
                instances.append(instance)
            except Exception:
                continue

        return instances
