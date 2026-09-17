"""Tables that ship now and are used later.

The crawler is phase 2 and the leaderboard phase 4, but reshaping a price schema
once it holds real data is the expensive kind of migration - and PriceSnapshot is
what keeps PlanPrice a change history rather than a daily log.
"""

import pytest
from django.db import connection

from apps.catalog.models import Benchmark, BenchmarkRun, BenchmarkScore, PlanPrice


@pytest.mark.django_db
def test_crawl_and_benchmark_tables_exist():
    expected = {
        "catalog_crawl_source",
        "catalog_crawl_run",
        "catalog_crawl_result",
        "catalog_price_snapshot",
        "catalog_price_review_item",
        "catalog_benchmark",
        "catalog_benchmark_run",
        "catalog_benchmark_score",
    }

    assert expected <= set(connection.introspection.table_names())


def test_a_published_price_can_cite_the_observation_it_came_from():
    assert PlanPrice._meta.get_field("snapshot").related_model.__name__ == "PriceSnapshot"


def test_benchmark_scores_are_unique_per_run_and_tool():
    names = {c.name for c in BenchmarkScore._meta.constraints}

    assert Benchmark._meta.db_table == "catalog_benchmark"
    assert BenchmarkRun._meta.db_table == "catalog_benchmark_run"
    assert "uniq_run_tool_score" in names
