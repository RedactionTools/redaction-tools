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


@pytest.mark.django_db
def test_the_price_list_names_the_tool_each_plan_belongs_to(admin_client):
    """Plan names repeat across vendors, so "Pro" alone does not say whose price this is."""
    response = admin_client.get("/admin/catalog/planprice/")

    assert response.status_code == 200
    assert b"Adobe Acrobat" in response.content


# --- Screenshots -----------------------------------------------------------


def _image_file(width=1600, height=900):
    import io

    from django.core.files.uploadedfile import SimpleUploadedFile
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (40, 110, 60)).save(buffer, format="PNG")
    return SimpleUploadedFile("panel.png", buffer.getvalue(), content_type="image/png")


@pytest.mark.django_db
def test_an_editor_uploading_a_screenshot_gets_it_rendered_and_published(admin_client, staff_user):
    """The admin is an editor's own surface, so an upload here is a decision -
    it goes onto the profile rather than into a queue of their own making."""
    from django.core.files.storage import default_storage

    from apps.catalog.models import ToolScreenshot, ToolScreenshotStatus

    tool = Tool.objects.get(slug="adobe-acrobat")

    response = admin_client.post(
        "/admin/catalog/toolscreenshot/add/",
        {
            "tool": tool.pk,
            "image": _image_file(2000, 1000),
            "alt_text": "The Acrobat redaction panel",
            "caption": "",
            "source": "staff",
            "status": ToolScreenshotStatus.PUBLISHED,
            "source_url": "",
            "captured_at": "",
            "review_note": "",
            "sort_order": "0",
        },
    )

    assert response.status_code == 302, response.context["errors"]
    shot = ToolScreenshot.objects.get(tool=tool)
    assert shot.status == ToolScreenshotStatus.PUBLISHED
    assert shot.uploaded_by == staff_user
    assert shot.rendition_widths == [480, 960, 1440, 1920]
    assert default_storage.exists(shot.rendition_path(960))


@pytest.mark.django_db
def test_a_file_that_is_not_an_image_is_a_form_error_rather_than_a_crash(admin_client):
    from django.core.files.uploadedfile import SimpleUploadedFile

    tool = Tool.objects.get(slug="adobe-acrobat")

    response = admin_client.post(
        "/admin/catalog/toolscreenshot/add/",
        {
            "tool": tool.pk,
            "image": SimpleUploadedFile("panel.png", b"nope", content_type="image/png"),
            "alt_text": "Claims to be a PNG",
            "caption": "",
            "source": "staff",
            "status": "published",
            "source_url": "",
            "captured_at": "",
            "review_note": "",
            "sort_order": "0",
        },
    )

    assert response.status_code == 200
    assert b"not an image" in response.content or b"not a PNG" in response.content


@pytest.mark.django_db
def test_publishing_a_vendor_upload_from_the_list_records_the_reviewer(admin_client, staff_user):
    from apps.catalog import screenshots
    from apps.catalog.models import ToolScreenshotSource, ToolScreenshotStatus

    shot = screenshots.store(
        tool=Tool.objects.get(slug="adobe-acrobat"),
        data=_image_file().read(),
        alt_text="Sent in by the vendor",
        source=ToolScreenshotSource.VENDOR,
    )

    admin_client.post(
        "/admin/catalog/toolscreenshot/",
        {"action": "publish_screenshots", "_selected_action": [str(shot.pk)]},
    )

    shot.refresh_from_db()
    assert shot.status == ToolScreenshotStatus.PUBLISHED
    assert shot.reviewed_by == staff_user


@pytest.mark.django_db
def test_re_rendering_from_the_list_rewrites_the_renditions(admin_client):
    """The action that makes a new width possible without re-collecting every
    screenshot in the catalog."""
    from django.core.files.storage import default_storage

    from apps.catalog import screenshots
    from apps.catalog.models import ToolScreenshotSource

    shot = screenshots.store(
        tool=Tool.objects.get(slug="adobe-acrobat"),
        data=_image_file().read(),
        alt_text="Rendered once",
        source=ToolScreenshotSource.STAFF,
    )
    default_storage.delete(shot.rendition_path(960))

    admin_client.post(
        "/admin/catalog/toolscreenshot/",
        {"action": "rerender_screenshots", "_selected_action": [str(shot.pk)]},
    )

    assert default_storage.exists(shot.rendition_path(960))


@pytest.mark.django_db
def test_deleting_a_screenshot_in_the_admin_takes_its_files_too(admin_client):
    """Django never deletes a FileField's file on row delete, so the admin has
    to route through the service or every removal orphans four renditions."""
    from django.core.files.storage import default_storage

    from apps.catalog import screenshots
    from apps.catalog.models import ToolScreenshotSource

    shot = screenshots.store(
        tool=Tool.objects.get(slug="adobe-acrobat"),
        data=_image_file(2000, 1000).read(),
        alt_text="To be removed",
        source=ToolScreenshotSource.STAFF,
    )
    paths = [shot.image.name, *(shot.rendition_path(w) for w in shot.rendition_widths)]

    admin_client.post(
        f"/admin/catalog/toolscreenshot/{shot.pk}/delete/", {"post": "yes"}, follow=True
    )

    assert [path for path in paths if default_storage.exists(path)] == []


# --- Logos -----------------------------------------------------------------


def _change_form_data(admin_client, url):
    """What the browser would send back for an untouched change form.

    Read from the rendered form rather than written out, so the test does not
    have to know every field and inline on the Tool page.
    """
    response = admin_client.get(url)
    data = {}
    forms = [response.context["adminform"].form]
    for inline in response.context["inline_admin_formsets"]:
        formset = inline.formset
        forms.append(formset.management_form)
        forms.extend(formset.forms)
    for form in forms:
        for name in form.fields:
            value = form[name].value()
            if value is None or value is False:
                continue
            data[form.add_prefix(name)] = "on" if value is True else value
    return data


@pytest.mark.django_db
def test_an_editor_can_upload_a_logo_from_the_tool_page(admin_client):
    from django.conf import settings
    from django.core.files.storage import default_storage

    tool = Tool.objects.get(slug="adobe-acrobat")
    url = f"/admin/catalog/tool/{tool.pk}/change/"
    data = _change_form_data(admin_client, url)
    data["logo_upload"] = _image_file(600, 200)

    response = admin_client.post(url, data)

    assert response.status_code == 302, response.context["errors"]
    tool.refresh_from_db()
    assert tool.logo_url.startswith(settings.PUBLIC_MEDIA_URL + "logos/")
    assert default_storage.exists(tool.logo_url.removeprefix(settings.PUBLIC_MEDIA_URL))


@pytest.mark.django_db
def test_an_svg_logo_is_a_form_error_and_the_old_logo_stays(admin_client):
    from django.core.files.uploadedfile import SimpleUploadedFile

    tool = Tool.objects.get(slug="adobe-acrobat")
    url = f"/admin/catalog/tool/{tool.pk}/change/"
    data = _change_form_data(admin_client, url)
    data["logo_upload"] = SimpleUploadedFile(
        "logo.svg", b'<svg xmlns="http://www.w3.org/2000/svg"/>', content_type="image/svg+xml"
    )

    response = admin_client.post(url, data)

    assert response.status_code == 200
    assert b"not an image we can read" in response.content
    tool.refresh_from_db()
    assert tool.logo_url == "/images/tools/adobe-acrobat.svg"


@pytest.mark.django_db
def test_the_tool_page_previews_the_current_logo(admin_client, settings):
    """A site-relative logo is a file in the frontend's `public/`, so the admin -
    on the API's origin - has to reach it through FRONTEND_URL."""
    settings.FRONTEND_URL = "http://localhost:3007"
    tool = Tool.objects.get(slug="adobe-acrobat")

    response = admin_client.get(f"/admin/catalog/tool/{tool.pk}/change/")

    assert b'src="http://localhost:3007/images/tools/adobe-acrobat.svg"' in response.content


@pytest.mark.django_db
def test_an_uploaded_logo_is_previewed_at_its_own_url():
    from apps.catalog.admin import ToolAdmin

    tool = Tool(name="Acme", logo_url="http://localhost:8007/media/logos/abc.png")

    preview = ToolAdmin(Tool, admin.site).logo_preview(tool)

    assert 'src="http://localhost:8007/media/logos/abc.png"' in preview


def test_a_tool_without_a_logo_previews_as_a_dash():
    from apps.catalog.admin import ToolAdmin

    assert ToolAdmin(Tool, admin.site).logo_preview(Tool(name="Acme")) == "—"


@pytest.mark.django_db
def test_the_logo_upload_and_preview_sit_beside_the_logo_url(rf, staff_user):
    from apps.catalog.admin import ToolAdmin

    request = rf.get("/")
    request.user = staff_user
    fields = list(ToolAdmin(Tool, admin.site).get_fields(request, Tool.objects.first()))

    at = fields.index("logo_url")
    assert fields[at + 1 : at + 3] == ["logo_upload", "logo_preview"]


@pytest.mark.django_db
def test_an_editor_can_upload_a_vendor_logo(admin_client):
    from django.conf import settings
    from django.core.files.storage import default_storage

    from apps.catalog.models import Vendor

    vendor = Tool.objects.get(slug="adobe-acrobat").vendor
    url = f"/admin/catalog/vendor/{vendor.pk}/change/"
    data = _change_form_data(admin_client, url)
    data["logo_upload"] = _image_file(600, 200)

    response = admin_client.post(url, data)

    assert response.status_code == 302, response.context["errors"]
    vendor = Vendor.objects.get(pk=vendor.pk)
    assert vendor.logo_url.startswith(settings.PUBLIC_MEDIA_URL + "logos/")
    assert default_storage.exists(vendor.logo_url.removeprefix(settings.PUBLIC_MEDIA_URL))


@pytest.mark.django_db
def test_the_vendor_page_previews_its_logo_beside_the_url(rf, staff_user):
    from apps.catalog.admin import VendorAdmin
    from apps.catalog.models import Vendor

    request = rf.get("/")
    request.user = staff_user
    vendor_admin = VendorAdmin(Vendor, admin.site)
    fields = list(vendor_admin.get_fields(request, Vendor.objects.first()))

    at = fields.index("logo_url")
    assert fields[at + 1 : at + 3] == ["logo_upload", "logo_preview"]
    assert "<img" in vendor_admin.logo_preview(Vendor(logo_url="/images/vendors/acme.png"))
