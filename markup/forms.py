from io import BytesIO

import numpy as np
from django import forms
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

    def clean_files(self):
        files = self.cleaned_data.get("files", [])
        valid_files = []

        for file in files:
            if not file.name.lower().endswith(".npy"):
                raise ValidationError(
                    f"Файл {file.name} должен быть в формате .npy"
                )

            try:
                content = file.read()
                data = np.load(BytesIO(content), allow_pickle=False)
                if not isinstance(data, np.ndarray):
                    raise ValidationError(
                        f"Некорректные данные в файле {file.name}"
                    )
                file.seek(0)
                valid_files.append(file)
            except Exception as e:
                raise ValidationError(f"Ошибка в файле {file.name}: {str(e)}")

        if not valid_files:
            raise ValidationError(
                "Необходимо загрузить хотя бы один валидный файл"
            )

        return valid_files

    def save(self, commit=True):
        files = self.cleaned_data["files"]
        instances = []

        for file in files:
            instance = Signal(
                supplier=self.supplier,
                data_file=file,
                sample_rate=self.cleaned_data["sample_rate"],
                original_filename=file.name,
            )
            if commit:
                instance.save()
            instances.append(instance)

        return instances
