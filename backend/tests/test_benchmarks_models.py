"""The benchmarks schema: one suite per medium, cases per dataset revision, and runs
grouped into submissions - the unit an editor reviews."""

import pytest
from django.db import IntegrityError, connection

from apps.benchmarks.models import Case, DatasetRevision, Suite


@pytest.mark.django_db
def test_the_catalog_placeholders_are_gone_and_the_benchmark_tables_exist():
    tables = set(connection.introspection.table_names())

    assert {
        "benchmarks_suite",
        "benchmarks_dataset_revision",
        "benchmarks_case",
        "benchmarks_submission",
        "benchmarks_run",
    } <= tables
    assert not {"catalog_benchmark", "catalog_benchmark_run", "catalog_benchmark_score"} & tables


@pytest.mark.django_db
def test_the_pdf_suite_is_seeded():
    assert Suite.objects.filter(slug="pdf", is_public=True).exists()


@pytest.mark.django_db
def test_a_suite_has_at_most_one_current_revision():
    suite = Suite.objects.get(slug="pdf")
    DatasetRevision.objects.create(suite=suite, revision="v0.1.1", is_current=True)

    with pytest.raises(IntegrityError):
        DatasetRevision.objects.create(suite=suite, revision="v0.2.0", is_current=True)


@pytest.mark.django_db
def test_a_case_id_is_unique_within_a_revision():
    revision = DatasetRevision.objects.create(suite=Suite.objects.get(slug="pdf"), revision="v1")
    Case.objects.create(revision=revision, case_id="pii-detection-1", family="pii-detection")

    with pytest.raises(IntegrityError):
        Case.objects.create(revision=revision, case_id="pii-detection-1", family="pii-detection")
