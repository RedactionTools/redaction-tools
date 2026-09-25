"""Tables that ship now and are used later.

The crawler is phase 2, but reshaping a price schema once it holds real data is the
expensive kind of migration - and PriceSnapshot is what keeps PlanPrice a change
history rather than a daily log. (The benchmark placeholders that used to live here
were replaced by `apps.benchmarks`; see test_benchmarks_models.py.)
"""

import pytest
from django.db import connection

from apps.catalog.models import PlanPrice


@pytest.mark.django_db
def test_crawl_tables_exist():
    expected = {
        "catalog_crawl_source",
        "catalog_crawl_run",
        "catalog_crawl_result",
        "catalog_price_snapshot",
        "catalog_price_review_item",
    }

    assert expected <= set(connection.introspection.table_names())


def test_a_published_price_can_cite_the_observation_it_came_from():
    assert PlanPrice._meta.get_field("snapshot").related_model.__name__ == "PriceSnapshot"
