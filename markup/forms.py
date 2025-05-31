from io import BytesIO

import numpy as np
from django import forms
from django.db.models.functions import Random
from django.forms import ValidationError

from .models import Markup, Signal


class SingleMarkupValidationItemForm(forms.ModelForm):
    """
    Форма для валидации отдельных аспектов ОДНОЙ разметки (экземпляра Markup).
    Эта форма будет использоваться внутри формсета.
    """
    is_markup_annotations_confirmed = forms.BooleanField(
        required=False,  # Чекбокс может быть не отмечен
        label="Разметка ЭКГ принята",
        widget=forms.CheckboxInput(attrs={
            'class': 'form-check-input'  # Bootstrap класс для стилизации
            # Можно добавить data-атрибуты, если JS будет с ними взаимодействовать
            # 'data-markup-id': self.instance.pk (это не сработает здесь, self.instance будет доступен позже)
        })
    )
    is_diagnoses_confirmed = forms.BooleanField(
        required=False,  # Чекбокс может быть не отмечен
        label="Диагнозы приняты",
        widget=forms.CheckboxInput(attrs={
            'class': 'form-check-input'
        })
    )

    # Если вы захотите добавить поле для комментариев валидатора к каждой разметке:
    # validator_comment = forms.CharField(
    #     widget=forms.Textarea(attrs={'rows': 2, 'class': 'form-control form-control-sm'}),
    #     required=False,
    #     label="Комментарий к этой разметке"
    # )

    class Meta:
        model = Markup  # Указываем, что эта форма связана с моделью Markup
        # Поля модели, которые мы хотим редактировать через эту форму
        fields = ['is_markup_annotations_confirmed', 'is_diagnoses_confirmed']  # 'validator_comment'
        # Мы не включаем 'id', 'signal', 'marker', 'validator', 'status', 'markup_data', 'diagnoses' и т.д.,
        # так как они либо не редактируются напрямую валидатором на этом этапе, либо управляются по-другому.


class FinalSignalValidationDecisionForm(forms.Form):
    """
    Форма для принятия финального решения по всему Сигналу:
    выбрать одну лучшую разметку или отклонить все.
    """
    # Поле для выбора. 'choices' будут установлены динамически во view.
    # Значением этого поля будет ID выбранной Markup или специальная строка 'reject_all'.
    final_markup_choice = forms.ChoiceField(
        # виджет RadioSelect для отображения радиокнопок
        widget=forms.RadioSelect(attrs={'class': 'form-check-input individual-radio'}), # Добавил класс для стилизации каждого radio
        required=True, # Пользователь обязан сделать выбор
        label="Финальное решение по сигналу ЭКГ:" # Общий заголовок для группы радиокнопок
    )

    def __init__(self, markup_choices_with_data, *args, **kwargs):
        """
        Конструктор для динамической установки 'choices'.
        markup_choices_with_data: список кортежей (value, label) или (value, label, data_attrs_dict).
        Пример: [ (1, "Разметка А"), ('reject_all', "Отклонить все") ]
                 [ (1, "Разметка А", {'data-info': '...'}) ]
        """
        super().__init__(*args, **kwargs)  # Вызываем конструктор родительского класса forms.Form

        # Динамическая установка choices
        actual_choices = []
        for choice_item in markup_choices_with_data:
            if isinstance(choice_item, tuple) and len(choice_item) >= 2:
                actual_choices.append((choice_item[0], choice_item[1]))
            else:
                # Обработка некорректного формата, если нужно
                pass 

        self.fields['final_markup_choice'].choices = actual_choices

        # Примечание по data-атрибутам для RadioSelect:
        # Django Forms не имеют простого встроенного способа добавлять data-атрибуты
        # к *каждому отдельному* <input type="radio"> внутри RadioSelect через определение поля.
        # Такие атрибуты обычно добавляются при рендеринге виджета в шаблоне,
        # итерируясь по `{{ final_decision_form.final_markup_choice }}`.
        # Если бы вам нужно было передать данные из markup_choices_with_data[i][2] (словарь атрибутов)
        # для каждого радио, это потребовало бы кастомного виджета или рендеринга в шаблоне.


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
