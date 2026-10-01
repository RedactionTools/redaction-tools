"""A benchmark submission mails its submitter at each step, and staff when it needs review.

Sent, scored (or failed), then approved or rejected: the submitter hears about each.
Staff hear once, when a submission is scored and waiting for them. A staff member's
own submission approves itself, so it mails nobody.
"""

import pytest
from django.core import mail

from apps.benchmarks import scoring, services
from apps.benchmarks.models import SubmissionStatus

pytestmark = pytest.mark.django_db


@pytest.fixture
def capture(django_capture_on_commit_callbacks):
    def run(fn, **kwargs):
        with django_capture_on_commit_callbacks(execute=True):
            return fn(**kwargs)

    return run


def _send(user, case, run_files, capture):
    submission = services.open_submission(
        user=user, suite="pdf", tool="pdf-redaction", surface="web", origin="upload"
    )
    services.add_output(
        user=user, submission=submission, case_id=case.case_id, pdf=run_files["pdf"]
    )
    capture(services.finalize, user=user, submission=submission)
    submission.refresh_from_db()
    return submission


def _to(address):
    return [message for message in mail.outbox if address in message.to]


def _subjects(address):
    return [message.subject for message in _to(address)]


def test_sending_a_submission_is_acknowledged(user, benchmark_case, run_files, capture):
    submission = _send(user, benchmark_case, run_files, capture)

    receipt = _to("user@example.com")[0]
    assert receipt.subject == f"Scoring your {submission.tool.name} benchmark submission"
    assert "1 case" in receipt.body


def test_a_scored_submission_tells_the_submitter_it_awaits_review(
    user, benchmark_case, run_files, capture
):
    submission = _send(user, benchmark_case, run_files, capture)

    assert submission.status == SubmissionStatus.PENDING_REVIEW
    assert _subjects("user@example.com")[1] == (
        f"Your {submission.tool.name} results are scored and waiting for review"
    )


def test_staff_are_told_a_scored_submission_awaits_review(
    user, benchmark_case, run_files, capture, settings
):
    settings.BACKEND_URL = "https://backend.redaction-tools.com"

    submission = _send(user, benchmark_case, run_files, capture)

    [notice] = _to("staff@example.com")
    assert notice.subject == f"Benchmark submission to review: {submission.tool.name}"
    assert "Test User" in notice.body
    admin = (
        f"https://backend.redaction-tools.com/admin/benchmarks/submission/{submission.pk}/change/"
    )
    assert admin in notice.body


def test_a_failed_scoring_says_why_and_bothers_no_staff(
    user, benchmark_case, run_files, capture, monkeypatch
):
    def explode(*args, **kwargs):
        raise RuntimeError("pdfium could not open the file")

    monkeypatch.setattr(scoring, "_score", explode)

    submission = _send(user, benchmark_case, run_files, capture)

    failed = _to("user@example.com")[1]
    assert failed.subject == f"Scoring failed for your {submission.tool.name} submission"
    assert "pdfium could not open the file" in failed.body
    assert _to("staff@example.com") == []


def test_approval_tells_the_submitter_where_the_results_are(
    user, staff_user, benchmark_case, run_files, capture
):
    submission = _send(user, benchmark_case, run_files, capture)
    mail.outbox.clear()

    capture(
        services.review, user=staff_user, submission=submission, status=SubmissionStatus.APPROVED
    )

    [approved] = mail.outbox
    assert approved.to == ["user@example.com"]
    assert approved.subject == f"Your {submission.tool.name} results are published"
    assert "/benchmarks/pdf/tools/pdf-redaction" in approved.body


def test_rejection_passes_on_the_reviewers_note(
    user, staff_user, benchmark_case, run_files, capture
):
    submission = _send(user, benchmark_case, run_files, capture)
    mail.outbox.clear()

    capture(
        services.review,
        user=staff_user,
        submission=submission,
        status=SubmissionStatus.REJECTED,
        note="The output was produced by a different tier than declared.",
    )

    [rejected] = mail.outbox
    assert rejected.subject == f"Your {submission.tool.name} submission was not approved"
    assert "different tier than declared" in rejected.body


def test_a_staff_members_own_submission_mails_nobody(
    staff_user, benchmark_case, run_files, capture
):
    submission = _send(staff_user, benchmark_case, run_files, capture)

    assert submission.status == SubmissionStatus.APPROVED
    assert mail.outbox == []
