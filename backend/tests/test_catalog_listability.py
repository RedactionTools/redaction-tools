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
    listability_blockers,
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


def test_the_report_names_every_reason_a_tool_falls_short(listable_tool):
    """`is_listable()` says no; staff need to know what to fix."""
    listable_tool.status = ToolStatus.DRAFT
    listable_tool.logo_url = ""
    listable_tool.description_md = "Short."
    listable_tool.facets.all().delete()
    PlanPrice.objects.all().delete()

    reasons = list(listability_blockers(listable_tool))

    assert len(reasons) == 5
    blob = " ".join(reasons)
    assert "draft" in blob
    assert "logo_url" in blob
    assert "description_md" in blob
    assert "deployment, media, method" in blob
    assert "pricing" in blob


def test_the_report_is_empty_for_a_listable_tool(listable_tool):
    assert list(listability_blockers(listable_tool)) == []


def test_the_report_counts_the_editorial_shortfall(listable_tool):
    listable_tool.description_md = "x" * 100

    assert "300 characters short" in " ".join(listability_blockers(listable_tool))


def test_asking_only_whether_stops_at_the_first_reason(listable_tool, django_assert_num_queries):
    """`is_listable()` must not pay for the facet and pricing queries once it knows.

    The public list runs the bar over every published tool on every request, so
    the generator's laziness is load-bearing rather than stylistic.
    """
    listable_tool.status = ToolStatus.DRAFT

    with django_assert_num_queries(0):
        assert listable_tool.is_listable() is False
