from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import (
    AuthenticationForm,
    PasswordChangeForm,
    UserCreationForm,
)

User = get_user_model()


class LoginUserForm(AuthenticationForm):
    username = forms.CharField(
        label="Логин/E-mail",
        widget=forms.TextInput(attrs={"class": "form-input"}),
    )

    password = forms.CharField(
        label="Пароль",
        widget=forms.PasswordInput(attrs={"class": "form-input"}),
    )

    class Meta:
        model = User
        fields = ["username", "password"]


class RegisterUserForm(UserCreationForm):
    username = forms.CharField(
        label="Логин", widget=forms.TextInput(attrs={"class": "form-input"})
    )

    password1 = forms.CharField(
        label="Пароль",
        widget=forms.PasswordInput(attrs={"class": "form-input"}),
    )

    password2 = forms.CharField(
        label="Повтор пароля",
        widget=forms.PasswordInput(attrs={"class": "form-input"}),
    )

    usable_password = None

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "patronymic",
            "phone",
            "password1",
            "password2",
        ]
        labels = {
            "email": "E-mail",
            "first_name": "Имя",
            "last_name": "Фамилия",
            "patronymic": "Отчество",
            "phone": "Номер телефона",
        }
        widgets = {
            "email": forms.TextInput(attrs={"class": "form-input"}),
            "first_name": forms.TextInput(attrs={"class": "form-input"}),
            "last_name": forms.TextInput(attrs={"class": "form-input"}),
            "patronymic": forms.TextInput(attrs={"class": "form-input"}),
        }

    def clean_email(self):
        email = self.cleaned_data["email"]
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError("Такой E-mail уже существует")
        return email


class ProfileUserForm(forms.ModelForm):
    username = forms.CharField(
        disabled=True,
        label="Логин",
        widget=forms.TextInput(attrs={"class": "form-input"}),
    )
    email = forms.CharField(
        disabled=True,
        label="E-mail",
        widget=forms.TextInput(attrs={"class": "form-input"}),
    )

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "patronymic",
            "phone",
        ]
        labels = {
            "first_name": "Имя",
            "last_name": "Фамилия",
            "patronymic": "Отчество",
            "phone": "Номер телефона",
        }
        widgets = {
            "first_name": forms.TextInput(attrs={"class": "form-input"}),
            "last_name": forms.TextInput(attrs={"class": "form-input"}),
            "patronymic": forms.TextInput(attrs={"class": "form-input"}),
        }


class UserPasswordChangeForm(PasswordChangeForm):
    old_password = forms.CharField(
        label="Старый пароль",
        widget=forms.PasswordInput(attrs={"class": "form-input"}),
    )
    new_password1 = forms.CharField(
        label="Новый пароль",
        widget=forms.PasswordInput(attrs={"class": "form-input"}),
    )
    new_password2 = forms.CharField(
        label="Подтверждение пароля",
        widget=forms.PasswordInput(attrs={"class": "form-input"}),
    )
