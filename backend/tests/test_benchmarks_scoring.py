"""Sending a submission: we score it (or rescore it), then an editor reviews it.

django-q runs synchronously under the test settings, so `finalize` returns with every
run already scored. OCR is off (`BENCHMARK_OCR`), which the fixture tolerates: the
pdf-redaction:web run leaks the same 12 values with or without it.
"""

import copy

import pytest

from apps.benchmarks import scoring, services
from apps.benchmarks.models import (
    RunStatus,
    SubmissionOrigin,
    SubmissionStatus,
    Verification,
)
from apps.benchmarks.services import BenchmarkError

pytestmark = pytest.mark.django_db


def _uploaded(user, case, run_files):
    submission = services.open_submission(
        user=user, suite="pdf", tool="pdf-redaction", surface="web", origin="upload"
    )
    services.add_output(
        user=user, submission=submission, case_id=case.case_id, pdf=run_files["pdf"]
    )
    return submission


def _published(user, run_files, report=None):
    submission = services.open_submission(
        user=user, suite="pdf", tool="pdf-redaction", surface="web", origin=SubmissionOrigin.CLI
    )
    services.add_scored_run(
        user=user,
        submission=submission,
        manifest=run_files["manifest"],
        report=report or run_files["report"],
        overlay=run_files["overlay"],
        pdf=run_files["pdf"],
    )
    return submission


# --- scoring ---------------------------------------------------------------------


def test_an_uploaded_submission_is_scored_and_waits_for_review(user, benchmark_case, run_files):
    submission = _uploaded(user, benchmark_case, run_files)

    services.finalize(user=user, submission=submission)

    submission.refresh_from_db()
    run = submission.runs.get()
    assert submission.status == SubmissionStatus.PENDING_REVIEW
    assert submission.submitted_at is not None
    assert run.status == RunStatus.SCORED
    assert (run.tp, run.fn) == (42, 12)
    assert run.report["summary"]["counts"]["FN"] == 12
    assert run.report["manifest"]["run_id"] == run.run_id
    assert run.scorer_version
    assert run.thresholds_digest
    assert run.overlay.name.endswith("overlay.png")


def test_a_staff_submission_is_published_once_scored(staff_user, benchmark_case, run_files):
    submission = _uploaded(staff_user, benchmark_case, run_files)

    services.finalize(user=staff_user, submission=submission)

    submission.refresh_from_db()
    assert submission.status == SubmissionStatus.APPROVED
    assert submission.reviewed_by == staff_user


def test_an_empty_submission_cannot_be_sent(user, benchmark_case):
    submission = services.open_submission(
        user=user, suite="pdf", tool="pdf-redaction", surface="web", origin="upload"
    )

    with pytest.raises(BenchmarkError, match="no runs"):
        services.finalize(user=user, submission=submission)


def test_a_run_the_scorer_cannot_score_fails_the_submission_and_says_why(
    user, benchmark_case, run_files, monkeypatch
):
    def explode(*args, **kwargs):
        raise RuntimeError("pdfium could not open the file")

    monkeypatch.setattr(scoring, "_score", explode)
    submission = _uploaded(user, benchmark_case, run_files)

    services.finalize(user=user, submission=submission)

    submission.refresh_from_db()
    run = submission.runs.get()
    assert submission.status == SubmissionStatus.SCORING_FAILED
    assert run.status == RunStatus.FAILED
    assert "pdfium could not open the file" in run.error


# --- verifying a CLI score ---------------------------------------------------------


def test_a_cli_score_our_rescore_agrees_with_is_verified(user, benchmark_case, run_files):
    submission = _published(user, run_files)

    services.finalize(user=user, submission=submission)

    run = submission.runs.get()
    assert run.verification == Verification.VERIFIED
    assert run.report == run_files["report"]
    assert submission.__class__.objects.get(pk=submission.pk).status == (
        SubmissionStatus.PENDING_REVIEW
    )


def test_a_cli_score_that_flatters_the_tool_is_flagged_with_the_difference(
    user, benchmark_case, run_files
):
    flattering = copy.deepcopy(run_files["report"])
    flattering["summary"]["counts"].update({"TP": 54, "FN": 0})

    submission = _published(user, run_files, report=flattering)
    services.finalize(user=user, submission=submission)

    run = submission.runs.get()
    assert run.verification == Verification.MISMATCH
    assert run.verification_diff["counts.FN"] == {"claimed": 0, "ours": 12}
    # The claim is still what is stored - and what an editor sees beside our numbers.
    assert run.fn == 0


# --- review ------------------------------------------------------------------------


@pytest.fixture
def pending(user, benchmark_case, run_files):
    submission = _uploaded(user, benchmark_case, run_files)
    services.finalize(user=user, submission=submission)
    submission.refresh_from_db()
    return submission


def test_an_editor_approves_a_pending_submission(staff_user, pending):
    services.review(user=staff_user, submission=pending, status="approved")

    pending.refresh_from_db()
    assert pending.status == SubmissionStatus.APPROVED
    assert pending.reviewed_by == staff_user
    assert pending.reviewed_at is not None


def test_a_rejection_says_why(staff_user, pending):
    with pytest.raises(BenchmarkError, match="note"):
        services.review(user=staff_user, submission=pending, status="rejected")

    services.review(user=staff_user, submission=pending, status="rejected", note="Wrong tool.")
    pending.refresh_from_db()
    assert pending.review_note == "Wrong tool."


def test_only_staff_review(user, pending):
    with pytest.raises(BenchmarkError, match="staff"):
        services.review(user=user, submission=pending, status="approved")


def test_a_draft_is_not_reviewable(staff_user, user, benchmark_case):
    draft = services.open_submission(
        user=user, suite="pdf", tool="pdf-redaction", surface="web", origin="upload"
    )

    with pytest.raises(BenchmarkError, match="draft"):
        services.review(user=staff_user, submission=draft, status="approved")


def test_the_submitter_withdraws_until_it_is_approved(user, staff_user, pending):
    services.withdraw(user=user, submission=pending)
    pending.refresh_from_db()
    assert pending.status == SubmissionStatus.WITHDRAWN

    pending.status = SubmissionStatus.APPROVED
    pending.save()
    with pytest.raises(BenchmarkError, match="published"):
        services.withdraw(user=user, submission=pending)


def test_nobody_withdraws_someone_elses_submission(owner, pending):
    with pytest.raises(BenchmarkError, match="not yours"):
        services.withdraw(user=owner, submission=pending)
