import os
import uuid

import numpy as np
from django.db import models
from django.utils import timezone
from users.models import MarkerProfile, SupplierProfile, ValidatorProfile


class Diagnosis(models.Model):

    name = models.CharField(max_length=255, null=False)
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, db_index=True
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


def ecg_file_path(instance, filename):
    ext = filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return os.path.join("ecg_data/", filename)


class Signal(models.Model):
    MAX_MARKUP_ASSIGNMENTS = 3

    supplier = models.ForeignKey(
        SupplierProfile,
        on_delete=models.CASCADE,
        related_name="uploaded_signals",
        verbose_name="Поставщик",
    )
    data_file = models.FileField(
        "Файл с данными ЭКГ",
        upload_to=ecg_file_path,
        help_text="Файл в формате .npy"
    )
    sample_rate = models.PositiveIntegerField(
        "Частота дискретизации", default=500
    )
    created_at = models.DateTimeField("Дата загрузки", auto_now_add=True)
    original_filename = models.CharField("Имя файла", max_length=255)
    markup_assignments_count = models.PositiveIntegerField(
        "Количество назначений на разметку",
        default=0,
        help_text="Сколько раз этот сигнал был взят в работу или успешно размечен."
    )

    class Meta:
        verbose_name = "Сигнал ЭКГ"
        verbose_name_plural = "Сигналы ЭКГ"
        ordering = ['created_at']

    def can_be_assigned_new_markup(self):
        """Проверяет, можно ли назначить этот сигнал для новой разметки."""
        return self.markup_assignments_count < self.MAX_MARKUP_ASSIGNMENTS

    def save(self, *args, **kwargs):
        if not self.pk:  # Только при создании
            self.original_filename = self.data_file.name
        super().save(*args, **kwargs)


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
    markup_data = models.JSONField("Данные разметки", default=list)
    diagnoses = models.ManyToManyField(
        Diagnosis, related_name="markups", verbose_name="Диагнозы", blank=True
    )
    status = models.CharField(
        "Статус", max_length=20, choices=STATUS_CHOICES, default="draft"
    )
    created_at = models.DateTimeField("Дата создания", auto_now_add=True)
    updated_at = models.DateTimeField("Дата обновления", auto_now=True)
    expires_at = models.DateTimeField("Истекает в", null=True, blank=True)

    class Meta:
        verbose_name = "Разметка"
        verbose_name_plural = "Разметки"

    def is_expired(self):
        """Проверяет, истек ли срок черновика."""
        if self.status == 'draft' and self.expires_at:
            return timezone.now() > self.expires_at
        return False

    def time_left_for_draft(self):
        """Возвращает оставшееся время для черновика или None."""
        if self.status == 'draft' and self.expires_at and not self.is_expired():
            return self.expires_at - timezone.now()
        return None
