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


# --- screenshots ---------------------------------------------------------------------

SCREENSHOTS = "/admin/benchmarks/runscreenshot/"


def _png():
    import io

    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (640, 400), (20, 120, 200)).save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def pending_screenshot(user, staff_user, pending):
    from apps.benchmarks.models import RunStatus

    run = pending.runs.get()
    run.status = RunStatus.SCORED
    run.save(update_fields=["status"])
    services.review(user=staff_user, submission=pending, status=SubmissionStatus.APPROVED)
    (shot,) = services.add_screenshots(user=user, run=run, images=[_png()])
    return shot


def test_a_submissions_page_shows_each_runs_screenshots(admin_client, pending):
    services.add_screenshots(user=pending.submitted_by, run=pending.runs.get(), images=[_png()])

    body = admin_client.get(f"{CHANGELIST}{pending.pk}/change/").content.decode()

    assert "screenshot.png" in body


def test_screenshots_awaiting_an_editor_are_listed(admin_client, pending_screenshot):
    response = admin_client.get(f"{SCREENSHOTS}?status__exact=pending")

    assert response.status_code == 200
    assert pending_screenshot.run.run_id in response.content.decode()


def test_an_editor_publishes_a_screenshot_from_the_list(admin_client, pending_screenshot):
    admin_client.post(
        SCREENSHOTS,
        {"action": "publish_screenshots", "_selected_action": [str(pending_screenshot.pk)]},
        follow=True,
    )

    pending_screenshot.refresh_from_db()
    assert pending_screenshot.status == "published"


@pytest.fixture
def published_run(staff_user, pending):
    from apps.benchmarks.models import RunStatus

    run = pending.runs.get()
    run.status = RunStatus.SCORED
    run.save(update_fields=["status"])
    services.review(user=staff_user, submission=pending, status=SubmissionStatus.APPROVED)
    return run


def _upload(name, data):
    from django.core.files.uploadedfile import SimpleUploadedFile

    return SimpleUploadedFile(name, data, content_type="image/png")


def test_an_editor_adds_screenshots_to_a_published_run(admin_client, published_run):
    response = admin_client.post(
        f"{SCREENSHOTS}add/",
        {"run": published_run.pk, "images": [_upload("a.png", _png()), _upload("b.png", _png())]},
        follow=True,
    )

    assert response.status_code == 200
    shots = list(published_run.screenshots.all())
    # Same bytes twice is one screenshot: the service skips what the run already holds.
    assert len(shots) == 1
    assert shots[0].status == "published"


def test_the_admin_says_why_a_screenshot_was_refused(admin_client, published_run):
    response = admin_client.post(
        f"{SCREENSHOTS}add/",
        {"run": published_run.pk, "images": [_upload("a.png", b"not an image")]},
        follow=True,
    )

    assert published_run.screenshots.count() == 0
    assert "Screenshot 1" in response.content.decode()


# --- rescore and drafts -------------------------------------------------------------


def test_an_editor_rescores_a_submission_from_the_list(admin_client, pending):
    from apps.benchmarks.models import RunStatus

    # As a worker restart leaves it: sent, the run never scored.
    Submission.objects.filter(pk=pending.pk).update(status=SubmissionStatus.SCORING)
    pending.runs.update(status=RunStatus.QUEUED)

    response = _act(admin_client, "rescore_submissions", pending)

    pending.refresh_from_db()
    assert pending.runs.get().status == RunStatus.SCORED
    assert pending.status == SubmissionStatus.PENDING_REVIEW
    assert "1 submission(s) queued for scoring" in response.content.decode()


def test_the_admin_says_why_a_draft_is_not_rescored(admin_client, user, benchmark_case, run_files):
    draft = services.open_submission(
        user=user, suite="pdf", tool="pdf-redaction", surface="web", origin="upload"
    )
    services.add_output(
        user=user, submission=draft, case_id=benchmark_case.case_id, pdf=run_files["pdf"]
    )

    response = _act(admin_client, "rescore_submissions", draft)

    assert "never sent" in response.content.decode()


def test_a_drafts_runs_read_not_sent_rather_than_queued(
    admin_client, user, benchmark_case, run_files
):
    draft = services.open_submission(
        user=user, suite="pdf", tool="pdf-redaction", surface="web", origin="upload"
    )
    services.add_output(
        user=user, submission=draft, case_id=benchmark_case.case_id, pdf=run_files["pdf"]
    )

    body = admin_client.get(f"{CHANGELIST}{draft.pk}/change/").content.decode()

    assert "Not sent" in body
