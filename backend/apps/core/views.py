"""Serving user uploads.

Not `django.views.static.serve`, and not whitenoise. Whitenoise indexes its
files once at boot, so a screenshot uploaded after the last restart would 404
until the next one; `static.serve` reads the filesystem directly, which ties the
URL contract to one storage backend and cannot be tested against the in-memory
one. This reads through `default_storage`, which is the only thing that is true
of every backend the project might be pointed at.

Caddy is in front of this in production, but it belongs to another stack and has
no mount for the volume, so the request does reach gunicorn. That is affordable
because the paths are content-addressed: the bytes behind one can never change,
so the response says so and a repeat visitor never asks again.
"""

import mimetypes

from django.core.exceptions import SuspiciousFileOperation
from django.core.files.storage import default_storage
from django.http import FileResponse, Http404

# A year, and immutable. Safe only because every path under here is named after
# a hash of its own contents - see `ToolScreenshot.base_path`.
CACHE_SECONDS = 60 * 60 * 24 * 365


def serve_media(request, path):
    """One stored file, or a 404."""
    try:
        if not default_storage.exists(path):
            raise Http404(path)
        handle = default_storage.open(path, "rb")
    except (SuspiciousFileOperation, FileNotFoundError, ValueError) as exc:
        # Storage raises rather than returns for a path that climbs out of the
        # root, which is the case a string check would miss.
        raise Http404(path) from exc

    content_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
    response = FileResponse(handle, content_type=content_type)
    response["Cache-Control"] = f"public, max-age={CACHE_SECONDS}, immutable"
    return response
