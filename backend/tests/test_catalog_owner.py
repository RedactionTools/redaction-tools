"""What a verified listing owner may do.

The rule the whole flow exists to enforce: owners propose, editors dispose. A
catalog whose listings are edited by the vendors it ranks is worthless as a
comparison resource.
"""

import pytest
from django.core.cache import cache
from django.utils import timezone

from apps.catalog.constants import OWNER_EDITABLE_FIELDS
from apps.catalog.models import (
    PlanPrice,
    PriceProposal,
    PriceProposalStatus,
    PriceSource,
    Tool,
    ToolClaim,
    ToolClaimStatus,
    ToolRevision,
    ToolRevisionStatus,
)

LISTINGS = "/api/v1/catalog/my-listings"


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def owned_tool(db, user):
    tool = Tool.objects.get(slug="adobe-acrobat")
    ToolClaim.objects.create(
        tool=tool,
        user=user,
        work_email="rep@adobe.com",
        email_domain="adobe.com",
        email_verified_at=timezone.now(),
        status=ToolClaimStatus.APPROVED,
    )
    return tool


@pytest.mark.django_db
def test_my_listings_shows_only_tools_you_actually_own(client, bearer, owned_tool):
    response = client.get(LISTINGS, **bearer)

    assert [row["slug"] for row in response.json()] == ["adobe-acrobat"]


@pytest.mark.django_db
def test_my_listings_is_empty_without_an_approved_claim(client, bearer, user):
    ToolClaim.objects.create(
        tool=Tool.objects.get(slug="foxit-editor"),
        user=user,
        work_email="rep@foxit.com",
        email_domain="foxit.com",
        status=ToolClaimStatus.PENDING_REVIEW,
    )

    assert client.get(LISTINGS, **bearer).json() == []


@pytest.mark.django_db
def test_my_listings_carries_every_field_an_owner_may_edit(client, bearer, owned_tool):
    """The owner's editor prefills from this payload, and it has to: a listing
    that is not listable 404s on the public profile, which is exactly the
    listing its owner most needs to fix."""
    row = client.get(LISTINGS, **bearer).json()[0]

    assert set(row) >= OWNER_EDITABLE_FIELDS


@pytest.mark.django_db
def test_an_edit_becomes_a_revision_and_does_not_touch_the_listing(client, bearer, owned_tool):
    response = client.post(
        f"{LISTINGS}/adobe-acrobat/revisions",
        {"changes": {"tagline": "Now with better redaction."}},
        content_type="application/json",
        **bearer,
    )

    assert response.status_code == 201
    revision = ToolRevision.objects.get()
    assert revision.status == ToolRevisionStatus.SUBMITTED
    owned_tool.refresh_from_db()
    assert owned_tool.tagline != "Now with better redaction."


@pytest.mark.django_db
def test_a_revision_records_what_it_was_based_on(client, bearer, owned_tool):
    """`base_snapshot` is what makes a conflicting staff edit visible instead of
    silently clobbered."""
    client.post(
        f"{LISTINGS}/adobe-acrobat/revisions",
        {"changes": {"tagline": "New"}},
        content_type="application/json",
        **bearer,
    )

    assert ToolRevision.objects.get().base_snapshot["tagline"] == owned_tool.tagline


@pytest.mark.django_db
def test_an_owner_proposes_facets_as_a_revision_like_any_other_field(client, bearer, owned_tool):
    """Facets are what a buyer filters on, so a vendor writing them directly
    would let them place themselves in searches they do not belong in. They go
    through the same queue as the rest of the listing."""
    response = client.post(
        f"{LISTINGS}/adobe-acrobat/revisions",
        {"changes": {"facet_slugs": ["pdf", "ocr", "batch"]}},
        content_type="application/json",
        **bearer,
    )

    assert response.status_code == 201
    revision = ToolRevision.objects.get()
    assert revision.changes["facet_slugs"] == ["pdf", "ocr", "batch"]
    # Recorded against what the listing says today, so a staff edit in the
    # meantime is a conflict rather than a silent overwrite.
    assert revision.base_snapshot["facet_slugs"] == owned_tool.facet_slugs


@pytest.mark.django_db
def test_a_facet_outside_the_taxonomy_is_refused_by_name(client, bearer, owned_tool):
    """Named rather than dropped, like every other refusal here: a silent drop
    is how a vendor comes to believe they are filed under something they are
    not."""
    response = client.post(
        f"{LISTINGS}/adobe-acrobat/revisions",
        {"changes": {"facet_slugs": ["pdf", "quantum-redaction"]}},
        content_type="application/json",
        **bearer,
    )

    assert response.status_code == 422
    assert "quantum-redaction" in response.content.decode()
    assert not ToolRevision.objects.exists()


@pytest.mark.django_db
def test_editing_a_field_owners_may_not_touch_is_refused_by_name(client, bearer, owned_tool):
    """Refused rather than silently dropped: a silent drop trains vendors to
    believe an edit landed when it did not."""
    response = client.post(
        f"{LISTINGS}/adobe-acrobat/revisions",
        {"changes": {"editor_verdict": "Best in class", "tagline": "ok"}},
        content_type="application/json",
        **bearer,
    )

    assert response.status_code == 422
    assert "editor_verdict" in response.content.decode()
    assert not ToolRevision.objects.exists()


@pytest.mark.django_db
def test_someone_who_does_not_own_the_listing_cannot_edit_it(client, bearer):
    response = client.post(
        f"{LISTINGS}/foxit-editor/revisions",
        {"changes": {"tagline": "Mine now"}},
        content_type="application/json",
        **bearer,
    )

    assert response.status_code == 404


@pytest.mark.django_db
def test_a_price_correction_is_a_proposal_and_never_moves_the_public_price(
    client, bearer, owned_tool
):
    before = PlanPrice.objects.get(plan__tool=owned_tool, plan__code="pro", is_current=True)

    response = client.post(
        f"{LISTINGS}/adobe-acrobat/price-proposals",
        {
            "plan": "pro",
            "amount": "9.99",
            "currency": "USD",
            "unit": "month",
            "billing_period": "monthly",
            "rationale": "We cut the price.",
        },
        content_type="application/json",
        **bearer,
    )

    assert response.status_code == 201
    proposal = PriceProposal.objects.get()
    assert proposal.status == PriceProposalStatus.PENDING
    assert proposal.previous_amount == before.amount

    published = PlanPrice.objects.get(plan__tool=owned_tool, plan__code="pro", is_current=True)
    assert published.pk == before.pk
    assert published.amount == before.amount
    assert published.source == PriceSource.MANUAL


@pytest.mark.django_db
def test_an_owner_can_withdraw_a_pending_proposal(client, bearer, owned_tool, user):
    proposal = PriceProposal.objects.create(
        tool=owned_tool,
        plan=owned_tool.plans.get(code="pro"),
        author=user,
        amount="9.99",
        currency="USD",
        unit="month",
        billing_period="monthly",
    )

    response = client.delete(f"/api/v1/catalog/price-proposals/{proposal.pk}", **bearer)

    assert response.status_code == 204
    assert not PriceProposal.objects.filter(pk=proposal.pk).exists()


@pytest.mark.django_db
def test_approving_a_proposal_publishes_it_as_vendor_supplied_and_pinned(
    admin_client, owned_tool, user
):
    plan = owned_tool.plans.get(code="pro")
    proposal = PriceProposal.objects.create(
        tool=owned_tool,
        plan=plan,
        author=user,
        amount="9.9900",
        currency="USD",
        unit="month",
        billing_period="monthly",
    )

    admin_client.post(
        "/admin/catalog/priceproposal/",
        {"action": "approve_proposals", "_selected_action": [str(proposal.pk)]},
        follow=True,
    )

    published = PlanPrice.objects.get(plan=plan, is_current=True)
    assert str(published.amount) == "9.9900"
    assert published.source == PriceSource.VENDOR
    assert published.is_pinned is True
    # The old figure is closed rather than deleted: the profile shows a history.
    assert PlanPrice.objects.filter(plan=plan, is_current=False).exists()


@pytest.mark.django_db
def test_applying_a_facet_revision_rewrites_the_listing_facets(admin_client, owned_tool, user):
    """Facets are rows, so applying one cannot go through `setattr` - that would
    report success to the editor and move nothing."""
    revision = ToolRevision.objects.create(
        tool=owned_tool,
        author=user,
        changes={"facet_slugs": ["pdf", "ocr"]},
        base_snapshot={"facet_slugs": owned_tool.facet_slugs},
        status=ToolRevisionStatus.SUBMITTED,
    )

    admin_client.post(
        "/admin/catalog/toolrevision/",
        {"action": "apply_revisions", "_selected_action": [str(revision.pk)]},
        follow=True,
    )

    owned_tool.refresh_from_db()
    assert owned_tool.facet_slugs == ["ocr", "pdf"]
    revision.refresh_from_db()
    assert revision.status == ToolRevisionStatus.APPROVED


@pytest.mark.django_db
def test_applying_a_revision_refuses_a_field_staff_changed_in_the_meantime(
    admin_client, owned_tool, user
):
    revision = ToolRevision.objects.create(
        tool=owned_tool,
        author=user,
        changes={"tagline": "Owner's wording"},
        base_snapshot={"tagline": owned_tool.tagline},
        status=ToolRevisionStatus.SUBMITTED,
    )
    Tool.objects.filter(pk=owned_tool.pk).update(tagline="Editor's wording")

    admin_client.post(
        "/admin/catalog/toolrevision/",
        {"action": "apply_revisions", "_selected_action": [str(revision.pk)]},
        follow=True,
    )

    owned_tool.refresh_from_db()
    assert owned_tool.tagline == "Editor's wording"
    revision.refresh_from_db()
    assert revision.status == ToolRevisionStatus.SUBMITTED
