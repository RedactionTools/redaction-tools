"""The review queue in the admin: where an editor approves or rejects a submission."""

import copy

import pytest

from apps.benchmarks import services
from apps.benchmarks.models import Submission, SubmissionStatus

pytestmark = pytest.mark.django_db

CHANGELIST = "/admin/benchmarks/submission/"


@pytest.fixture
def pending(user, benchmark_case, run_files):
    """A CLI submission whose report our rescore disagrees with."""
    flattering = copy.deepcopy(run_files["report"])
    flattering["summary"]["counts"].update({"TP": 54, "FN": 0})
    submission = services.open_submission(
        user=user, suite="pdf", tool="pdf-redaction", surface="web", origin="cli"
    )
    services.add_scored_run(
        user=user,
        submission=submission,
        manifest=run_files["manifest"],
        report=flattering,
        overlay=run_files["overlay"],
        pdf=run_files["pdf"],
    )
    return services.finalize(user=user, submission=submission)


def _act(admin_client, action, submission):
    return admin_client.post(
        CHANGELIST, {"action": action, "_selected_action": [str(submission.pk)]}, follow=True
    )


def test_the_queue_lists_pending_submissions(admin_client, pending):
    response = admin_client.get(f"{CHANGELIST}?status__exact=pending_review")

    assert response.status_code == 200
    assert "pdf-redaction:web" in response.content.decode()


def test_the_change_page_shows_where_our_rescore_disagrees(admin_client, pending):
    response = admin_client.get(f"{CHANGELIST}{pending.pk}/change/")

    body = response.content.decode()
    assert response.status_code == 200
    assert "counts.FN" in body
    assert "mismatch" in body.lower()


def test_approving_publishes_it(admin_client, staff_user, pending):
    _act(admin_client, "approve_submissions", pending)

    pending.refresh_from_db()
    assert pending.status == SubmissionStatus.APPROVED
    assert pending.reviewed_by == staff_user


def test_rejecting_without_a_note_is_refused_and_says_so(admin_client, pending):
    response = _act(admin_client, "reject_submissions", pending)

    pending.refresh_from_db()
    assert pending.status == SubmissionStatus.PENDING_REVIEW
    assert "review note" in response.content.decode()


def test_rejecting_with_a_note_records_it(admin_client, pending):
    Submission.objects.filter(pk=pending.pk).update(review_note="Counts do not reproduce.")

    _act(admin_client, "reject_submissions", pending)

    pending.refresh_from_db()
    assert pending.status == SubmissionStatus.REJECTED
    assert pending.review_note == "Counts do not reproduce."
