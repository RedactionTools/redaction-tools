"""Score a run with the vendored pdfredeval, in the qcluster worker.

Untrusted PDFs are parsed here and nowhere else - never inside a web request - so a
file that hangs pdfium costs one worker slot up to `BENCHMARK_SCORE_TIMEOUT`, not a
gunicorn thread.

Two jobs, one pass:
- an uploaded output (`scored_by=server`) gets its report, headline and overlay from us;
- a CLI run (`scored_by=submitter`) keeps the submitter's report, and our rescore of the
  same bytes decides whether it is `verified` or a `mismatch`, with the difference kept
  for the editor who reviews it.
"""

import json
import logging
import math
import pathlib
import tempfile

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.benchmarks import files
from apps.benchmarks.files import FileRejected
from apps.benchmarks.models import (
    Run,
    RunStatus,
    ScoredBy,
    Submission,
    SubmissionStatus,
    SubmitterRole,
    Verification,
)

logger = logging.getLogger(__name__)

# The error a submitter sees is capped: a pdfium traceback is for our logs, not a page.
MAX_ERROR_CHARS = 500

# Fields a rescore must reproduce for a submitter's report to count as verified. Rates
# follow from the counts, so the counts carry the verdict; retention and the gate are
# checked too because they are how a tool's damage to the document is reported.
VERIFIED_COUNTS = ("TP", "FN", "FP", "TN", "unsupported", "undecided")
RATE_TOLERANCE = 1e-4


def enqueue(run):
    """Queue `run` for scoring. Inline under the test settings (`Q_CLUSTER.sync`)."""
    from django_q.tasks import async_task

    async_task(
        "apps.benchmarks.scoring.score_run",
        run.pk,
        task_name=f"score {run.run_id}"[:100],
        timeout=settings.BENCHMARK_SCORE_TIMEOUT,
    )


def score_run(run_pk):
    run = Run.objects.select_related("case", "submission").get(pk=run_pk)
    try:
        report, overlay = _score(run)
    except Exception as exc:
        # Any failure is a verdict about this run, recorded where the submitter sees it,
        # rather than a task django-q retries three times on the same bytes.
        logger.exception("Scoring %s failed", run.run_id)
        _fail(run, exc)
    else:
        _record(run, report, overlay)
    settle(run.submission_id)


def settle(submission_pk):
    """Move a submission on once none of its runs is still queued.

    Locked, because runs finish in parallel workers and each one calls this: without
    the lock two last-runs could both see "one still queued" and nobody settles it.
    """
    with transaction.atomic():
        submission = Submission.objects.select_for_update().get(pk=submission_pk)
        runs = submission.runs.all()
        if (
            submission.status != SubmissionStatus.SCORING
            or runs.filter(status=RunStatus.QUEUED).exists()
        ):
            return submission

        if runs.filter(status=RunStatus.FAILED).exists():
            submission.status = SubmissionStatus.SCORING_FAILED
        elif submission.submitter_role == SubmitterRole.STAFF:
            # Staff are the reviewers; queueing their own run for themselves is ceremony.
            submission.status = SubmissionStatus.APPROVED
            submission.reviewed_by_id = submission.submitted_by_id
            submission.reviewed_at = timezone.now()
        else:
            submission.status = SubmissionStatus.PENDING_REVIEW
        submission.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
        return submission


def compare(claimed, ours):
    """Where a submitter's report and our rescore disagree: `{field: {claimed, ours}}`."""
    diff = {}

    def check(key, a, b, *, tolerance=0.0):
        if a is None or b is None:
            same = a is b
        elif isinstance(a, bool) or isinstance(b, bool) or not tolerance:
            same = a == b
        else:
            same = math.isclose(float(a), float(b), abs_tol=tolerance)
        if not same:
            diff[key] = {"claimed": a, "ours": b}

    claimed_summary = claimed.get("summary") or {}
    our_summary = ours.get("summary") or {}
    for field in VERIFIED_COUNTS:
        check(
            f"counts.{field}",
            (claimed_summary.get("counts") or {}).get(field),
            (our_summary.get("counts") or {}).get(field),
        )
    for field in ("weighted_leak_rate", "text_retention"):
        check(
            f"summary.{field}",
            claimed_summary.get(field),
            our_summary.get(field),
            tolerance=RATE_TOLERANCE,
        )
    check(
        "survivability.passed",
        (claimed.get("survivability") or {}).get("passed"),
        (ours.get("survivability") or {}).get("passed"),
    )
    return diff


def _record(run, report, overlay):
    from pdfredeval import __version__ as scorer_version

    from apps.benchmarks.services import headline

    if run.scored_by == ScoredBy.SERVER:
        run.report = report
        for field, value in headline(report).items():
            setattr(run, field, value)
        run.scorer_version = scorer_version
    else:
        run.verification_diff = compare(run.report, report)
        run.verification = Verification.MISMATCH if run.verification_diff else Verification.VERIFIED

    if overlay and not run.overlay:
        try:
            stored = files.store_overlay(overlay)
        except FileRejected:
            logger.warning("Overlay for %s could not be stored", run.run_id)
        else:
            run.overlay, run.overlay_widths = stored.path, stored.widths

    run.status = RunStatus.SCORED
    run.error = ""
    run.save()


def _fail(run, exc):
    if run.scored_by == ScoredBy.SUBMITTER:
        # Their report still stands; we just could not check it, and say so.
        run.status = RunStatus.SCORED
        run.verification = Verification.FAILED
    else:
        run.status = RunStatus.FAILED
    run.error = f"{type(exc).__name__}: {exc}"[:MAX_ERROR_CHARS]
    run.save(update_fields=["status", "verification", "error", "updated_at"])


def _score(run):
    """`(report dict, overlay PNG bytes or None)` for `run`, from our own scorer."""
    from pdfredeval.manifest import RunManifest
    from pdfredeval.report import overlay as overlay_renderer
    from pdfredeval.score.scorer import score
    from pdfredeval.types import Case

    case_row = run.case
    output = files.read(run.output_pdf.name)
    with tempfile.TemporaryDirectory(prefix="pdfredeval-") as scratch:
        workdir = pathlib.Path(scratch)
        case_dir = workdir / case_row.case_id
        case_dir.mkdir()
        (case_dir / f"{case_row.case_id}.pdf").write_bytes(files.read(case_row.pdf.name))
        (case_dir / "ground_truth.json").write_text(json.dumps(case_row.ground_truth))
        case = Case.from_dir(case_dir, dataset_revision=case_row.revision.revision)

        result = score(
            case,
            output,
            manifest=RunManifest.from_dict(run.manifest),
            ocr_enabled=settings.BENCHMARK_OCR,
        )
        # Through JSON once, as `pdfredeval score` writes it: numpy scalars and paths
        # become what a JSONField can hold, and the stored report is byte-for-byte the
        # shape the CLI would have published.
        report = json.loads(json.dumps(result.report(), sort_keys=True, default=str))

        boxes = {probe.id: probe.bbox for probe in case.probes}
        rows = [
            {"probe_id": row.probe_id, "outcome": row.outcome, "bbox": boxes.get(row.probe_id)}
            for row in result.rows
        ]
        drawn = overlay_renderer.render(case, output, rows, workdir / "overlay", prefix="run")
        overlay = drawn.overlay.read_bytes() if drawn.overlay else None
    return report, overlay
