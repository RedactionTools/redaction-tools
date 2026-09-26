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
        # Rows rather than a column, and the one editable thing a reader filters
        # on: proposed as a whole list and reviewed like everything else.
        "facet_slugs",
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

# Staff own the whole record, so this allowlist is not a permission boundary - it
# is a guard rail for edits that arrive from a language model. It keeps a write
# off the fields that are stamped by a process rather than typed by a person, and
# off `slug`, which is a published URL.
#
# Deliberately absent: `slug` (in the sitemap, in every inbound link, with no
# redirect story), `status` (a lifecycle transition, not an edit), `vendor` (an
# FK, not a value), and the freshness stamps `last_verified_at`,
# `prices_changed_at`, `price_is_stale` and `owner_verified_pricing_at` - those
# are set by the price path, and typing them by hand makes the staleness signal
# a lie.
STAFF_EDITABLE_TOOL_FIELDS = frozenset(
    {
        "name",
        "website_url",
        "pricing_url",
        "docs_url",
        "logo_url",
        "is_first_party",
        "tagline",
        "summary",
        "description_md",
        "vendor_copy_md",
        "pros",
        "cons",
        "faq",
        "editor_verdict",
        "editor_notes",
        "sort_order",
    }
)

# The evidence behind a facet. The value itself is not editable: a different
# value is a different claim, so it is removed and added rather than rewritten.
STAFF_EDITABLE_TOOL_FACET_FIELDS = frozenset({"evidence_url", "verified_at"})

# Deliberately absent: `code` (the crawler matches plans on it, and it is half of
# the tool/code uniqueness), `tool`, and the crawl bookkeeping - `verified_at`,
# `last_changed_at`, `consecutive_absences`.
STAFF_EDITABLE_PLAN_FIELDS = frozenset(
    {
        "name",
        "tier_order",
        "is_free_tier",
        "is_trial",
        "trial_days",
        "is_enterprise_quote",
        "is_public",
        "min_seats",
        "highlights",
        "source_url",
    }
)

PLAN_URL_FIELDS = frozenset({"source_url"})
