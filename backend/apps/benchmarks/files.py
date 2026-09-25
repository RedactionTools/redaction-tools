"""Store the files a benchmark publishes: case PDFs, redacted outputs, overlays.

Every file sits under `benchmarks/<sha256>/`, named after the digest of its bytes -
the same layout `catalog/screenshots.py` uses, and for the same reason: `/media` is
served `immutable`, which is only true of a path whose bytes can never change.

Nothing here knows about a request or a model. Refusals are `FileRejected`, which the
service layer turns into its own error.
"""

import hashlib
import io
from dataclasses import dataclass

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from apps.catalog import images
from apps.catalog.images import ImageRejected

PDF_MAGIC = b"%PDF-"


class FileRejected(Exception):
    """A file we will not store, with a message the uploader can act on."""


@dataclass(frozen=True)
class PdfInfo:
    page_count: int
    #: The first page's media box, in points - what a case's ground truth records.
    page_size: tuple[float, float]


@dataclass(frozen=True)
class StoredPdf:
    path: str
    sha256: str
    page_count: int
    page_size: tuple[float, float]


@dataclass(frozen=True)
class StoredImage:
    path: str
    widths: list[int]
    width: int
    height: int


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_pdf(data: bytes) -> PdfInfo:
    """What `data` is as a PDF, or `FileRejected` if it is not one we can open.

    Cheap checks first: the cap and the magic bytes cost nothing, and parsing is what
    an oversized or hostile upload is trying to make us do.
    """
    cap = settings.BENCHMARK_MAX_PDF_BYTES
    if len(data) > cap:
        raise FileRejected(
            f"That PDF is larger than the {cap // 1024 // 1024} MB limit "
            f"({len(data) // 1024 // 1024} MB)."
        )
    # Some writers put a few bytes of junk before the header; readers tolerate 1 KB.
    if PDF_MAGIC not in data[:1024]:
        raise FileRejected("That file is not a PDF.")

    from pypdf import PdfReader

    try:
        pages = PdfReader(io.BytesIO(data), strict=False).pages
        box = pages[0].mediabox
        return PdfInfo(page_count=len(pages), page_size=(float(box.width), float(box.height)))
    except Exception as exc:
        # A wide net on purpose, as in images.load_screenshot: pypdf signals a broken
        # file with half a dozen exception types, and every one means "not storable".
        raise FileRejected("That PDF could not be read. Is it complete?") from exc


def store_pdf(data: bytes, name: str) -> StoredPdf:
    """Validate a PDF and write it under its digest."""
    info = read_pdf(data)
    digest = sha256(data)
    return StoredPdf(
        path=_write(f"{digest}/{name}", data),
        sha256=digest,
        page_count=info.page_count,
        page_size=info.page_size,
    )


def store_overlay(data: bytes) -> StoredImage:
    """Keep an overlay PNG and render the WebP widths it can fill.

    The PNG is kept as the full-size source: overlays are ~910px wide, so it is the only
    rendition at full resolution, and the one a reader zooms into to see a leaked value.
    """
    return _store_image(data, "overlay")


# 150 dpi puts an A4 page at 1240px: every planted value is legible when enlarged, and
# the PNG stays a few hundred KB. The 480 and 960 renditions are the thumbnails.
PREVIEW_DPI = 150


def store_preview(pdf: bytes) -> StoredImage:
    """Render a case's first page as the image the site shows in place of the PDF.

    An image rather than the PDF in a frame: media is served `X-Frame-Options: DENY`,
    and a browser's PDF viewer is absent on most phones anyway.
    """
    from pdfredeval.engines import render

    buffer = io.BytesIO()
    render(pdf, dpi=PREVIEW_DPI).save(buffer, format="PNG")
    return _store_image(buffer.getvalue(), "preview")


def _store_image(data: bytes, stem: str) -> StoredImage:
    """Through `catalog/images.py`, so the image is re-encoded (metadata dropped) and
    size-checked exactly like any other picture the site serves."""
    try:
        loaded = images.load_screenshot(data)
    except ImageRejected as exc:
        raise FileRejected(str(exc)) from exc

    digest = sha256(loaded.data)
    path = _write(f"{digest}/{stem}.{loaded.format.lower()}", loaded.data)
    rendered = images.render_variants(loaded)
    widths = sorted(width for width in rendered if width < loaded.width)
    for width in widths:
        _write(f"{digest}/w{width}.webp", rendered[width])
    return StoredImage(path=path, widths=widths, width=loaded.width, height=loaded.height)


def store_bytes(data: bytes, name: str) -> str:
    """Write already-validated bytes (a zip we built) under their digest."""
    return _write(f"{sha256(data)}/{name}", data)


def media_url(path: str) -> str | None:
    """The absolute URL a browser fetches `path` from, or None for no file."""
    return f"{settings.PUBLIC_MEDIA_URL}{path}" if path else None


def read(path: str) -> bytes:
    with default_storage.open(path, "rb") as handle:
        return handle.read()


def _write(name: str, data: bytes) -> str:
    """Write `data` at `benchmarks/<name>`, replacing whatever is there.

    Replaced, never suffixed: the path is derived from the bytes, so a collision is the
    same file, and letting storage rename it would strand the row pointing at it.
    """
    path = f"benchmarks/{name}"
    if default_storage.exists(path):
        default_storage.delete(path)
    return default_storage.save(path, ContentFile(data))
