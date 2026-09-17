"""Ownership boundaries for vendor-editable listing data.

The line is drawn at anything a reader would use to compare tools against each
other. Vendors may correct their own prices - they are the authority on what they
charge - but only through a reviewed proposal that publishes with visible
provenance. What they cannot do is write a number directly, or touch a score.
"""

OWNER_EDITABLE_FIELDS = frozenset(
    {
        "name",
        "website_url",
        "pricing_url",
        "docs_url",
        "logo_url",
        "tagline",
        "summary",
        "vendor_copy_md",
    }
)

# Never writable through the owner API, at any status.
OWNER_READONLY_FIELDS = frozenset(
    {
        "slug",
        "status",
        "is_first_party",
        "sort_order",
        "description_md",
        "editor_verdict",
        "editor_notes",
        "last_verified_at",
        "prices_changed_at",
        "price_is_stale",
        "plans",
        "prices",
        "benchmark_scores",
    }
)

URL_FIELDS = frozenset({"website_url", "pricing_url", "docs_url", "logo_url"})
