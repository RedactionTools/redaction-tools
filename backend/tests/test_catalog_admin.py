"""The moderation surface.

Staff work the catalog from the admin, so the parts that carry a judgement -
whether a tool is listable, where a price came from - have to be visible there
rather than only in the API.
"""

import pytest
from django.contrib import admin
from django.utils import timezone

from apps.catalog.models import (
    Plan,
    PlanPrice,
    PriceSource,
    Tool,
    ToolClaim,
    ToolClaimStatus,
    ToolStatus,
    ToolSubmission,
    ToolSubmissionStatus,
)


def test_every_catalog_model_a_human_edits_is_registered():
    registered = {model.__name__ for model in admin.site._registry}

    assert {"Vendor", "Tool", "Plan", "PlanPrice", "FacetValue"} <= registered


def test_the_tool_list_shows_whether_a_tool_can_be_published():
    """`listable` is the column that tells an editor what still blocks publication."""
    assert "listable" in admin.site._registry[Tool].list_display


def test_price_provenance_is_editable_rather_than_hidden():
    fields = admin.site._registry[PlanPrice].list_display

    assert "source" in fields
    assert "is_pinned" in fields


@pytest.mark.django_db
def test_the_tool_page_loads_with_its_plan_inline(admin_client):
    tool = Tool.objects.get(slug="adobe-acrobat")

    response = admin_client.get(f"/admin/catalog/tool/{tool.pk}/change/")

    assert response.status_code == 200
    assert b"Acrobat Pro" in response.content


@pytest.mark.django_db
def test_a_staff_price_edit_records_who_made_it(admin_client, staff_user):
    """`entered_by` is the audit trail; it must not depend on anyone filling a field."""
    plan = Plan.objects.get(tool__slug="adobe-acrobat", code="pro")
    price = plan.prices.get(is_current=True)

    admin_client.post(
        f"/admin/catalog/planprice/{price.pk}/change/",
        {
            "plan": plan.pk,
            "currency": "USD",
            "amount": "24.9900",
            "unit": price.unit,
            "billing_period": price.billing_period,
            "is_current": "on",
            "effective_from_0": "2026-09-17",
            "effective_from_1": "00:00:00",
            "source": PriceSource.MANUAL,
            "confidence": "1.000",
            "source_note": "Checked on the vendor page.",
        },
    )

    price.refresh_from_db()
    assert price.entered_by == staff_user


@pytest.mark.django_db
def test_unpinning_hands_a_plan_back_to_the_crawler(admin_client):
    prices = PlanPrice.objects.filter(plan__tool__slug="adobe-acrobat")
    assert prices.filter(is_pinned=True).exists()

    admin_client.post(
        "/admin/catalog/planprice/",
        {
            "action": "unpin_prices",
            "_selected_action": [str(price.pk) for price in prices],
        },
        follow=True,
    )

    assert not prices.filter(is_pinned=True).exists()


@pytest.mark.django_db
def test_approving_a_submission_creates_a_draft_and_never_a_live_page(admin_client, user):
    """Publishing is a second, deliberate step: a live page needs original
    editorial that a queue row does not carry."""
    submission = ToolSubmission.objects.create(
        name="Acme Redact",
        vendor_name="Acme",
        homepage_url="https://93.184.216.34/",
        pricing_url="https://93.184.216.34/pricing",
        description="Redacts things.",
        submitted_by=user,
    )

    admin_client.post(
        "/admin/catalog/toolsubmission/",
        {"action": "approve_and_create_tool", "_selected_action": [str(submission.pk)]},
        follow=True,
    )

    submission.refresh_from_db()
    tool = submission.created_tool
    assert tool is not None
    assert tool.status == ToolStatus.DRAFT
    assert tool.is_listable() is False
    assert submission.status == ToolSubmissionStatus.PUBLISHED
    assert tool.crawl_sources.filter(url="https://93.184.216.34/pricing").exists()


@pytest.mark.django_db
def test_rejecting_a_submission_keeps_the_row_for_deduplication(admin_client, user):
    submission = ToolSubmission.objects.create(
        name="Spam",
        homepage_url="https://93.184.216.34/spam",
        description="x",
        submitted_by=user,
    )

    admin_client.post(
        "/admin/catalog/toolsubmission/",
        {"action": "reject_submissions", "_selected_action": [str(submission.pk)]},
        follow=True,
    )

    submission.refresh_from_db()
    assert submission.status == ToolSubmissionStatus.REJECTED
    assert ToolSubmission.objects.filter(pk=submission.pk).exists()


@pytest.mark.django_db
def test_only_a_verified_claim_can_be_approved(admin_client, user):
    """Approving an unverified claim would hand a listing to an unproven address."""
    tool = Tool.objects.get(slug="adobe-acrobat")
    unverified = ToolClaim.objects.create(
        tool=tool, user=user, work_email="rep@adobe.com", email_domain="adobe.com"
    )

    admin_client.post(
        "/admin/catalog/toolclaim/",
        {"action": "approve_claims", "_selected_action": [str(unverified.pk)]},
        follow=True,
    )

    unverified.refresh_from_db()
    assert unverified.status == ToolClaimStatus.PENDING_VERIFICATION


@pytest.mark.django_db
def test_approving_a_verified_claim_grants_ownership(admin_client, user):
    tool = Tool.objects.get(slug="foxit-editor")
    claim = ToolClaim.objects.create(
        tool=tool,
        user=user,
        work_email="rep@foxit.com",
        email_domain="foxit.com",
        email_verified_at=timezone.now(),
        status=ToolClaimStatus.PENDING_REVIEW,
    )

    admin_client.post(
        "/admin/catalog/toolclaim/",
        {"action": "approve_claims", "_selected_action": [str(claim.pk)]},
        follow=True,
    )

    claim.refresh_from_db()
    assert claim.status == ToolClaimStatus.APPROVED
    assert list(Tool.objects.owned_by(user)) == [tool]


@pytest.mark.django_db
def test_revoking_a_claim_takes_ownership_back(admin_client, user):
    tool = Tool.objects.get(slug="foxit-editor")
    claim = ToolClaim.objects.create(
        tool=tool,
        user=user,
        work_email="rep@foxit.com",
        email_domain="foxit.com",
        email_verified_at=timezone.now(),
        status=ToolClaimStatus.APPROVED,
    )

    admin_client.post(
        "/admin/catalog/toolclaim/",
        {"action": "revoke_claims", "_selected_action": [str(claim.pk)]},
        follow=True,
    )

    assert list(Tool.objects.owned_by(user)) == []
