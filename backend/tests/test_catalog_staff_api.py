"""The staff HTTP surface the tool page edits through.

Every route is a thin wrapper over `apps.catalog.staff`, which
`test_catalog_staff.py` tests as plain functions. What is proven here is the
wiring: who may call, how a refusal reaches the browser, and that each route
reaches the right service.
"""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.catalog.models import (
    Plan,
    PlanLimit,
    PlanPrice,
    Tool,
    ToolScreenshotSource,
    ToolScreenshotStatus,
)

pytestmark = pytest.mark.django_db

SEEDED = "pdf-redaction"
TOOLS = "/api/v1/catalog/staff/tools"


@pytest.fixture
def staff_bearer(staff_user):
    from apps.accounts import jwt

    return {"headers": {"Authorization": f"Bearer {jwt.encode_access_token(staff_user)}"}}


def test_staff_can_edit_a_tool_field(client, staff_bearer):
    response = client.patch(
        f"{TOOLS}/{SEEDED}",
        {"changes": {"tagline": "Redact with care"}},
        content_type="application/json",
        **staff_bearer,
    )

    assert response.status_code == 200
    assert response.json()["changed"] == ["tagline"]
    assert Tool.objects.get(slug=SEEDED).tagline == "Redact with care"


def test_a_signed_in_non_staff_user_is_forbidden_not_unauthenticated(client, bearer):
    """403, not 401: the token is good, and a 401 would send the frontend off to
    refresh it and try again as the same user."""
    response = client.patch(
        f"{TOOLS}/{SEEDED}",
        {"changes": {"tagline": "Nope"}},
        content_type="application/json",
        **bearer,
    )

    assert response.status_code == 403
    assert Tool.objects.get(slug=SEEDED).tagline != "Nope"


def test_a_refused_edit_is_a_422_that_names_the_field(client, staff_bearer):
    response = client.patch(
        f"{TOOLS}/{SEEDED}",
        {"changes": {"slug": "renamed"}},
        content_type="application/json",
        **staff_bearer,
    )

    assert response.status_code == 422
    assert "slug" in response.json()["detail"]


def test_staff_read_the_whole_editable_record(client, staff_bearer):
    """Including what the public page never shows, which is what an editor
    needs to prefill from."""
    Tool.objects.filter(slug=SEEDED).update(editor_notes="Check the trial length")

    body = client.get(f"{TOOLS}/{SEEDED}", **staff_bearer).json()

    assert body["editor_notes"] == "Check the trial length"
    assert body["listable"] is True
    assert body["plans"][0]["code"]


def test_the_record_carries_the_faq_so_it_can_be_edited(client, staff_bearer):
    faq = [{"question": "Is it free?", "answer": "No."}]
    Tool.objects.filter(slug=SEEDED).update(faq=faq)

    assert client.get(f"{TOOLS}/{SEEDED}", **staff_bearer).json()["faq"] == faq


def test_staff_can_add_a_plan(client, staff_bearer):
    response = client.post(
        f"{TOOLS}/{SEEDED}/plans",
        {"code": "team", "name": "Team", "changes": {"is_enterprise_quote": True}},
        content_type="application/json",
        **staff_bearer,
    )

    assert response.status_code == 201
    assert response.json()["has_pricing_position"] is True
    assert Plan.objects.get(tool__slug=SEEDED, code="team").name == "Team"


def test_staff_can_edit_a_plan(client, staff_bearer):
    plan = Plan.objects.filter(tool__slug=SEEDED).first()

    response = client.patch(
        f"{TOOLS}/{SEEDED}/plans/{plan.code}",
        {"changes": {"name": "Renamed"}},
        content_type="application/json",
        **staff_bearer,
    )

    assert response.status_code == 200
    assert response.json()["changed"] == ["name"]
    plan.refresh_from_db()
    assert plan.name == "Renamed"


def test_staff_can_set_a_plan_cap(client, staff_bearer):
    plan = Plan.objects.filter(tool__slug=SEEDED).first()

    response = client.put(
        f"{TOOLS}/{SEEDED}/plans/{plan.code}/limits/pages_per_month",
        {"value": 500},
        content_type="application/json",
        **staff_bearer,
    )

    assert response.status_code == 200
    assert PlanLimit.objects.get(plan=plan, kind="pages_per_month").value == 500


def test_staff_can_publish_a_plan_price(client, staff_bearer, staff_user):
    plan = Plan.objects.filter(tool__slug=SEEDED).first()

    response = client.post(
        f"{TOOLS}/{SEEDED}/plans/{plan.code}/prices",
        {"amount": "12.50", "unit": "month", "billing_period": "monthly"},
        content_type="application/json",
        **staff_bearer,
    )

    assert response.status_code == 201
    assert response.json()["changed"] is True
    price = PlanPrice.objects.get(plan=plan, is_current=True, amount="12.50")
    assert price.entered_by == staff_user


def test_staff_can_add_a_facet(client, staff_bearer):
    response = client.post(
        f"{TOOLS}/{SEEDED}/facets",
        {"dimension": "capability", "value": "audit-log"},
        content_type="application/json",
        **staff_bearer,
    )

    assert response.status_code == 201
    assert "audit-log" in Tool.objects.get(slug=SEEDED).facet_slugs


def test_staff_can_remove_a_facet(client, staff_bearer):
    response = client.delete(f"{TOOLS}/{SEEDED}/facets/capability/batch", **staff_bearer)

    assert response.status_code == 200
    assert "batch" not in Tool.objects.get(slug=SEEDED).facet_slugs


def test_removing_the_last_required_facet_is_refused(client, staff_bearer):
    client.delete(f"{TOOLS}/{SEEDED}/facets/media/image", **staff_bearer)

    response = client.delete(f"{TOOLS}/{SEEDED}/facets/media/pdf", **staff_bearer)

    assert response.status_code == 422
    assert "pdf" in Tool.objects.get(slug=SEEDED).facet_slugs


def _upload(width=1600, height=900):
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (30, 90, 160)).save(buffer, format="PNG")
    return SimpleUploadedFile("panel.png", buffer.getvalue(), content_type="image/png")


def test_a_staff_screenshot_upload_is_published_on_arrival(client, staff_bearer):
    response = client.post(
        f"{TOOLS}/{SEEDED}/screenshots",
        {"image": _upload(), "alt_text": "The redaction panel"},
        **staff_bearer,
    )

    assert response.status_code == 201, response.content
    shot = Tool.objects.get(slug=SEEDED).screenshots.get()
    assert shot.status == ToolScreenshotStatus.PUBLISHED
    assert shot.source == ToolScreenshotSource.STAFF


def test_staff_see_pending_screenshots_and_can_publish_one(client, staff_bearer, staff_user):
    """The public payload carries published pictures only, so the page needs
    this read to show what a vendor has sent in."""
    from apps.catalog.staff import upload_screenshot

    pending = upload_screenshot(
        user=staff_user,
        slug=SEEDED,
        data=_upload().read(),
        alt_text="Sent in by the vendor",
        status=ToolScreenshotStatus.PENDING,
    )

    listed = client.get(f"{TOOLS}/{SEEDED}/screenshots", **staff_bearer).json()
    assert [shot["status"] for shot in listed] == ["pending"]

    response = client.post(
        f"/api/v1/catalog/staff/screenshots/{pending['id']}/review",
        {"status": "published"},
        content_type="application/json",
        **staff_bearer,
    )
    assert response.status_code == 200
    assert response.json()["status"] == "published"


def test_a_staff_logo_upload_is_rehosted_and_recorded(client, staff_bearer):
    response = client.post(f"{TOOLS}/{SEEDED}/logo", {"image": _upload(400, 120)}, **staff_bearer)

    assert response.status_code == 200, response.content
    tool = Tool.objects.get(slug=SEEDED)
    assert tool.logo_url == response.json()["logo_url"]
    assert tool.revisions.filter(changes__has_key="logo_url").exists()


def test_an_anonymous_caller_is_unauthenticated(client):
    assert client.get(f"{TOOLS}/{SEEDED}").status_code == 401
