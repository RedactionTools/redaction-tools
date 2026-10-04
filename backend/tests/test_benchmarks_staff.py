"""Benchmark review as plain functions: the rules the staff MCP tools wrap."""

import copy
import io

import pytest
from PIL import Image

from apps.benchmarks import services, staff
from apps.benchmarks.models import RunStatus, ScreenshotStatus, SubmissionStatus
from apps.catalog.staff import StaffError

pytestmark = pytest.mark.django_db


@pytest.fixture
def pending(user, benchmark_case, run_files):
    """A CLI submission awaiting review, whose report our rescore disagrees with."""
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


def _png():
    buffer = io.BytesIO()
    Image.new("RGB", (40, 30), "white").save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def pending_screenshot(user, staff_user, pending):
    """A screenshot added after its run was approved, so it waits for an editor."""
    run = pending.runs.get()
    run.status = RunStatus.SCORED
    run.save(update_fields=["status"])
    services.review(user=staff_user, submission=pending, status=SubmissionStatus.APPROVED)
    (shot,) = services.add_screenshots(user=user, run=run, images=[_png()])
    return shot


def test_the_queue_lists_submissions_awaiting_review(pending):
    page = staff.list_submissions(status="pending_review")

    (row,) = page["items"]
    assert page["count"] == 1
    assert (row["id"], row["tool"]["slug"], row["status"]) == (
        pending.pk,
        "pdf-redaction",
        "pending_review",
    )


def test_an_unknown_status_is_refused_by_name():
    with pytest.raises(StaffError, match="status must be one of"):
        staff.list_submissions(status="waiting")


def test_a_submission_shows_where_our_rescore_disagrees(pending):
    detail = staff.get_submission(submission_id=pending.pk)

    (run,) = detail["runs"]
    assert run["verification"] == "mismatch"
    assert run["verification_diff"]["counts.FN"]["claimed"] == 0
    assert run["overlay_url"].endswith(".png")
    assert run["output_pdf_url"].endswith(".pdf")
    assert set(run["reach"]) == {"image_text", "text_layer"}


def test_staff_see_a_holdout_run_whole(pending):
    case = pending.runs.get().case
    case.visibility = "holdout"
    case.save(update_fields=["visibility"])

    (run,) = staff.get_submission(submission_id=pending.pk)["runs"]

    assert (run["holdout"], run["case_id"]) == (True, "extraction-conditions-1")


def test_an_unknown_submission_is_refused():
    with pytest.raises(StaffError, match="No submission"):
        staff.get_submission(submission_id="00000000-0000-0000-0000-000000000000")


def test_approving_publishes_the_submission_and_records_who_decided(pending, staff_user):
    detail = staff.review_submission(
        user=staff_user, submission_id=pending.pk, status="approved", note="Matches our rescore."
    )

    pending.refresh_from_db()
    assert (detail["status"], pending.status, pending.reviewed_by) == (
        "approved",
        SubmissionStatus.APPROVED,
        staff_user,
    )


def test_a_rejection_without_a_note_is_refused(pending, staff_user):
    with pytest.raises(StaffError, match="Say why"):
        staff.review_submission(user=staff_user, submission_id=pending.pk, status="rejected")


def test_only_staff_review(pending, user):
    with pytest.raises(StaffError, match="Only Redaction Tools staff"):
        staff.review_submission(user=user, submission_id=pending.pk, status="approved")


def test_screenshots_awaiting_an_editor_are_listed(pending_screenshot):
    page = staff.list_screenshots(status="pending")

    (row,) = page["items"]
    assert (row["id"], row["run_id"]) == (pending_screenshot.pk, pending_screenshot.run.run_id)


def test_publishing_a_screenshot(pending_screenshot, staff_user):
    result = staff.publish_screenshots(user=staff_user, screenshot_ids=[pending_screenshot.pk])

    pending_screenshot.refresh_from_db()
    assert (result["published"], pending_screenshot.status) == (1, ScreenshotStatus.PUBLISHED)


def test_publishing_an_unknown_screenshot_names_it(pending_screenshot, staff_user):
    with pytest.raises(StaffError, match="999999"):
        staff.publish_screenshots(user=staff_user, screenshot_ids=[pending_screenshot.pk, 999999])


def test_suites_list_their_revisions_and_queue(pending):
    (suite,) = [s for s in staff.list_suites() if s["slug"] == "pdf"]

    (revision,) = suite["revisions"]
    assert (revision["revision"], revision["is_current"], revision["cases"]) == ("v0.1.1", True, 1)
    assert suite["awaiting_review"] == 1


def test_the_leaderboard_is_the_one_the_site_shows(pending_screenshot):
    board = staff.get_leaderboard(suite="pdf")

    (row,) = board["rows"]
    assert (board["revision"], row["tool"]["slug"], row["counts"]["TP"]) == (
        "v0.1.1",
        "pdf-redaction",
        pending_screenshot.run.tp,
    )


def test_an_unknown_suite_is_refused():
    with pytest.raises(StaffError, match="no benchmark suite"):
        staff.get_leaderboard(suite="video")
