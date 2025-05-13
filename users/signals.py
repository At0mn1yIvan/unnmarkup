from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import MarkerProfile, SupplierProfile, ValidatorProfile

User = get_user_model()


@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    if created:
        if instance.is_superuser:
            # Суперпользователь получает все профили
            MarkerProfile.objects.get_or_create(user=instance)
            ValidatorProfile.objects.get_or_create(user=instance)
            SupplierProfile.objects.get_or_create(user=instance)
        elif instance.role == 'user_marker':
            MarkerProfile.objects.get_or_create(user=instance)
        elif instance.role == 'user_validator':
            ValidatorProfile.objects.get_or_create(user=instance)
        elif instance.role == 'user_supplier':
            SupplierProfile.objects.get_or_create(user=instance)
