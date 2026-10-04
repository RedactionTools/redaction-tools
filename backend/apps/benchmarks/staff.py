"""Benchmark review, as plain functions.

What the staff MCP tools call. Same shape as `apps.comments.staff`: no request, no
transport, `user` explicit on every write, and refusals raised as `StaffError`. The
writes themselves are `services.review` and `services.publish_screenshots` - the ones
the admin calls - so a decision made from Claude follows the admin's rules and sends
the admin's emails.
"""

import contextlib

from django.core.exceptions import ValidationError

from apps.benchmarks import leaderboard, services
from apps.benchmarks.files import media_url
from apps.benchmarks.models import (
    CaseVisibility,
    RunScreenshot,
    ScreenshotStatus,
    Submission,
    SubmissionStatus,
    Suite,
)
from apps.catalog.staff import StaffError


@contextlib.contextmanager
def _as_staff_error():
    """The service's refusals, in the error every staff surface already handles."""
    try:
        yield
    except services.BenchmarkError as exc:
        raise StaffError(str(exc)) from exc


def _choice(value, choices, name):
    if value not in choices.values:
        raise StaffError(f"{name} must be one of: {', '.join(choices.values)}.")
    return value


def _submission_row(submission):
    """A submission as the queue lists it."""
    runs = list(submission.runs.all())
    return {
        "id": submission.pk,
        "suite": submission.suite.slug,
        "revision": submission.revision.revision,
        "tool": leaderboard.tool_ref(submission.tool),
        "surface": submission.surface,
        "tier": submission.tier,
        "origin": submission.origin,
        "status": submission.status,
        "submitter": {"name": submission.submitter_name, "role": submission.submitter_role},
        "runs": len(runs),
        "verification": sorted({run.verification for run in runs}),
        "submitted_at": submission.submitted_at,
        "reviewed_at": submission.reviewed_at,
    }


def list_submissions(*, status=None, suite=None, tool=None, limit=20, offset=0):
    """Submissions, newest first. Filter to `pending_review` for the queue."""
    submissions = (
        Submission.objects.select_related("suite", "revision", "tool")
        .prefetch_related("runs")
        .order_by("-submitted_at", "-created_at")
    )
    if status is not None:
        submissions = submissions.filter(status=_choice(status, SubmissionStatus, "status"))
    if suite is not None:
        submissions = submissions.filter(suite__slug=suite)
    if tool is not None:
        submissions = submissions.filter(tool__slug=tool)
    return {
        "count": submissions.count(),
        "items": [_submission_row(s) for s in submissions[offset : offset + limit]],
    }


def _screenshot_row(shot):
    return {
        "id": shot.pk,
        "run_id": shot.run.run_id,
        "status": shot.status,
        "url": media_url(shot.image.name),
        "width": shot.width,
        "height": shot.height,
        "created_at": shot.created_at,
    }


def _run_row(run):
    """A run as a reviewer weighs it. Unlike the public view, a holdout is shown whole:
    the reviewer is who decides whether its result is believable."""
    # pdfredeval's own Wilson rate, as `api.run_leak_rate` computes it - imported from
    # the scorer rather than from the API, which would bring ninja into this module.
    from pdfredeval.score.metrics import rate

    return {
        "run_id": run.run_id,
        "case_id": run.case.case_id,
        "family": run.case.family,
        "holdout": run.case.visibility == CaseVisibility.HOLDOUT,
        "status": run.status,
        "error": run.error,
        "scored_by": run.scored_by,
        "verification": run.verification,
        "verification_diff": run.verification_diff,
        "counts": {"TP": run.tp, "FN": run.fn, "FP": run.fp, "TN": run.tn},
        "leak_rate": rate(run.fn, run.tp + run.fn).to_dict(),
        "weighted_leak_rate": run.weighted_leak_rate,
        "text_retention": run.text_retention,
        "gates_passed": run.gates_passed,
        "reach": run.report.get("reach") or {},
        "overlay_url": media_url(run.overlay.name),
        "output_pdf_url": media_url(run.output_pdf.name),
        "screenshots": [_screenshot_row(shot) for shot in run.screenshots.all()],
    }


def _get(submission_id):
    try:
        submission = (
            Submission.objects.select_related("suite", "revision", "tool", "reviewed_by")
            .filter(pk=submission_id)
            .first()
        )
    except ValidationError:
        submission = None
    if submission is None:
        raise StaffError(f"No submission with id {submission_id}.")
    return submission


def get_submission(*, submission_id):
    """One submission whole: what was claimed, what we measured, and the evidence."""
    submission = _get(submission_id)
    runs = submission.runs.select_related("case").prefetch_related("screenshots__run")
    return _submission_row(submission) | {
        "tool_version": submission.tool_version,
        "notes": submission.notes,
        "review_note": submission.review_note,
        "reviewed_by": submission.reviewed_by.name if submission.reviewed_by else None,
        "runs": [_run_row(run) for run in runs],
    }


def review_submission(*, user, submission_id, status, note=""):
    """Approve or reject a submission whole. Approval publishes every run in it, and
    either decision emails the submitter - `services.review`, as the admin calls it."""
    submission = _get(submission_id)
    with _as_staff_error():
        services.review(user=user, submission=submission, status=status, note=note)
    return get_submission(submission_id=submission.pk)


def list_screenshots(*, status=ScreenshotStatus.PENDING, limit=20, offset=0):
    """Run screenshots, newest first. Pending ones were added after their run was
    approved, so no review has seen them yet."""
    shots = (
        RunScreenshot.objects.select_related("run__submission__tool")
        .filter(status=_choice(status, ScreenshotStatus, "status"))
        .order_by("-created_at", "-pk")
    )
    return {
        "count": shots.count(),
        "items": [
            _screenshot_row(shot)
            | {
                "submission_id": shot.run.submission_id,
                "tool": leaderboard.tool_ref(shot.run.submission.tool),
            }
            for shot in shots[offset : offset + limit]
        ],
    }


def publish_screenshots(*, user, screenshot_ids):
    """Publish pending screenshots. An id that is not pending is named, and nothing is
    published, so a mistyped id cannot pass for a done job."""
    ids = set(screenshot_ids)
    shots = list(RunScreenshot.objects.filter(pk__in=ids, status=ScreenshotStatus.PENDING))
    missing = sorted(ids - {shot.pk for shot in shots})
    if missing:
        raise StaffError(
            f"No pending screenshot with id {', '.join(map(str, missing))}. "
            "benchmarks_list_screenshots lists the pending ones."
        )
    with _as_staff_error():
        published = services.publish_screenshots(user=user, screenshots=shots)
    return {"published": published}


def list_suites():
    """Every suite, public or not, with its revisions and how many submissions wait."""
    suites = Suite.objects.prefetch_related("revisions__cases").order_by("slug")
    return [
        {
            "slug": suite.slug,
            "name": suite.name,
            "is_public": suite.is_public,
            "revisions": [
                {
                    "revision": revision.revision,
                    "is_current": revision.is_current,
                    "published_at": revision.published_at,
                    "cases": len(revision.cases.all()),
                    "holdout_cases": sum(
                        1
                        for case in revision.cases.all()
                        if case.visibility == CaseVisibility.HOLDOUT
                    ),
                }
                for revision in suite.revisions.all()
            ],
            "awaiting_review": suite.submissions.filter(
                status=SubmissionStatus.PENDING_REVIEW
            ).count(),
        }
        for suite in suites
    ]


def get_leaderboard(*, suite, revision=None, scope="all"):
    """The leaderboard as the site builds it, for any revision and for a suite that is
    not public yet."""
    found = Suite.objects.filter(slug=suite).first()
    if found is None:
        raise StaffError(f"There is no benchmark suite called {suite!r}.")
    if scope not in leaderboard.SCOPES:
        raise StaffError(f"scope must be one of: {', '.join(leaderboard.SCOPES)}.")
    revisions = found.revisions.all()
    chosen = (
        revisions.filter(revision=revision) if revision else revisions.filter(is_current=True)
    ).first()
    if chosen is None:
        raise StaffError(f"The {found.name} benchmark has no revision {revision or 'yet'}.")
    return {
        "suite": found.slug,
        "revision": chosen.revision,
        "is_current": chosen.is_current,
        "scope": scope,
        "rows": leaderboard.build(chosen, scope=scope),
    }
