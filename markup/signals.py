from django.dispatch import receiver
from django.db.models.signals import post_save, post_delete
from django.db.models import F

from .models import Markup, Signal


@receiver(post_save, sender=Markup)
def increment_signal_assignments_on_draft_creation(sender, instance, created, **kwargs):
    if created and instance.status == "draft":
        Signal.objects.filter(pk=instance.signal_id).update(
            markup_assignments_count=F("markup_assignments_count") + 1
        )


@receiver(post_delete, sender=Markup)
def decrement_signal_assignments_on_draft_delete(sender, instance, **kwargs):
    if instance.status == "draft":
        Signal.objects.filter(
            pk=instance.signal_id, markup_assignments_count__gt=0
        ).update(markup_assignments_count=F("markup_assignments_count") - 1)
