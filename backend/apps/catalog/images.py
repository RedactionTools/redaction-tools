"""Turn an uploaded screenshot into the files the site actually serves.

Takes bytes and returns bytes: no model, no storage, no request. That is what
lets the same pipeline sit behind three upload surfaces - the admin, an owner's
browser and the staff MCP server fetching a URL - with one statement of what a
screenshot may be.
"""

import io
from dataclasses import dataclass

from PIL import Image

# What an upload may arrive as. Screenshots are stills, so GIF is absent
# deliberately: accepting one would publish its first frame as if it were the
# whole thing. SVG is absent because it is a document that can carry script, not
# a raster we could safely re-encode.
ACCEPTED_FORMATS = ("PNG", "JPEG", "WEBP")

# A generous cap for a full-window screenshot and a firm one for everything
# else: a PNG of a 4K window is about 4 MB.
MAX_UPLOAD_BYTES = 12 * 1024 * 1024

# The widest we keep a source at. Above this a screenshot buys nothing: the
# widest rendition we serve is narrower still, and the headroom is there so a
# wider rendition can be added later without re-collecting every screenshot.
MAX_SOURCE_WIDTH = 2560

# The widest a logo is stored at: twice the widest slot one renders in, so it
# stays sharp on a high-density display.
MAX_LOGO_WIDTH = 512

# A decompression-bomb guard, checked against the header rather than the file
# size: a few hundred KB of PNG can declare 900 million pixels, and it is
# decoding that allocates them. Generous enough for any real capture - a 6K
# display is 20 million.
MAX_SOURCE_PIXELS = 50_000_000

# The widths every screenshot is rendered at, and therefore the srcset a page
# offers. Four rather than one because the same screenshot is a thumbnail in a
# comparison row and a full-width figure on a profile, and shipping the large
# one to a phone is the whole cost of getting this wrong.
VARIANT_WIDTHS = (480, 960, 1440, 1920)

# WebP for every rendition: universally supported for years now, and about 30%
# smaller than the JPEG of a screenshot at a quality no reader can tell apart.
# 80 is where text in a UI capture stays crisp; below it the edges go soft.
VARIANT_FORMAT = "WEBP"
VARIANT_QUALITY = 80


class ImageRejected(Exception):
    """An upload we will not store, with a message the uploader can act on."""


@dataclass(frozen=True)
class LoadedScreenshot:
    """A screenshot we have decided to keep, re-encoded and measured."""

    data: bytes
    format: str
    width: int
    height: int


def load_screenshot(data: bytes) -> LoadedScreenshot:
    """Read `data` as an image and report what it is."""
    return _load(data, max_width=MAX_SOURCE_WIDTH)


def load_logo(data: bytes) -> LoadedScreenshot:
    """Read `data` as a logo: the same gate as a screenshot, kept narrower.

    Logos render at most 176 CSS pixels wide, so anything past
    `MAX_LOGO_WIDTH` is bytes every visitor downloads for nothing.
    """
    return _load(data, max_width=MAX_LOGO_WIDTH)


def _load(data, *, max_width):
    if len(data) > MAX_UPLOAD_BYTES:
        # Before Pillow touches it: decoding is the expensive part, and a size
        # check costs nothing.
        raise ImageRejected(
            f"That file is too large: {len(data) // 1024 // 1024} MB, "
            f"against a {MAX_UPLOAD_BYTES // 1024 // 1024} MB limit."
        )

    try:
        image = Image.open(io.BytesIO(data))
    except Exception as exc:
        # A wide net on purpose: Pillow signals junk with UnidentifiedImageError
        # but a truncated or hostile file with OSError, ValueError or its own
        # DecompressionBombError - and every one of those means "not storable".
        raise ImageRejected("That file is not an image we can read.") from exc

    if image.format not in ACCEPTED_FORMATS:
        raise ImageRejected(f"{image.format} is not accepted. Upload a PNG, JPEG or WebP.")

    # Pillow's open() reads the header only, so the size is known here without
    # anything having been decoded yet. Every check that can happen before the
    # decode happens before it.
    if image.width * image.height > MAX_SOURCE_PIXELS:
        raise ImageRejected(
            f"That image has too many pixels: {image.width}x{image.height}, "
            f"against a limit of {MAX_SOURCE_PIXELS // 1_000_000} megapixels."
        )

    source_format = image.format
    image = _fit(image, max_width)
    return LoadedScreenshot(
        data=_encode(image, source_format),
        format=source_format,
        width=image.width,
        height=image.height,
    )


def _fit(image, width):
    """`image` scaled down to `width`, or as it is when it is already narrower.

    Never up: enlarging a screenshot invents detail that was never captured, and
    a blurred 4x crop reads as a broken asset rather than a small one.
    """
    if image.width <= width:
        return image
    height = max(1, round(image.height * width / image.width))
    return image.resize((width, height), Image.LANCZOS)


def _encode(image, image_format):
    """`image` back to bytes, carrying no metadata over.

    Always re-encoded, even when nothing was resized: a fresh save is what drops
    the EXIF, colour profiles and PNG text chunks a capture tool leaves behind,
    which can carry a username or a machine name.
    """
    buffer = io.BytesIO()
    image.save(buffer, format=image_format, **_ENCODER_OPTIONS.get(image_format, {}))
    return buffer.getvalue()


_ENCODER_OPTIONS = {
    # Near-lossless for the stored source, because every rendition is rendered
    # from it rather than from the upload.
    "JPEG": {"quality": 92, "optimize": True, "progressive": True},
    "PNG": {"optimize": True},
    "WEBP": {"quality": 92, "method": 6},
}


def render_variants(loaded: LoadedScreenshot) -> dict[int, bytes]:
    """One WebP per width the screenshot can actually fill.

    Keyed by width because the width is what a `srcset` states and what the
    stored filename carries - the caller never has to re-derive it from the
    bytes.
    """
    image = Image.open(io.BytesIO(loaded.data))
    return {width: _encode_variant(_fit(image, width)) for width in variant_widths(loaded.width)}


def variant_widths(source_width: int) -> tuple[int, ...]:
    """The widths a source this wide is rendered at.

    Never wider than the source, and never empty: a 320px capture is still a
    screenshot, so it gets exactly one rendition at its own width rather than a
    blurred upscale or nothing at all.
    """
    fitting = tuple(width for width in VARIANT_WIDTHS if width <= source_width)
    return fitting or (source_width,)


def _encode_variant(image):
    buffer = io.BytesIO()
    image.save(buffer, format=VARIANT_FORMAT, quality=VARIANT_QUALITY, method=6)
    return buffer.getvalue()
