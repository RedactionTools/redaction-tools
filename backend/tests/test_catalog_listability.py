"""`is_listable()` - the bar a tool clears before it is a page rather than a row.

A tool that cannot clear it is excluded from the public API, the sitemap and
every ItemList. Enforced here, in the queryset, and again at the sitemap.
"""

import pytest

from apps.catalog.models import (
    BillingPeriod,
    FacetDimension,
    FacetValue,
    Plan,
    PlanPrice,
    PriceUnit,
    Tool,
    ToolFacet,
    ToolStatus,
    Vendor,
)

EDITORIAL = "Acme Redact is a redaction tool. " * 20  # comfortably over 400 characters


def _facet(dimension_code, value_code):
    dimension = FacetDimension.objects.get(code=dimension_code)
    return FacetValue.objects.get(dimension=dimension, code=value_code)


@pytest.fixture
def listable_tool(db):
    vendor = Vendor.objects.create(name="Acme", slug="acme", website_url="https://93.184.216.34/")
    tool = Tool.objects.create(
        vendor=vendor,
        name="Acme Redact",
        slug="acme-redact",
        status=ToolStatus.PUBLISHED,
        website_url="https://93.184.216.34/",
        logo_url="https://93.184.216.34/logo.svg",
        description_md=EDITORIAL,
    )
    for dimension, value in (("media", "pdf"), ("deployment", "online"), ("method", "ai")):
        ToolFacet.objects.create(tool=tool, value=_facet(dimension, value))
    plan = Plan.objects.create(tool=tool, name="Pro", code="pro")
    PlanPrice.objects.create(
        plan=plan, amount="15.00", unit=PriceUnit.MONTH, billing_period=BillingPeriod.MONTHLY
    )
    return tool


def test_a_complete_tool_is_listable(listable_tool):
    assert listable_tool.is_listable() is True


def test_a_draft_is_never_listable(listable_tool):
    listable_tool.status = ToolStatus.DRAFT

    assert listable_tool.is_listable() is False


def test_a_tool_without_a_logo_is_not_listable(listable_tool):
    listable_tool.logo_url = ""

    assert listable_tool.is_listable() is False


def test_thin_editorial_is_not_listable(listable_tool):
    listable_tool.description_md = "Short."

    assert listable_tool.is_listable() is False


def test_vendor_copy_does_not_count_as_editorial(listable_tool):
    """Otherwise a claimed listing could clear the bar on marketing copy alone."""
    listable_tool.description_md = ""
    listable_tool.vendor_copy_md = EDITORIAL

    assert listable_tool.is_listable() is False


@pytest.mark.parametrize("dimension", ["media", "deployment", "method"])
def test_every_required_dimension_is_required(listable_tool, dimension):
    """An entry that does not say what it redacts, or how, is not a page."""
    listable_tool.facets.filter(value__dimension__code=dimension).delete()

    assert listable_tool.is_listable() is False


def test_a_tool_with_no_pricing_position_is_not_listable(listable_tool):
    PlanPrice.objects.all().delete()

    assert listable_tool.is_listable() is False


def test_an_explicit_free_tier_is_a_pricing_position(listable_tool):
    PlanPrice.objects.all().delete()
    Plan.objects.filter(tool=listable_tool).update(is_free_tier=True)

    assert listable_tool.is_listable() is True


def test_quote_only_is_a_pricing_position(listable_tool):
    """Otherwise the bar would exclude exactly the enterprise tools buyers compare."""
    PlanPrice.objects.all().delete()
    Plan.objects.filter(tool=listable_tool).update(is_enterprise_quote=True)

    assert listable_tool.is_listable() is True


def test_the_queryset_returns_only_listable_tools(listable_tool):
    Tool.objects.create(
        vendor=listable_tool.vendor,
        name="Bare",
        slug="bare",
        status=ToolStatus.PUBLISHED,
        website_url="https://93.184.216.34/bare",
    )

    slugs = {tool.slug for tool in Tool.objects.listable()}
    assert "acme-redact" in slugs
    assert "bare" not in slugs
