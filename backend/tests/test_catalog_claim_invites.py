"""Staff-issued claim links.

Staff mint a link for a tool's owner and email it themselves. It never expires
but works once, and redeeming it grants the listing outright: the vetting a
claim normally waits on is the staff member choosing whom to send it to.
"""

import json

import pytest
from django.core.cache import cache
from django.test import override_settings

from apps.catalog import staff
from apps.catalog.claims import hash_code
from apps.catalog.models import Tool, ToolClaim, ToolClaimInvite, ToolClaimStatus

pytestmark = pytest.mark.django_db

SEEDED = "pdf-redaction"
INVITES = "/api/v1/catalog/claim-invites"


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def staff_bearer(staff_user):
    from apps.accounts import jwt

    return {"headers": {"Authorization": f"Bearer {jwt.encode_access_token(staff_user)}"}}


def _bearer_for(account):
    from apps.accounts import jwt

    return {"headers": {"Authorization": f"Bearer {jwt.encode_access_token(account)}"}}


@pytest.fixture
def invite(staff_user):
    return staff.create_claim_invite(user=staff_user, slug=SEEDED, email="ceo@vendor.example")


def _token(invite):
    return invite["url"].rsplit("/", 1)[-1]


# --- Minting -----------------------------------------------------------------


@override_settings(FRONTEND_URL="https://redaction.tools")
def test_staff_mint_a_link_to_the_frontend_claim_page(staff_user):
    result = staff.create_claim_invite(user=staff_user, slug=SEEDED, email="ceo@vendor.example")

    assert result["url"].startswith("https://redaction.tools/claim/")
    assert result["tool"] == SEEDED
    assert result["email"] == "ceo@vendor.example"
    row = ToolClaimInvite.objects.get()
    assert row.created_by == staff_user
    assert row.redeemed_at is None


def test_only_the_tokens_hash_is_stored(invite):
    """A database read must not be enough to take over a listing."""
    token = _token(invite)
    row = ToolClaimInvite.objects.get()

    assert len(token) >= 32
    assert row.token_hash == hash_code(token)
    assert token not in json.dumps(list(ToolClaimInvite.objects.values()), default=str)


def test_each_link_is_different(staff_user):
    first = staff.create_claim_invite(user=staff_user, slug=SEEDED, email="a@vendor.example")
    second = staff.create_claim_invite(user=staff_user, slug=SEEDED, email="a@vendor.example")

    assert first["url"] != second["url"]


def test_an_unknown_tool_is_refused(staff_user):
    with pytest.raises(staff.StaffError, match="No tool"):
        staff.create_claim_invite(user=staff_user, slug="no-such-tool", email="a@vendor.example")


def test_a_malformed_address_is_refused(staff_user):
    with pytest.raises(staff.StaffError, match="email"):
        staff.create_claim_invite(user=staff_user, slug=SEEDED, email="not-an-address")


def test_the_staff_route_mints_a_link(client, staff_bearer):
    response = client.post(
        f"/api/v1/catalog/staff/tools/{SEEDED}/claim-invites",
        {"email": "ceo@vendor.example"},
        content_type="application/json",
        **staff_bearer,
    )

    assert response.status_code == 201
    assert "/claim/" in response.json()["url"]


def test_a_non_staff_account_cannot_mint_one(client, bearer):
    response = client.post(
        f"/api/v1/catalog/staff/tools/{SEEDED}/claim-invites",
        {"email": "me@example.com"},
        content_type="application/json",
        **bearer,
    )

    assert response.status_code == 403
    assert not ToolClaimInvite.objects.exists()


def test_the_mcp_tool_mints_a_link(call_tool):
    result = call_tool(
        "catalog_create_claim_invite", {"slug": SEEDED, "email": "ceo@vendor.example"}
    )

    assert result["isError"] is False, result
    assert "/claim/" in json.loads(result["content"][0]["text"])["url"]


# --- Previewing --------------------------------------------------------------


def test_the_link_names_its_tool_before_sign_in(client, invite):
    response = client.get(f"{INVITES}/{_token(invite)}")

    assert response.status_code == 200
    body = response.json()
    assert body["tool"] == SEEDED
    assert body["tool_name"] == Tool.objects.get(slug=SEEDED).name
    assert body["redeemed"] is False


def test_an_unknown_link_is_not_found(client):
    assert client.get(f"{INVITES}/not-a-real-token").status_code == 404


# --- Redeeming ---------------------------------------------------------------


def test_redeeming_requires_an_account(client, invite):
    assert client.post(f"{INVITES}/{_token(invite)}/redeem").status_code == 401


def test_redeeming_grants_the_listing_outright(client, bearer, user, invite, staff_user):
    response = client.post(f"{INVITES}/{_token(invite)}/redeem", **bearer)

    assert response.status_code == 200
    assert response.json()["tool"] == SEEDED
    claim = ToolClaim.objects.get(user=user)
    assert claim.status == ToolClaimStatus.APPROVED
    assert claim.work_email == "ceo@vendor.example"
    assert claim.reviewed_by == staff_user
    assert claim.email_verified_at is not None
    assert list(Tool.objects.owned_by(user)) == [Tool.objects.get(slug=SEEDED)]

    row = ToolClaimInvite.objects.get()
    assert row.redeemed_by == user
    assert row.redeemed_at is not None
    assert row.claim == claim


def test_the_link_works_once(client, bearer, invite, django_user_model):
    token = _token(invite)
    client.post(f"{INVITES}/{token}/redeem", **bearer)
    other = django_user_model.objects.create_user(email="other@example.com", name="Other")

    response = client.post(f"{INVITES}/{token}/redeem", **_bearer_for(other))

    assert response.status_code == 404
    assert "already been used" in response.json()["detail"]
    assert not ToolClaim.objects.filter(user=other).exists()


def test_reopening_your_own_redeemed_link_is_harmless(client, bearer, invite):
    """The owner who clicks the email twice should land on success, not an error."""
    token = _token(invite)
    client.post(f"{INVITES}/{token}/redeem", **bearer)

    response = client.post(f"{INVITES}/{token}/redeem", **bearer)

    assert response.status_code == 200
    assert ToolClaim.objects.count() == 1


def test_a_pending_claim_by_the_same_person_is_approved_rather_than_duplicated(
    client, bearer, user, invite
):
    ToolClaim.objects.create(
        tool=Tool.objects.get(slug=SEEDED),
        user=user,
        work_email="me@gmail.com",
        email_domain="gmail.com",
    )

    response = client.post(f"{INVITES}/{_token(invite)}/redeem", **bearer)

    assert response.status_code == 200
    claim = ToolClaim.objects.get(user=user)
    assert claim.status == ToolClaimStatus.APPROVED


def test_a_revoked_link_does_nothing(client, bearer, user, invite):
    ToolClaimInvite.objects.update(revoked_at="2026-09-01T00:00:00Z")

    response = client.post(f"{INVITES}/{_token(invite)}/redeem", **bearer)

    assert response.status_code == 404
    assert not ToolClaim.objects.filter(user=user).exists()
    assert client.get(f"{INVITES}/{_token(invite)}").status_code == 404


def test_the_preview_reports_a_used_link(client, bearer, invite):
    client.post(f"{INVITES}/{_token(invite)}/redeem", **bearer)

    assert client.get(f"{INVITES}/{_token(invite)}").json()["redeemed"] is True


# --- Admin -------------------------------------------------------------------


def test_the_admin_lists_invites_and_can_revoke_them(admin_client, invite):
    row = ToolClaimInvite.objects.get()
    listing = admin_client.get("/admin/catalog/toolclaiminvite/")
    assert listing.status_code == 200

    admin_client.post(
        "/admin/catalog/toolclaiminvite/",
        {"action": "revoke_invites", "_selected_action": [row.pk]},
    )

    row.refresh_from_db()
    assert row.revoked_at is not None
