"""Mail about a benchmark submission.

The submitter hears at each step: sent, scored (or failed), then approved or
rejected. Staff hear once, when a scored submission is waiting for them. A staff
member's own submission approves itself, so it mails nobody.

Every email is its own task, queued once the change commits: the request or
scoring worker never waits on the mail provider, and a retry resends one email,
not its siblings.
"""

from django.conf import settings
from django.db import transaction
from django.urls import reverse

from apps.benchmarks.models import RunStatus, Submission, SubmissionStatus, SubmitterRole
from apps.core.email import send_templated_email, staff_addresses

# A scorer traceback is for our logs; the submitter gets the gist.
MAX_ERROR_CHARS = 300


def queue_sent(submission):
    _queue(submission, "send_sent")


def queue_scored(submission):
    _queue(submission, "send_scored")
    if submission.status == SubmissionStatus.PENDING_REVIEW:
        _queue(submission, "send_staff_notice")


def queue_reviewed(submission):
    _queue(submission, "send_reviewed")


def _queue(submission, task):
    if submission.submitter_role == SubmitterRole.STAFF or submission.submitted_by_id is None:
        return
    from django_q.tasks import async_task

    transaction.on_commit(
        lambda: async_task(
            f"apps.benchmarks.emails.{task}",
            submission.pk,
            task_name=f"benchmark {task} {submission.pk}"[:100],
        )
    )


def send_sent(submission_pk):
    submission = _load(submission_pk)
    _send_to_submitter("benchmark_sent", submission)


def send_scored(submission_pk):
    submission = _load(submission_pk)
    failed = submission.runs.filter(status=RunStatus.FAILED).select_related("case")
    _send_to_submitter(
        "benchmark_scored",
        submission,
        failed=submission.status == SubmissionStatus.SCORING_FAILED,
        failures=[
            {"case": run.case.case_id, "error": run.error[:MAX_ERROR_CHARS]} for run in failed
        ],
    )


def send_staff_notice(submission_pk):
    staff = staff_addresses()
    if not staff:
        return
    submission = _load(submission_pk)
    admin_path = reverse("admin:benchmarks_submission_change", args=[submission.pk])
    send_templated_email(
        "benchmark_staff_notice",
        {
            **_context(submission),
            "submitter_name": submission.submitter_name,
            "submitter_role": submission.get_submitter_role_display(),
            "origin": submission.get_origin_display(),
            "notes": submission.notes,
            "admin_url": f"{settings.BACKEND_URL}{admin_path}",
        },
        to=staff,
    )


def send_reviewed(submission_pk):
    submission = _load(submission_pk)
    _send_to_submitter(
        "benchmark_reviewed",
        submission,
        approved=submission.status == SubmissionStatus.APPROVED,
        review_note=submission.review_note,
    )


def _load(submission_pk):
    return Submission.objects.select_related("suite", "revision", "tool", "submitted_by").get(
        pk=submission_pk
    )


def _context(submission):
    return {
        "tool_name": submission.tool.name,
        "tool_slug": submission.tool.slug,
        "suite_name": submission.suite.name,
        "suite_slug": submission.suite.slug,
        "revision": submission.revision.revision,
        "case_count": submission.runs.count(),
    }


def _send_to_submitter(name, submission, **extra):
    send_templated_email(
        name, {**_context(submission), **extra}, to=[submission.submitted_by.email]
    )
