"""Filtering, searching and ordering the catalog.

Hand-rolled rather than `ninja.FilterSchema`: the semantic that matters is OR
within a dimension and AND across dimensions, which the declarative lookups do
not express.
"""

from django.db.models import Q
from ninja import Schema

FACET_PARAMS = (
    "media",
    "deployment",
    "method",
    "pricing_model",
    "compliance",
    "platform",
    "capability",
    "audience",
)

ORDERINGS = {"price", "-price", "name", "-name", "verified"}


class ToolFilters(Schema):
    media: str | None = None
    deployment: str | None = None
    method: str | None = None
    pricing_model: str | None = None
    compliance: str | None = None
    platform: str | None = None
    capability: str | None = None
    audience: str | None = None
    has_free_tier: bool | None = None
    q: str | None = None
    ordering: str | None = None

    def facet_codes(self):
        """{dimension: [value codes]} for every dimension the caller narrowed on."""
        selected = {}
        for param in FACET_PARAMS:
            raw = getattr(self, param) or ""
            codes = [code.strip() for code in raw.split(",") if code.strip()]
            if codes:
                selected[param] = codes
        return selected


def apply_filters(queryset, filters):
    for dimension, codes in filters.facet_codes().items():
        # One chained .filter() per dimension: each adds a fresh join, giving AND
        # across dimensions and OR within one. A single combined __in would OR
        # across everything, quietly turning every extra filter into a widening one.
        queryset = queryset.filter(
            facets__value__dimension__code=dimension, facets__value__code__in=codes
        )

    if filters.q:
        for token in filters.q.lower().split():
            queryset = queryset.filter(
                Q(name__icontains=token)
                | Q(tagline__icontains=token)
                | Q(summary__icontains=token)
                | Q(description_md__icontains=token)
                | Q(vendor__name__icontains=token)
                | Q(facets__value__label__icontains=token)
            )

    return queryset.distinct()
