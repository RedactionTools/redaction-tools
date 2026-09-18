"""Staff writes against the catalog, independent of any transport.

`apps.catalog.staff` is what the MCP server calls, but it knows nothing about
MCP - so it is tested here as plain functions, and `test_mcp_catalog.py` only has
to prove the wiring.
"""

import pytest

from apps.catalog.models import (
    BillingPeriod,
    Plan,
    PlanPrice,
    PriceSource,
    PriceUnit,
    Tool,
    ToolRevision,
    ToolRevisionOrigin,
    ToolRevisionStatus,
)
from apps.catalog.staff import StaffError, set_plan_price, update_plan, update_tool

pytestmark = pytest.mark.django_db

# The SSRF guard resolves DNS, so every URL a test writes is an IP literal, as
# tests/test_catalog_validators.py already does.
SAFE_URL = "https://93.184.216.34/pricing"
METADATA_URL = "http://169.254.169.254/latest/meta-data/"

SEEDED = "pdf-redaction"


@pytest.fixture
def tool(db):
    return Tool.objects.get(slug=SEEDED)


def test_update_tool_applies_the_change(staff_user, tool):
    update_tool(user=staff_user, slug=SEEDED, changes={"tagline": "Redact with care"})

    tool.refresh_from_db()
    assert tool.tagline == "Redact with care"


def test_update_tool_records_an_applied_staff_revision(staff_user, tool):
    before = tool.tagline

    update_tool(user=staff_user, slug=SEEDED, changes={"tagline": "New"})

    revision = ToolRevision.objects.get(tool=tool)
    assert revision.origin == ToolRevisionOrigin.STAFF
    assert revision.status == ToolRevisionStatus.APPROVED
    assert revision.author == staff_user
    assert revision.applied_at is not None
    assert revision.changes == {"tagline": "New"}
    assert revision.base_snapshot == {"tagline": before}


def test_update_tool_records_only_the_fields_that_moved(staff_user, tool):
    """A retried call must not grow the audit trail with a change that never happened."""
    result = update_tool(user=staff_user, slug=SEEDED, changes={"tagline": tool.tagline})

    assert result["changed"] == []
    assert not ToolRevision.objects.filter(tool=tool).exists()


def test_update_tool_refuses_a_field_that_is_not_staff_editable(staff_user, tool):
    with pytest.raises(StaffError) as exc:
        update_tool(user=staff_user, slug=SEEDED, changes={"slug": "stolen"})

    # Named rather than dropped: a silent drop teaches the caller that an edit
    # landed when it did not.
    assert "slug" in str(exc.value)
    tool.refresh_from_db()
    assert tool.slug == SEEDED


def test_update_tool_refuses_a_url_that_points_inward(staff_user, tool):
    with pytest.raises(StaffError):
        update_tool(
            user=staff_user,
            slug=SEEDED,
            changes={"tagline": "Fine", "pricing_url": METADATA_URL},
        )

    tool.refresh_from_db()
    # The whole write is refused, not the offending half of it.
    assert tool.tagline != "Fine"
    assert not ToolRevision.objects.filter(tool=tool).exists()


def test_update_tool_accepts_a_url_that_resolves_outward(staff_user, tool):
    update_tool(user=staff_user, slug=SEEDED, changes={"pricing_url": SAFE_URL})

    tool.refresh_from_db()
    assert tool.pricing_url == SAFE_URL


def test_update_tool_on_an_unknown_slug_is_refused(staff_user):
    with pytest.raises(StaffError):
        update_tool(user=staff_user, slug="nope", changes={"tagline": "x"})


def test_update_tool_reports_whether_the_tool_now_clears_the_bar(staff_user, tool):
    result = update_tool(user=staff_user, slug=SEEDED, changes={"description_md": "Too short."})

    assert result["listable"] is False
    assert any("description_md" in reason for reason in result["listability_reasons"])


def test_update_plan_applies_the_change(staff_user):
    update_plan(user=staff_user, slug=SEEDED, code="pro", changes={"min_seats": 3})

    assert Plan.objects.get(tool__slug=SEEDED, code="pro").min_seats == 3


def test_update_plan_refuses_the_plan_code(staff_user):
    """The crawler matches plans on it; renaming one orphans the match."""
    with pytest.raises(StaffError) as exc:
        update_plan(user=staff_user, slug=SEEDED, code="pro", changes={"code": "pro-2"})

    assert "code" in str(exc.value)


def test_update_plan_on_a_plan_of_another_tool_is_refused(staff_user):
    with pytest.raises(StaffError):
        update_plan(user=staff_user, slug=SEEDED, code="no-such-plan", changes={"min_seats": 2})


def _current(code="pro", **kwargs):
    return PlanPrice.objects.get(
        plan__tool__slug=SEEDED, plan__code=code, is_current=True, **kwargs
    )


def test_set_plan_price_closes_the_old_row_and_opens_a_new_one(staff_user):
    old = _current(is_overage=False)

    result = set_plan_price(
        user=staff_user,
        slug=SEEDED,
        code="pro",
        amount="19.00",
        unit=PriceUnit.MONTH,
        billing_period=BillingPeriod.MONTHLY,
        source_note="Vendor pricing page, checked today.",
    )

    old.refresh_from_db()
    assert old.is_current is False
    assert old.effective_to is not None
    assert result["changed"] is True
    assert str(_current(is_overage=False).amount) == "19.0000"


def test_set_plan_price_stamps_who_entered_it_and_pins_it(staff_user):
    set_plan_price(
        user=staff_user,
        slug=SEEDED,
        code="pro",
        amount="19.00",
        unit=PriceUnit.MONTH,
        billing_period=BillingPeriod.MONTHLY,
        source_note="Vendor pricing page.",
    )

    price = _current(is_overage=False)
    assert price.entered_by == staff_user
    assert price.source == PriceSource.MANUAL
    # PlanPrice.save() pins anything non-crawler; asserted as an outcome rather
    # than restated as an argument.
    assert price.is_pinned is True


def test_set_plan_price_bumps_the_tool_freshness_stamps(staff_user, tool):
    set_plan_price(
        user=staff_user,
        slug=SEEDED,
        code="pro",
        amount="19.00",
        unit=PriceUnit.MONTH,
        billing_period=BillingPeriod.MONTHLY,
        source_note="Vendor pricing page.",
    )

    tool.refresh_from_db()
    assert tool.prices_changed_at is not None
    assert tool.last_verified_at is not None


def test_set_plan_price_leaves_the_overage_row_alone(staff_user):
    """A metered plan publishes two current figures, and they move independently.

    The admin's approve action closes every current row for the plan, which
    would silently retire the overage rate along with the monthly fee.
    """
    overage = _current(is_overage=True)

    set_plan_price(
        user=staff_user,
        slug=SEEDED,
        code="pro",
        amount="19.00",
        unit=PriceUnit.MONTH,
        billing_period=BillingPeriod.MONTHLY,
        source_note="Vendor pricing page.",
    )

    overage.refresh_from_db()
    assert overage.is_current is True
    assert overage.effective_to is None


def test_set_plan_price_is_a_no_op_when_the_figure_has_not_moved(staff_user):
    before = _current(is_overage=False)

    result = set_plan_price(
        user=staff_user,
        slug=SEEDED,
        code="pro",
        amount=before.amount,
        unit=before.unit,
        billing_period=before.billing_period,
        source_note="Re-checked, unchanged.",
    )

    # Opening a row anyway would write a change into the published history that
    # never happened.
    assert result["changed"] is False
    assert PlanPrice.objects.filter(plan=before.plan, is_overage=False).count() == 1


def test_set_plan_price_refuses_an_unknown_unit(staff_user):
    with pytest.raises(StaffError) as exc:
        set_plan_price(
            user=staff_user,
            slug=SEEDED,
            code="pro",
            amount="19.00",
            unit="fortnight",
            billing_period=BillingPeriod.MONTHLY,
            source_note="x",
        )

    assert "unit" in str(exc.value)


def test_set_plan_price_refuses_evidence_pointing_inward(staff_user):
    with pytest.raises(StaffError):
        set_plan_price(
            user=staff_user,
            slug=SEEDED,
            code="pro",
            amount="19.00",
            unit=PriceUnit.MONTH,
            billing_period=BillingPeriod.MONTHLY,
            source_note="x",
            source_evidence_url=METADATA_URL,
        )
