"""Storing a screenshot: what lands in storage, and what the row then says.

The one gate every upload surface passes through - the admin, an owner's browser
and the staff MCP server - so the rules about renditions, provenance and
deduplication are stated here once.
"""

import io

import pytest
from django.conf import settings as django_settings
from django.core.files.storage import default_storage
from PIL import Image

from apps.catalog import images, screenshots
from apps.catalog.models import Tool, ToolScreenshotSource, ToolScreenshotStatus, Vendor


def png_bytes(width=2000, height=1000, colour=(10, 80, 200)):
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), colour).save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def tool(db):
    vendor = Vendor.objects.create(name="Acme", slug="acme", website_url="https://93.184.216.34/")
    return Tool.objects.create(
        vendor=vendor, name="Acme Redact", slug="acme-redact", website_url="https://93.184.216.34/"
    )


def test_storing_a_screenshot_writes_the_source_and_every_rendition(tool):
    shot = screenshots.store(
        tool=tool,
        data=png_bytes(),
        alt_text="The Acme Redact editor with two redactions applied",
        source=ToolScreenshotSource.STAFF,
        status=ToolScreenshotStatus.PUBLISHED,
    )

    assert default_storage.exists(shot.image.name)
    assert shot.rendition_widths == [480, 960, 1440, 1920]
    for width in shot.rendition_widths:
        assert default_storage.exists(shot.rendition_path(width))


def test_storing_the_same_capture_twice_updates_one_row(tool):
    """The files are named after their own bytes, so a second row would point at
    the first one's directory - and deleting either would break the other."""
    first = screenshots.store(
        tool=tool, data=png_bytes(), alt_text="First wording", source=ToolScreenshotSource.STAFF
    )
    second = screenshots.store(
        tool=tool, data=png_bytes(), alt_text="Corrected wording", source=ToolScreenshotSource.STAFF
    )

    assert second.pk == first.pk
    assert tool.screenshots.count() == 1
    assert second.alt_text == "Corrected wording"


def test_a_vendor_upload_is_not_published_by_the_act_of_uploading(tool):
    shot = screenshots.store(
        tool=tool,
        data=png_bytes(),
        alt_text="Our editor",
        source=ToolScreenshotSource.VENDOR,
        uploaded_by=None,
    )

    assert shot.status == ToolScreenshotStatus.PENDING


def test_publishing_records_who_decided(tool, staff_user):
    shot = screenshots.store(
        tool=tool, data=png_bytes(), alt_text="Our editor", source=ToolScreenshotSource.VENDOR
    )

    screenshots.review(
        screenshot=shot, user=staff_user, status=ToolScreenshotStatus.PUBLISHED, note="Checked"
    )

    shot.refresh_from_db()
    assert shot.status == ToolScreenshotStatus.PUBLISHED
    assert shot.reviewed_by == staff_user
    assert shot.reviewed_at is not None


def test_discarding_a_screenshot_takes_its_files_with_it(tool):
    shot = screenshots.store(
        tool=tool, data=png_bytes(), alt_text="Our editor", source=ToolScreenshotSource.STAFF
    )
    paths = [shot.image.name, *(shot.rendition_path(w) for w in shot.rendition_widths)]

    screenshots.discard(shot)

    assert [path for path in paths if default_storage.exists(path)] == []


def test_a_capture_shared_with_another_listing_keeps_its_files(tool):
    """Two listings can legitimately carry the same picture - a comparison shot
    shows both - and a content-addressed layout means they share a directory."""
    other = Tool.objects.create(
        vendor=tool.vendor, name="Beta", slug="beta", website_url="https://93.184.216.34/"
    )
    mine = screenshots.store(
        tool=tool, data=png_bytes(), alt_text="Shared", source=ToolScreenshotSource.STAFF
    )
    theirs = screenshots.store(
        tool=other, data=png_bytes(), alt_text="Shared", source=ToolScreenshotSource.STAFF
    )

    screenshots.discard(mine)

    assert default_storage.exists(theirs.image.name)


def test_a_rerender_picks_up_a_width_that_was_added_later(tool, monkeypatch):
    """The sources are kept so a new width is a re-render rather than a
    re-collection of every screenshot in the catalog."""
    shot = screenshots.store(
        tool=tool, data=png_bytes(), alt_text="Our editor", source=ToolScreenshotSource.STAFF
    )
    monkeypatch.setattr(images, "VARIANT_WIDTHS", (*images.VARIANT_WIDTHS, 128))

    widths = screenshots.rerender(shot)

    assert 128 in widths
    assert default_storage.exists(shot.rendition_path(128))


def test_a_rendition_is_reachable_over_http(client, tool, settings):
    """Nothing else in the stack serves MEDIA_ROOT: whitenoise indexes the
    static files at boot, and the Caddy in front belongs to another stack and
    has no mount for this volume."""
    settings.DEBUG = False
    shot = screenshots.store(
        tool=tool, data=png_bytes(), alt_text="Our editor", source=ToolScreenshotSource.STAFF
    )

    response = client.get(f"{django_settings.MEDIA_URL}{shot.rendition_path(960)}")

    assert response.status_code == 200
    assert response["Content-Type"] == "image/webp"


@pytest.mark.django_db
def test_a_media_path_that_climbs_out_of_the_root_is_a_404(client):
    """The paths are built from a digest, so a traversal attempt is not a
    request for a file that exists - it is an attempt to read the deploy."""
    response = client.get("/media/../../etc/passwd")

    assert response.status_code == 404


def test_discarding_takes_the_directory_with_the_files(tool, settings, tmp_path):
    """Content-addressed layout means one directory per screenshot, so leaving
    them behind litters MEDIA_ROOT with an empty one per withdrawal."""
    settings.MEDIA_ROOT = tmp_path
    settings.STORAGES = {
        **settings.STORAGES,
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    }
    shot = screenshots.store(
        tool=tool, data=png_bytes(), alt_text="Our editor", source=ToolScreenshotSource.STAFF
    )
    directory = tmp_path / shot.base_path
    assert directory.is_dir()

    screenshots.discard(shot)

    assert not directory.exists()
