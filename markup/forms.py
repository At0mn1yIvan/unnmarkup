from io import BytesIO

import numpy as np
from django import forms
from django.forms import ModelForm, ValidationError

from .models import Signal


class SignalUploadForm(ModelForm):
    class Meta:
        model = Signal
        fields = ['data_file', 'sample_rate']
        widgets = {
            'data_file': forms.FileInput(attrs={
                'class': 'form-control',
                'accept': '.npy'
            }),
            'sample_rate': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': 100,
                'max': 1000
            })
        }

    def __init__(self, *args, **kwargs):
        self.supplier = kwargs.pop('supplier', None)
        super().__init__(*args, **kwargs)
        self.fields['sample_rate'].initial = 500

    def clean_data_file(self):
        file = self.cleaned_data.get('data_file')
        if not file.name.lower().endswith('.npy'):
            raise ValidationError("Разрешены только файлы .npy")

        try:
            content = file.read()
            data = np.load(BytesIO(content), allow_pickle=False)
            if not isinstance(data, np.ndarray):
                raise ValidationError("Некорректный формат данных в файле")
        except Exception as e:
            raise ValidationError(f"Ошибка чтения файла: {str(e)}")
        finally:
            file.seek(0)  # Возвращаем указатель файла в начало
        return file

    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.supplier = self.supplier
        if commit:
            instance.save()
        return instance
