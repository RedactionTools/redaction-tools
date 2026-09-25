"""Pooling approved runs into one leaderboard row per tool and surface.

pdfredeval's rules, kept here: counts are pooled and the rate recomputed, never averaged;
scores under different threshold tables are different measurements and never pool.
Rows are built straight in the ORM - scoring is covered in test_benchmarks_scoring.py.
"""

import itertools

import pytest
from django.utils import timezone

from apps.benchmarks import leaderboard
from apps.benchmarks.models import (
    Case,
    ScoredBy,
    Submission,
    SubmissionStatus,
    SubmitterRole,
    Verification,
)
from apps.catalog.models import Tool

pytestmark = pytest.mark.django_db

_ids = itertools.count()


@pytest.fixture
def second_case(benchmark_case):
    return Case.objects.create(
        revision=benchmark_case.revision, case_id="pii-detection-1", family="pii-detection"
    )


def _run(
    case,
    *,
    tool="pdf-redaction",
    surface="web",
    tp=0,
    fn=0,
    fp=0,
    tn=0,
    status=SubmissionStatus.APPROVED,
    digest="t1",
    scored_by=ScoredBy.SERVER,
    verification=Verification.NOT_NEEDED,
    name="Staff",
    role=SubmitterRole.STAFF,
    text_retention=1.0,
    gates_passed=True,
):
    submission = Submission.objects.create(
        suite=case.revision.suite,
        revision=case.revision,
        tool=Tool.objects.get(slug=tool),
        surface=surface,
        origin="upload",
        submitter_name=name,
        submitter_role=role,
        status=status,
        reviewed_at=timezone.now(),
    )
    return submission.runs.create(
        case=case,
        run_id=f"run-{next(_ids)}",
        status="scored",
        output_pdf="benchmarks/x/out.pdf",
        output_sha256="0" * 64,
        tp=tp,
        fn=fn,
        fp=fp,
        tn=tn,
        thresholds_digest=digest,
        scored_by=scored_by,
        verification=verification,
        text_retention=text_retention,
        gates_passed=gates_passed,
    )


def _rows(case, **kwargs):
    return leaderboard.build(case.revision, **kwargs)


def test_counts_are_pooled_across_cases_and_the_rate_recomputed(benchmark_case, second_case):
    _run(benchmark_case, tp=42, fn=12)
    _run(second_case, tp=20, fn=0)

    [row] = _rows(benchmark_case)

    # 12 of 74, not the mean of 22% and 0%.
    assert row["leak_rate"]["count"] == 12
    assert row["leak_rate"]["n"] == 74
    assert row["leak_rate"]["value"] == pytest.approx(12 / 74, abs=1e-6)
    low, high = row["leak_rate"]["ci95"]
    assert low < 12 / 74 < high
    assert row["cases"] == 2


def test_only_approved_submissions_reach_the_board(benchmark_case):
    _run(benchmark_case, tp=1, fn=1, status=SubmissionStatus.PENDING_REVIEW)
    _run(benchmark_case, tp=1, fn=1, status=SubmissionStatus.REJECTED)

    assert _rows(benchmark_case) == []


def test_the_latest_approved_run_of_a_case_replaces_an_earlier_one(benchmark_case):
    _run(benchmark_case, tp=30, fn=24)
    _run(benchmark_case, tp=42, fn=12)

    [row] = _rows(benchmark_case)
    assert (row["leak_rate"]["count"], row["leak_rate"]["n"]) == (12, 54)


def test_each_surface_of_a_tool_is_its_own_row(benchmark_case):
    _run(benchmark_case, surface="web", tp=1, fn=1)
    _run(benchmark_case, surface="api", tp=2, fn=0)

    assert {row["surface"] for row in _rows(benchmark_case)} == {"web", "api"}


def test_runs_scored_under_other_thresholds_are_left_out_and_counted(benchmark_case, second_case):
    _run(benchmark_case, tp=1, fn=1, digest="old")
    _run(second_case, tp=5, fn=0, digest="new")

    [row] = _rows(benchmark_case)
    assert row["leak_rate"]["n"] == 5
    assert row["runs_excluded"] == 1


def test_the_verified_scope_drops_scores_we_could_not_reproduce(benchmark_case, second_case):
    _run(benchmark_case, tp=1, fn=0, scored_by=ScoredBy.SUBMITTER, verification="verified")
    _run(second_case, tp=0, fn=9, scored_by=ScoredBy.SUBMITTER, verification="mismatch")

    [every] = _rows(benchmark_case)
    [verified] = _rows(benchmark_case, scope="verified")

    assert every["provenance"] == "mismatch"
    assert verified["leak_rate"]["n"] == 1
    assert verified["provenance"] == "verified"


def test_rows_are_ranked_by_leak_rate_then_over_redaction(benchmark_case):
    _run(benchmark_case, tool="adobe-acrobat", tp=5, fn=5)
    _run(benchmark_case, tool="nitro-pdf", tp=10, fn=0, fp=4, tn=0)
    _run(benchmark_case, tool="pdf-redaction", tp=10, fn=0, fp=1, tn=3)

    assert [row["tool"]["slug"] for row in _rows(benchmark_case)] == [
        "pdf-redaction",
        "nitro-pdf",
        "adobe-acrobat",
    ]


def test_a_row_says_who_published_its_runs_and_how_the_document_fared(benchmark_case, second_case):
    _run(benchmark_case, tp=1, fn=0, name="Tool Owner", role="owner", text_retention=0.93)
    _run(second_case, tp=1, fn=0, name="Staff", role="staff", gates_passed=False)

    [row] = _rows(benchmark_case)
    assert row["submitters"] == [
        {"name": "Staff", "role": "staff"},
        {"name": "Tool Owner", "role": "owner"},
    ]
    assert row["lowest_text_retention"] == pytest.approx(0.93)
    assert row["gates_failed"] == 1
