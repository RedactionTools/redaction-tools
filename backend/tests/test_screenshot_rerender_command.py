"""`rerender_screenshots` - the sweep that makes the rendition set changeable."""

import io

import pytest
from django.core.files.storage import default_storage
from django.core.management import call_command
from PIL import Image

from apps.catalog import images, screenshots
from apps.catalog.models import Tool, ToolScreenshotSource


def _png(width=2000, height=1000):
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (70, 70, 70)).save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def shot(db):
    return screenshots.store(
        tool=Tool.objects.get(slug="adobe-acrobat"),
        data=_png(),
        alt_text="The redaction panel",
        source=ToolScreenshotSource.STAFF,
    )


@pytest.mark.django_db
def test_the_command_renders_a_width_that_was_added_after_the_upload(shot, monkeypatch):
    monkeypatch.setattr(images, "VARIANT_WIDTHS", (*images.VARIANT_WIDTHS, 240))

    call_command("rerender_screenshots")

    shot.refresh_from_db()
    assert 240 in shot.rendition_widths
    assert default_storage.exists(shot.rendition_path(240))


@pytest.mark.django_db
def test_the_command_reports_what_it_did(shot, capsys):
    call_command("rerender_screenshots")

    assert "1" in capsys.readouterr().out
