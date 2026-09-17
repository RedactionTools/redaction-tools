"""Slug rules for anything that becomes a public catalog URL segment.

`/tool/<slug>/` is its own namespace, so a tool slug cannot shadow a site page
the way it could under a flat hub. What the reserved list still buys is that no
tool slug produces a URL reading like a section, and that tool and facet slugs
stay disjoint - facet landing pages arrive at `/tools/<facet>/` in phase 3.
"""

import re

from django.core.exceptions import ValidationError

RESERVED_CATALOG_SEGMENTS = frozenset(
    {
        "about",
        "account",
        "all",
        "api",
        "auth",
        "benchmark",
        "best",
        "claim",
        "compare",
        "feed",
        "filter",
        "health",
        "index",
        "leaderboard",
        "methodology",
        "new",
        "page",
        "prices",
        "pricing",
        "review",
        "reviews",
        "rss",
        "search",
        "sitemap",
        "submit",
        "tool",
        "tools",
        "top",
        "updated",
        "vs",
    }
)

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MAX_SLUG_LENGTH = 80


def validate_catalog_slug(value: str) -> None:
    if not value:
        raise ValidationError("A slug is required.")
    if len(value) > MAX_SLUG_LENGTH:
        raise ValidationError(f"Slug must be at most {MAX_SLUG_LENGTH} characters.")
    if not SLUG_RE.match(value):
        raise ValidationError(
            "Slug must be lowercase alphanumeric words separated by single hyphens."
        )
    if value in RESERVED_CATALOG_SEGMENTS:
        raise ValidationError(f"'{value}' is a reserved catalog segment.")
