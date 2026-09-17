"""The catalog app's wiring. Nothing here needs a database."""

from django.apps import apps


def test_catalog_app_is_installed():
    """Without INSTALLED_APPS the models import fine but their migrations never run."""
    config = apps.get_app_config("catalog")

    assert config.name == "apps.catalog"
