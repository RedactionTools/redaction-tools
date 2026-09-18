"""Catalog model shape: table names, ordering and string form.

These assert the conventions this app introduces to the repo - explicit
`db_table` and `Meta.ordering` on every model - so a later model cannot quietly
fall back to Django's defaults.
"""

import pytest
from django.core.exceptions import ValidationError

from apps.catalog.models import Plan, PlanLimit, PlanLimitKind, Tool, Vendor


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


def test_a_plans_allowance_lives_in_its_limits_and_nowhere_else():
    """An allowance used to be recorded twice: as `included_quota` / `quota_unit`
    on the plan, and as a PlanLimit row. Only the row can carry a label, an
    unlimited flag and more than one cap per plan, so it is the one that stayed -
    and a second home for the same number is how two screens come to disagree.
    """
    fields = {field.name for field in Plan._meta.get_fields()}

    assert "included_quota" not in fields
    assert "quota_unit" not in fields


def test_a_limit_words_itself_from_its_kind():
    """`kind` already carries both halves: "Pages per month" is the kind's own
    label, and "pages" is what that kind counts. Storing either beside it is a
    second home for the same fact, and a row that can disagree with itself."""
    limit = PlanLimit(kind=PlanLimitKind.PAGES_PER_MONTH, value=100)

    assert limit.label == "Pages per month"
    assert limit.display_value == "100 pages"


def test_a_limit_stores_neither_its_wording_nor_its_unit():
    """Both were columns once, and both were copies of what `kind` already says.
    A copy is a row that can contradict its own kind - "pages_per_month: 100 MB"
    was a legal row."""
    fields = {field.name for field in PlanLimit._meta.get_fields()}

    assert "label" not in fields
    assert "unit" not in fields
