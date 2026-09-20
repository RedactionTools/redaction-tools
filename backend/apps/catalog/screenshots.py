"""Store a screenshot and the renditions the site serves.

The one gate every upload surface passes through - the Django admin, an owner's
browser and the staff MCP server fetching a URL - so that "what a screenshot is"
is answered in one place rather than three. `images.py` decides what the pixels
may be; this decides what lands in storage and what the row then says.

Nothing here knows about a request or a transport. Refusals are `ImageRejected`,
which each caller turns into whatever it calls a recoverable failure: a form
error in the admin, a 422 from the owner API, an in-band `isError` for a model.
"""

import contextlib
import hashlib
import pathlib
import urllib.error
import urllib.request

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils import timezone

from apps.catalog import images
from apps.catalog.images import ImageRejected
from apps.catalog.models import ToolScreenshot, ToolScreenshotStatus
from apps.catalog.validators import validate_external_url

# Extensions by the format `images.load_screenshot` reports, so the stored
# source is named after what it actually is rather than what it arrived as.
SOURCE_EXTENSIONS = {"PNG": "png", "JPEG": "jpg", "WEBP": "webp"}

# Generous enough for a vendor CDN having a slow morning, short enough that a
# model waiting on the call does not sit there for a minute.
FETCH_TIMEOUT_SECONDS = 15
FETCH_USER_AGENT = "redaction-tools/1.0 (+https://redaction-tools.com)"


def digest_of(loaded):
    """The content address of a loaded screenshot.

    Every file for a screenshot sits under a directory named after this, which
    is what makes the rendition URLs immutable. Public because the admin form
    has to look for a clash before it saves, and the clash is a digest one.
    """
    return hashlib.sha256(loaded.data).hexdigest()


def store(
    *,
    tool,
    data,
    alt_text,
    source,
    status=ToolScreenshotStatus.PENDING,
    caption="",
    uploaded_by=None,
    source_url="",
    captured_at=None,
    sort_order=None,
):
    """Normalize `data`, write every rendition, and record the row.

    Re-storing bytes already on this listing updates that row rather than
    adding a second one: the files are content-addressed, so the same capture
    would write the same paths anyway, and two rows pointing at one directory is
    how deleting one breaks the other.
    """
    loaded = images.load_screenshot(data)

    shot = ToolScreenshot.objects.filter(
        tool=tool, digest=digest_of(loaded)
    ).first() or ToolScreenshot(tool=tool)
    shot.alt_text = alt_text
    shot.caption = caption
    shot.source = source
    shot.status = status
    shot.source_url = source_url
    shot.captured_at = captured_at
    shot.uploaded_by = uploaded_by or shot.uploaded_by
    if sort_order is not None:
        shot.sort_order = sort_order
    elif shot.pk is None:
        # Appended, not inserted: a new capture belongs after the ones an editor
        # has already ordered.
        shot.sort_order = _next_sort_order(tool)

    apply_image(shot, loaded)
    shot.save()
    return shot


def apply_image(screenshot, loaded):
    """Write the source and every rendition, and point `screenshot` at them.

    Deliberately does not save the row: the Django admin builds the instance
    from a form and saves it itself, so the pipeline has to be something that
    can run in between rather than a `save()` of its own.
    """
    screenshot.digest = digest_of(loaded)
    screenshot.width = loaded.width
    screenshot.height = loaded.height
    extension = SOURCE_EXTENSIONS[loaded.format]
    screenshot.image.name = _write(f"{screenshot.digest}/source.{extension}", loaded.data)
    screenshot.rendition_widths = _write_renditions(screenshot, loaded)
    return screenshot


def rerender(screenshot):
    """Write this screenshot's renditions again from its stored source.

    The reason `images.VARIANT_WIDTHS` can be changed at all: the sources are
    kept, so a new width is a re-render rather than a re-collection. Returns the
    widths now on disk.
    """
    with screenshot.image.open("rb") as handle:
        loaded = images.load_screenshot(handle.read())
    apply_image(screenshot, loaded)
    screenshot.save(
        update_fields=["digest", "rendition_widths", "width", "height", "image", "updated_at"]
    )
    return screenshot.rendition_widths


def review(*, screenshot, user, status, note=""):
    """Publish or reject an upload, recording who decided and when."""
    screenshot.status = status
    screenshot.reviewed_by = user
    screenshot.reviewed_at = timezone.now()
    screenshot.review_note = note
    screenshot.save(
        update_fields=["status", "reviewed_by", "reviewed_at", "review_note", "updated_at"]
    )
    return screenshot


def discard(screenshot):
    """Delete the row and, if nothing else points at them, its files.

    The sibling check is what makes the content-addressed layout safe: two
    listings can legitimately carry the same capture, and they share a
    directory.
    """
    shared = (
        ToolScreenshot.objects.filter(digest=screenshot.digest).exclude(pk=screenshot.pk).exists()
    )
    if not shared:
        for width in screenshot.rendition_widths:
            _remove(screenshot.rendition_path(width))
        _remove(screenshot.image.name)
        _remove_directory(screenshot.base_path)
    screenshot.delete()


def fetch(url, *, timeout=FETCH_TIMEOUT_SECONDS):
    """Download a screenshot from a public URL.

    MCP speaks JSON, so a model cannot hand us a file - it hands us a URL and
    this fetches it. That makes it a server-side request from inside the compose
    network, which is why it goes through the same SSRF guard as every other URL
    in the catalog, and why each redirect hop is re-checked rather than followed
    on trust: a 302 into 169.254.169.254 is the whole attack.
    """
    _validate_target(url)
    request = urllib.request.Request(url, headers={"User-Agent": FETCH_USER_AGENT})  # noqa: S310 - scheme checked by validate_external_url
    opener = urllib.request.build_opener(_GuardedRedirects)
    try:
        with opener.open(request, timeout=timeout) as response:
            # One byte over the cap is enough to know it is over, and the rest is
            # never read - so an enormous file costs us 12 MB and no more.
            data = response.read(images.MAX_UPLOAD_BYTES + 1)
    except (urllib.error.URLError, OSError) as exc:
        raise ImageRejected(f"That URL could not be fetched: {exc}") from exc

    if len(data) > images.MAX_UPLOAD_BYTES:
        raise ImageRejected(
            f"That file is larger than the {images.MAX_UPLOAD_BYTES // 1024 // 1024} MB limit."
        )
    return data


class _GuardedRedirects(urllib.request.HTTPRedirectHandler):
    """Follows a redirect only to somewhere the guard would have accepted."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        _validate_target(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _validate_target(url):
    try:
        validate_external_url(url)
    except DjangoValidationError as exc:
        raise ImageRejected(exc.messages[0]) from exc


def _write_renditions(screenshot, loaded):
    """Every rendition, and the widths that were actually written.

    Reported from what was rendered rather than from the declared set, so the
    row can never advertise a file that is not there.
    """
    rendered = images.render_variants(loaded)
    for width, data in rendered.items():
        _write(f"{screenshot.digest}/w{width}.webp", data)
    return sorted(rendered)


def _write(name, data):
    """Write `data` under `screenshots/<name>`, replacing whatever is there.

    Replaced rather than saved through the usual suffixing: these paths are
    derived from the bytes, so a collision means the same picture, and letting
    storage rename it to `source_HxKt2.png` would strand it.
    """
    path = f"screenshots/{name}"
    _remove(path)
    return default_storage.save(path, ContentFile(data))


def _remove(path):
    if path and default_storage.exists(path):
        default_storage.delete(path)


def _remove_directory(path):
    """Drop the screenshot's own directory once its files are gone.

    The storage API deletes files, not directories, and this layout puts one
    directory per screenshot under MEDIA_ROOT - so without this every withdrawal
    leaves an empty one behind for good. Best effort: a storage with no local
    path has no directories to leave, and one that is not empty is one something
    else still wants.
    """
    try:
        directory = pathlib.Path(default_storage.path(path))
    except (NotImplementedError, AttributeError, ValueError):
        return
    with contextlib.suppress(OSError):
        directory.rmdir()


def _next_sort_order(tool):
    last = ToolScreenshot.objects.filter(tool=tool).order_by("-sort_order").first()
    return (last.sort_order + 10) if last else 0


__all__ = [
    "ImageRejected",
    "apply_image",
    "digest_of",
    "discard",
    "fetch",
    "rerender",
    "review",
    "store",
]
