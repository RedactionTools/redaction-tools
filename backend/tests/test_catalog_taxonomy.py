"""Facet dimensions and values.

Facets are data rather than typed columns: marketing adds a dimension without a
migration, and one renderer plus one filter UI covers all of them.
"""

import pytest
from django.db.utils import IntegrityError

from apps.catalog.models import FacetDimension, FacetValue, ToolFacet


def test_facet_meta_and_str():
    dimension = FacetDimension(code="media", label="Media")
    value = FacetValue(dimension=dimension, code="video", slug="video", label="Video")

    assert FacetDimension._meta.db_table == "catalog_facet_dimension"
    assert FacetValue._meta.db_table == "catalog_facet_value"
    assert ToolFacet._meta.db_table == "catalog_tool_facet"
    assert FacetDimension._meta.ordering == ["sort_order", "code"]
    assert FacetValue._meta.ordering == ["dimension", "sort_order", "code"]
    assert str(dimension) == "Media"
    assert str(value) == "Media: Video"


@pytest.mark.django_db
def test_a_dimension_cannot_repeat_a_value_code():
    """The taxonomy is seeded, so this reuses the real `media` dimension."""
    dimension = FacetDimension.objects.get(code="media")

    with pytest.raises(IntegrityError):
        FacetValue.objects.create(
            dimension=dimension, code="video", slug="video-again", label="Video again"
        )
