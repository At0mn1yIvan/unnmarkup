from django.apps import AppConfig


class MarkupConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "markup"

    def ready(self):
        import markup.signals
