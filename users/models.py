from django.contrib.auth.models import AbstractUser
from django.db import models
from django.forms import ValidationError


class User(AbstractUser):
    ROLES = (
        ("user_marker", "Маркировщик"),
        ("user_validator", "Валидатор"),
        ("user_supplier", "Поставщик данных"),
    )

    first_name = models.CharField("Имя", max_length=150, blank=False)
    last_name = models.CharField("Фамилия", max_length=150, blank=False)
    patronymic = models.CharField("Отчество", max_length=50, blank=True)
    phone = models.CharField(
        "Телефон", max_length=20, unique=True, blank=False, null=False
    )
    role = models.CharField(
        "Роль", max_length=20, choices=ROLES, blank=True, null=True
    )

    class Meta:
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"
        constraints = [
            models.CheckConstraint(
                check=(
                    models.Q(
                        role__in=[
                            "user_marker",
                            "user_validator",
                            "user_supplier",
                        ]
                    )
                ),
                name="role_required",
            )
        ]

    def clean(self):
        super().clean()
        if not self.role:
            raise ValidationError(
                {"role": "Роль обязательна для обычных пользователей"}
            )

    def get_full_name(self):
        full_name = f"{self.last_name} {self.first_name}"
        if self.patronymic:
            full_name += f" {self.patronymic}"
        return full_name.strip()

    def __str__(self):
        return self.get_full_name()


class MarkerProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="marker_profile",
        limit_choices_to={"role": "user_marker"} | {"is_superuser": True},
    )


class ValidatorProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="validator_profile",
        limit_choices_to={"role": "user_validator"} | {"is_superuser": True},
    )


class SupplierProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="supplier_profile",
        limit_choices_to={"role": "user_supplier"} | {"is_superuser": True},
    )
