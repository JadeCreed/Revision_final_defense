# apps/crop_monitoring/apps.py

from django.apps import AppConfig


class CropMonitoringConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.crop_monitoring'

    def ready(self):
        # Connect signals when app loads
        import apps.crop_monitoring.signals  # noqa