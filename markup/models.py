from django.db import models
from users.models import MarkerProfile, SupplierProfile, ValidatorProfile


class Diagnose(models.Model):
    name = models.CharField(max_length=255, null=False)
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, db_index=True
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["name", "parent"],
                name="unique_diagnose_name_per_parent",
            )
        ]

    def __str__(self):
        return self.name


class Signal(models.Model):
    supplier = models.ForeignKey(
        SupplierProfile,
        on_delete=models.CASCADE,
        related_name="uploaded_signals",
        verbose_name="Поставщик",
    )
    data = models.JSONField("Данные ЭКГ")
    sample_rate = models.PositiveIntegerField(
        "Частота дискретизации", default=500
    )
    created_at = models.DateTimeField("Дата загрузки", auto_now_add=True)

    class Meta:
        verbose_name = "Сигнал ЭКГ"
        verbose_name_plural = "Сигналы ЭКГ"


class Markup(models.Model):
    STATUS_CHOICES = (
        ("draft", "Черновик"),
        ("for_validation", "На проверке"),
        ("approved", "Подтверждено"),
        ("rejected", "Отклонено"),
    )

    signal = models.ForeignKey(
        Signal,
        on_delete=models.CASCADE,
        related_name="markups",
        verbose_name="Сигнал ЭКГ",
    )
    marker = models.ForeignKey(
        MarkerProfile,
        on_delete=models.CASCADE,
        related_name="created_markups",
        verbose_name="Маркировщик",
    )
    validator = models.ForeignKey(
        ValidatorProfile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="validated_markups",
        verbose_name="Валидатор",
    )
    markup_data = models.JSONField("Данные разметки")
    diagnoses = models.ManyToManyField(
        Diagnose, related_name="markups", verbose_name="Диагнозы"
    )
    status = models.CharField(
        "Статус", max_length=20, choices=STATUS_CHOICES, default="draft"
    )
    created_at = models.DateTimeField("Дата создания", auto_now_add=True)
    # добавить updated_at

    class Meta:
        verbose_name = "Разметка"
        verbose_name_plural = "Разметки"
