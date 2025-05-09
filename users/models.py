from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver


# Внести изменения в обязательность поля
class User(AbstractUser):
    ROLES = (
        ('user_marker', 'Маркировщик'),
        ('user_validator', 'Валидатор'),
        ('user_supplier', 'Поставщик данных'),
    )

    patronymic = models.CharField('Отчество', max_length=50, blank=True)
    phone = models.CharField('Телефон', max_length=20, unique=True)
    role = models.CharField('Роль', max_length=20, choices=ROLES)

    def __str__(self):
        return self.get_full_name()


class MarkerProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='marker_profile',
        limit_choices_to={'role': 'user_marker'}
    )


class ValidatorProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='validator_profile',
        limit_choices_to={'role': 'user_validator'}
    )


class SupplierProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='supplier_profile',
        limit_choices_to={'role': 'user_supplier'}
    )


# Сигналы для автоматического создания профилей
@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    if created:
        if instance.role == 'user_marker':
            MarkerProfile.objects.create(user=instance)
        elif instance.role == 'user_validator':
            ValidatorProfile.objects.create(user=instance)
        elif instance.role == 'user_supplier':
            SupplierProfile.objects.create(user=instance)


# Зачем?
@receiver(post_save, sender=User)
def save_profile(sender, instance, **kwargs):
    if hasattr(instance, 'marker_profile'):
        instance.marker_profile.save()
    elif hasattr(instance, 'validator_profile'):
        instance.validator_profile.save()
    elif hasattr(instance, 'supplier_profile'):
        instance.supplier_profile.save()
