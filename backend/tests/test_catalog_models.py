"""Catalog model shape: table names, ordering and string form.

These assert the conventions this app introduces to the repo - explicit
`db_table` and `Meta.ordering` on every model - so a later model cannot quietly
fall back to Django's defaults.
"""

import pytest
from django.core.exceptions import ValidationError

from apps.catalog.models import Tool, Vendor


def test_vendor_meta_and_str():
    vendor = Vendor(name="Adobe", slug="adobe")

    assert Vendor._meta.db_table == "catalog_vendor"
    assert Vendor._meta.ordering == ["name"]
    assert str(vendor) == "Adobe"


def test_tool_meta_and_str():
    tool = Tool(name="Adobe Acrobat", slug="adobe-acrobat")

    assert Tool._meta.db_table == "catalog_tool"
    assert Tool._meta.ordering == ["sort_order", "name"]
    assert str(tool) == "Adobe Acrobat"


@pytest.mark.django_db
def test_tool_rejects_a_reserved_slug():
    """Validators run on full_clean, which is what the admin calls - not on save()."""
    vendor = Vendor.objects.create(name="X", slug="x", website_url="https://93.184.216.34/")
    tool = Tool(vendor=vendor, name="Submit", slug="submit", website_url="https://93.184.216.34/")

    with pytest.raises(ValidationError, match="reserved"):
        tool.full_clean()


@pytest.mark.django_db
def test_tool_rejects_an_internal_website_url():
    vendor = Vendor.objects.create(name="X", slug="x", website_url="https://93.184.216.34/")
    tool = Tool(vendor=vendor, name="X", slug="internal", website_url="http://169.254.169.254/")

    with pytest.raises(ValidationError):
        tool.full_clean()
