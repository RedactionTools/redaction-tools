"""The screenshot image pipeline: what we accept, and what we write.

No database and no storage here - `images.py` takes bytes and returns bytes, so
these tests can state the rules about pixels without a tool, a row or a file.
"""

import io

import pytest
from PIL import Image

from apps.catalog import images


def png_bytes(width, height, colour=(200, 30, 30)):
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), colour).save(buffer, format="PNG")
    return buffer.getvalue()


def test_a_screenshot_loads_with_its_real_dimensions():
    loaded = images.load_screenshot(png_bytes(1600, 900))

    assert (loaded.width, loaded.height) == (1600, 900)


def test_bytes_that_are_not_an_image_are_refused():
    """The filename and the content type are the uploader's word; the bytes are not."""
    with pytest.raises(images.ImageRejected):
        images.load_screenshot(b"<svg><script>alert(1)</script></svg>")


def test_an_animated_gif_is_refused_rather_than_flattened():
    """A screenshot is a still. Accepting a GIF would publish its first frame as
    if it were the whole thing."""
    buffer = io.BytesIO()
    Image.new("P", (400, 300)).save(buffer, format="GIF")

    with pytest.raises(images.ImageRejected, match="PNG, JPEG or WebP"):
        images.load_screenshot(buffer.getvalue())


def test_an_upload_over_the_byte_cap_is_refused_before_it_is_decoded():
    """Decoding is the expensive part, so the cheap check goes first."""
    with pytest.raises(images.ImageRejected, match="too large"):
        images.load_screenshot(b"\x89PNG" + b"\x00" * images.MAX_UPLOAD_BYTES)


def test_an_oversized_source_is_scaled_down_rather_than_refused():
    """A 5K window capture is a normal thing to have; storing one is not."""
    loaded = images.load_screenshot(png_bytes(5120, 2880))

    assert loaded.width == images.MAX_SOURCE_WIDTH
    assert loaded.height == images.MAX_SOURCE_WIDTH * 2880 // 5120


def test_capture_metadata_does_not_survive_the_upload():
    """A screenshot's EXIF can name the machine it was taken on; ours never ships it."""
    buffer = io.BytesIO()
    exif = Image.Exif()
    exif[0x010F] = "SomeonesLaptop"
    Image.new("RGB", (800, 600)).save(buffer, format="JPEG", exif=exif)

    loaded = images.load_screenshot(buffer.getvalue())

    assert dict(Image.open(io.BytesIO(loaded.data)).getexif()) == {}


def test_a_source_with_too_many_pixels_is_refused_before_it_is_decoded(monkeypatch):
    """The byte cap is not enough on its own: a few hundred KB of PNG can
    declare 900 million pixels, and it is decoding that allocates them."""
    monkeypatch.setattr(images, "MAX_SOURCE_PIXELS", 10_000)

    with pytest.raises(images.ImageRejected, match="too many pixels"):
        images.load_screenshot(png_bytes(400, 300))


def test_a_wide_screenshot_renders_one_webp_per_declared_width():
    loaded = images.load_screenshot(png_bytes(2000, 1000))

    variants = images.render_variants(loaded)

    assert sorted(variants) == sorted(images.VARIANT_WIDTHS)
    for width, data in variants.items():
        rendered = Image.open(io.BytesIO(data))
        assert rendered.format == "WEBP"
        assert (rendered.width, rendered.height) == (width, width // 2)


def test_a_narrow_screenshot_renders_once_at_its_own_width():
    """A 320px capture is still a screenshot. It gets one rendition, not a
    blurred upscale to 1920 and not nothing at all."""
    loaded = images.load_screenshot(png_bytes(320, 200))

    variants = images.render_variants(loaded)

    assert list(variants) == [320]
    assert Image.open(io.BytesIO(variants[320])).size == (320, 200)


@pytest.mark.parametrize(
    ("mode", "image_format"), [("CMYK", "JPEG"), ("P", "PNG"), ("RGBA", "PNG"), ("L", "PNG")]
)
def test_every_colour_mode_a_capture_tool_emits_can_be_rendered(mode, image_format):
    """WebP writes RGB and RGBA only. A CMYK JPEG out of a design tool would
    otherwise be accepted on upload and then fail when it was rendered."""
    buffer = io.BytesIO()
    Image.new(mode, (1000, 500)).save(buffer, format=image_format)

    variants = images.render_variants(images.load_screenshot(buffer.getvalue()))

    assert Image.open(io.BytesIO(variants[960])).size == (960, 480)
