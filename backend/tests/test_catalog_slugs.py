"""Slug rules for anything that becomes a public catalog URL segment."""

import pytest
from django.core.exceptions import ValidationError

from apps.catalog.slugs import validate_catalog_slug


@pytest.mark.parametrize("slug", ["adobe-acrobat", "pdf-redaction", "a1", "x" * 80])
def test_valid_slugs_are_accepted(slug):
    validate_catalog_slug(slug)


@pytest.mark.parametrize(
    "slug",
    ["", "Adobe", "adobe_acrobat", "-adobe", "adobe-", "adobe--acrobat", "adobe acrobat", "x" * 81],
)
def test_malformed_slugs_are_rejected(slug):
    with pytest.raises(ValidationError):
        validate_catalog_slug(slug)


@pytest.mark.parametrize("slug", ["submit", "methodology", "tools", "leaderboard", "account"])
def test_reserved_segments_are_rejected(slug):
    """A tool slugged `submit` would read like a section even though it cannot shadow one."""
    with pytest.raises(ValidationError, match="reserved"):
        validate_catalog_slug(slug)
