"""Badge states - what an owner's embeddable badge is allowed to claim.

Every badge needs a listable tool first. A badge that no longer holds goes grey on
the owner's site, so these flags are the whole of what one can claim.
"""

import pytest
from django.utils import timezone

from apps.benchmarks.models import (
    ScoredBy,
    Submission,
    SubmissionStatus,
    SubmitterRole,
    Verification,
)
from apps.catalog.badges import badge_states
from apps.catalog.models import Tool, ToolStatus

pytestmark = pytest.mark.django_db


def test_a_listable_tool_is_listed_and_nothing_more():
    tool = Tool.objects.get(slug="pdf-redaction")
    assert tool.is_listable()

    assert badge_states(tool) == {
        "listed": True,
        "reviewed": False,
        "benchmarked": False,
        "benchmark_suites": [],
    }


def test_a_tool_editors_have_reviewed_is_reviewed():
    tool = Tool.objects.get(slug="pdf-redaction")
    tool.editorial_reviewed_at = timezone.now()

    assert badge_states(tool)["reviewed"] is True


def test_a_benchmarked_tool_names_the_suites_it_has_results_in(benchmark_case):
    _approved_run(benchmark_case, tool="pdf-redaction")

    states = badge_states(Tool.objects.get(slug="pdf-redaction"))

    assert states["benchmarked"] is True
    assert states["benchmark_suites"] == [
        {"suite": benchmark_case.revision.suite.slug, "name": benchmark_case.revision.suite.name}
    ]


def test_a_tool_taken_down_claims_nothing_however_it_was_reviewed_or_scored(benchmark_case):
    _approved_run(benchmark_case, tool="pdf-redaction")
    tool = Tool.objects.get(slug="pdf-redaction")
    tool.editorial_reviewed_at = timezone.now()
    tool.status = ToolStatus.DRAFT

    assert badge_states(tool) == {
        "listed": False,
        "reviewed": False,
        "benchmarked": False,
        "benchmark_suites": [],
    }


def test_the_public_route_reports_the_badges_without_signing_in(client):
    Tool.objects.filter(slug="pdf-redaction").update(editorial_reviewed_at=timezone.now())

    response = client.get("/api/v1/catalog/tools/pdf-redaction/badges")

    assert response.status_code == 200
    assert response.json() == {
        "listed": True,
        "reviewed": True,
        "benchmarked": False,
        "benchmark_suites": [],
    }


def _approved_run(case, *, tool):
    submission = Submission.objects.create(
        suite=case.revision.suite,
        revision=case.revision,
        tool=Tool.objects.get(slug=tool),
        surface="web",
        origin="upload",
        submitter_name="Staff",
        submitter_role=SubmitterRole.STAFF,
        status=SubmissionStatus.APPROVED,
        reviewed_at=timezone.now(),
    )
    return submission.runs.create(
        case=case,
        run_id="run-1",
        status="scored",
        output_pdf="benchmarks/x/out.pdf",
        output_sha256="0" * 64,
        thresholds_digest="t1",
        scored_by=ScoredBy.SERVER,
        verification=Verification.NOT_NEEDED,
        text_retention=1.0,
        gates_passed=True,
    )


def test_an_unknown_slug_gets_nothing_to_claim_rather_than_a_404(client):
    response = client.get("/api/v1/catalog/tools/no-such-tool/badges")

    assert response.status_code == 200
    assert response.json()["listed"] is False
