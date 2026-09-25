"""Store an uploaded logo, for a tool or a vendor.

Logos are re-hosted rather than hotlinked, and until now that meant a file
committed to the frontend's `public/images/tools/`. This is the other way in -
an admin upload or a URL the staff MCP server fetches - stored under MEDIA_ROOT
beside the screenshots and through the same `images.py` gate, so SVG is refused
and metadata is stripped.

Returns a URL rather than saving a row: which row it belongs to, and whether
that write is audited, is the caller's business.
"""

import hashlib

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from apps.catalog import images
from apps.catalog.images import ImageRejected
from apps.catalog.screenshots import SOURCE_EXTENSIONS


def write(data):
    """Store `data` as a logo and return the URL to put in `logo_url`.

    Named after the SHA-256 of the stored bytes, because `/media/` is served
    `immutable`: a replaced logo has to be a new URL, never new bytes behind an
    old one. The previous file is left in place - another row may share it.
    """
    loaded = images.load_logo(data)
    digest = hashlib.sha256(loaded.data).hexdigest()
    path = f"logos/{digest}.{SOURCE_EXTENSIONS[loaded.format]}"
    if not default_storage.exists(path):
        path = default_storage.save(path, ContentFile(loaded.data))
    return f"{settings.PUBLIC_MEDIA_URL}{path}"


__all__ = ["ImageRejected", "write"]
