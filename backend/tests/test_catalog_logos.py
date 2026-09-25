"""Storing an uploaded logo.

A logo is re-hosted rather than hotlinked, so an upload has to land somewhere
the site can serve it from, at a URL `logo_url` accepts - for a tool or a vendor.
"""

import io

import pytest
from django.conf import settings
from django.core.files.storage import default_storage
from PIL import Image

from apps.catalog import logos
from apps.catalog.models import Vendor


def png_bytes(width=400, height=120, colour=(10, 80, 200)):
    buffer = io.BytesIO()
    Image.new("RGBA", (width, height), (*colour, 255)).save(buffer, format="PNG")
    return buffer.getvalue()


def stored_path(url):
    return url.removeprefix(settings.PUBLIC_MEDIA_URL)


def test_writing_a_logo_returns_a_url_we_serve():
    url = logos.write(png_bytes())

    assert url.startswith(settings.PUBLIC_MEDIA_URL + "logos/")
    assert default_storage.exists(stored_path(url))


@pytest.mark.django_db
def test_a_written_logo_passes_the_logo_url_validator(settings):
    """Our media origin is localhost in development, which the SSRF guard
    rejects - but a URL we minted ourselves is not one we fetch."""
    settings.PUBLIC_MEDIA_URL = "http://localhost:8007/media/"
    vendor = Vendor(name="Acme", slug="acme", website_url="https://93.184.216.34/")

    vendor.logo_url = logos.write(png_bytes())

    vendor.full_clean()


@pytest.mark.parametrize(
    "data",
    [
        b"not an image",
        b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    ],
)
def test_a_logo_we_cannot_safely_re_encode_is_refused(data):
    """SVG is a document that can carry script, and /media/ is served from the
    API's origin - so it is refused, not stored."""
    with pytest.raises(logos.ImageRejected):
        logos.write(data)


def test_an_oversized_logo_is_stored_at_the_width_it_renders_at():
    url = logos.write(png_bytes(width=3000, height=900))

    with default_storage.open(stored_path(url)) as handle:
        assert Image.open(handle).size == (512, 154)
