"""Staff nudge a listing's maintainers to put one of its badges on their site.

The email goes to everyone who maintains the listing - an approved claim on an
active account - at the work address the claim verified.
"""

import pytest

from apps.catalog import staff
from apps.catalog.models import Tool, ToolClaim, ToolClaimStatus

pytestmark = pytest.mark.django_db

SEEDED = "pdf-redaction"


def _maintain(account, *, email, status=ToolClaimStatus.APPROVED):
    return ToolClaim.objects.create(
        tool=Tool.objects.get(slug=SEEDED),
        user=account,
        work_email=email,
        email_domain=email.rsplit("@", 1)[-1],
        status=status,
    )


def test_the_staff_record_names_who_maintains_the_listing(django_user_model):
    _maintain(
        django_user_model.objects.create_user(email="a@x.example"), email="ceo@vendor.example"
    )
    _maintain(
        django_user_model.objects.create_user(email="b@x.example"),
        email="pending@vendor.example",
        status=ToolClaimStatus.PENDING_REVIEW,
    )
    _maintain(
        django_user_model.objects.create_user(email="c@x.example", is_active=False),
        email="gone@vendor.example",
    )

    assert staff.tool_detail(SEEDED)["maintainers"] == ["ceo@vendor.example"]


def test_each_maintainer_is_emailed_the_badges_and_where_to_get_them(
    staff_user, django_user_model, django_capture_on_commit_callbacks, mailoutbox, settings
):
    settings.FRONTEND_URL = "https://redaction-tools.com"
    _maintain(
        django_user_model.objects.create_user(email="a@x.example"), email="ceo@vendor.example"
    )
    _maintain(
        django_user_model.objects.create_user(email="b@x.example"), email="cto@vendor.example"
    )

    with django_capture_on_commit_callbacks(execute=True):
        result = staff.send_badge_suggestion(user=staff_user, slug=SEEDED)

    assert result["sent_to"] == ["ceo@vendor.example", "cto@vendor.example"]
    # One message each, so neither sees the other's address.
    assert sorted(message.to[0] for message in mailoutbox) == result["sent_to"]
    message = mailoutbox[0]
    assert "PDF Redaction" in message.subject
    assert "https://redaction-tools.com/my-listings" in message.body
    html = message.alternatives[0][0]
    for kind in ("listed", "reviewed", "benchmarked"):
        assert f"https://redaction-tools.com/images/email/badge-{kind}.png" in html


def test_a_listing_nobody_maintains_is_refused(staff_user, mailoutbox):
    with pytest.raises(staff.StaffError, match="Nobody maintains"):
        staff.send_badge_suggestion(user=staff_user, slug=SEEDED)

    assert mailoutbox == []


def test_the_staff_route_sends_it(
    client, staff_user, django_user_model, django_capture_on_commit_callbacks, mailoutbox
):
    from apps.accounts import jwt

    _maintain(
        django_user_model.objects.create_user(email="a@x.example"), email="ceo@vendor.example"
    )

    with django_capture_on_commit_callbacks(execute=True):
        response = client.post(
            f"/api/v1/catalog/staff/tools/{SEEDED}/badge-suggestion",
            headers={"Authorization": f"Bearer {jwt.encode_access_token(staff_user)}"},
        )

    assert response.status_code == 200
    assert response.json()["sent_to"] == ["ceo@vendor.example"]
    assert [message.to for message in mailoutbox] == [["ceo@vendor.example"]]


def test_an_owner_cannot_send_it(client, bearer, user, mailoutbox):
    _maintain(user, email="ceo@vendor.example")

    response = client.post(f"/api/v1/catalog/staff/tools/{SEEDED}/badge-suggestion", **bearer)

    assert response.status_code == 403
    assert mailoutbox == []
