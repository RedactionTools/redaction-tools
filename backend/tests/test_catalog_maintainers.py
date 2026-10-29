"""Staff naming an existing account as a listing's maintainer, with no claim to review.

The claim link covers someone without an account yet; this covers the one who
already has one, so staff need not mail a link to a person sitting next to them.
"""

import pytest

from apps.catalog.models import Tool, ToolClaimStatus
from apps.catalog.staff import StaffError, assign_maintainer

pytestmark = pytest.mark.django_db

SEEDED = "foxit-editor"


def test_assigning_a_maintainer_grants_the_listing(staff_user, user):
    assign_maintainer(user=staff_user, slug=SEEDED, email=user.email)

    assert list(Tool.objects.owned_by(user)) == [Tool.objects.get(slug=SEEDED)]
    claim = user.tool_claims.get()
    assert claim.status == ToolClaimStatus.APPROVED
    assert claim.reviewed_by == staff_user


def test_an_address_with_no_account_is_refused_and_points_at_the_claim_link(staff_user):
    with pytest.raises(StaffError, match="claim link"):
        assign_maintainer(user=staff_user, slug=SEEDED, email="nobody@example.com")


def test_a_deactivated_account_is_refused(staff_user, user):
    user.is_active = False
    user.save(update_fields=["is_active"])

    with pytest.raises(StaffError):
        assign_maintainer(user=staff_user, slug=SEEDED, email=user.email)

    assert not user.tool_claims.exists()


def _bearer_for(account):
    from apps.accounts import jwt

    return {"HTTP_AUTHORIZATION": f"Bearer {jwt.encode_access_token(account)}"}


def test_the_staff_route_assigns_a_maintainer(client, staff_user, user):
    response = client.post(
        f"/api/v1/catalog/staff/tools/{SEEDED}/maintainers",
        {"email": user.email},
        content_type="application/json",
        **_bearer_for(staff_user),
    )

    assert response.status_code == 200
    assert response.json() == {"tool": SEEDED, "maintainers": [user.email]}


def test_the_staff_route_refuses_a_reader(client, user):
    response = client.post(
        f"/api/v1/catalog/staff/tools/{SEEDED}/maintainers",
        {"email": user.email},
        content_type="application/json",
        **_bearer_for(user),
    )

    assert response.status_code == 403
    assert not user.tool_claims.exists()
