from django.forms import forms

from .models import Signal


class SignalUploadForm(forms.ModelForm):
    class Meta:
        model = Signal
        fields = ['data', 'sample_rate']
        widgets = {
            'data': forms.FileInput(attrs={
                'class': 'form-control',
                'accept': '.json'
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

    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.supplier = self.supplier
        if commit:
            instance.save()
        return instance
