"""The benchmarks API: public reads, and the writes that publish results.

Route function names are the operation ids and therefore the generated hook names -
`get_benchmark_suite` becomes `useGetBenchmarkSuite()`. They must stay unique across the
whole API; `tests/test_openapi_schema.py` enforces that.

What the public sees is approved runs only, and never a holdout case's files or id, and
never a case's ground truth: no schema here has a field that could carry it.
"""

import json
from typing import Literal
from uuid import UUID

from django.conf import settings
from django.db.models import Count, Q
from django.http import HttpRequest
from ninja import File, Form, Router, Status
from ninja.errors import HttpError
from ninja.files import UploadedFile
from ninja_apikey.security import APIKeyAuth

from apps.accounts.api import JWTAuth
from apps.benchmarks import leaderboard, services
from apps.benchmarks.files import media_url
from apps.benchmarks.models import CaseVisibility, Run, Submission, SubmissionStatus, Suite
from apps.benchmarks.schemas import (
    CaseDetailOut,
    CaseOut,
    CasePublishIn,
    CaseUploadIn,
    MyRunOut,
    MySubmissionOut,
    RunDetailOut,
    SubmissionIn,
    SuiteOut,
    SuiteSummaryOut,
    ToolReportOut,
)
from apps.benchmarks.services import BenchmarkError
from apps.benchmarks.throttles import BenchmarkWriteThrottle
from apps.catalog import images
from apps.catalog.models import Tool

router = Router(tags=["benchmarks"])

#: `verified` keeps only runs we scored, or whose submitter's score our rescore reproduced.
Scope = Literal["all", "verified"]


# --- helpers ---------------------------------------------------------------------


def _suite_or_404(slug):
    suite = Suite.objects.filter(slug=slug, is_public=True).first()
    if suite is None:
        raise HttpError(404, f"There is no {slug!r} benchmark.")
    return suite


def _revision_or_404(suite, name):
    revisions = (
        suite.revisions.filter(revision=name) if name else suite.revisions.filter(is_current=True)
    )
    revision = revisions.first()
    if revision is None:
        raise HttpError(404, f"The {suite.name} benchmark has no revision {name or 'yet'}.")
    return revision


def _revision_out(revision):
    return {
        "revision": revision.revision,
        "generator_version": revision.generator_version,
        "is_current": revision.is_current,
        "published_at": revision.published_at,
        "case_count": revision.cases.filter(visibility=CaseVisibility.PUBLIC).count(),
        "case_pack_url": media_url(revision.case_pack.name),
    }


def _case_out(case):
    return {
        "case_id": case.case_id,
        "family": case.family,
        "page_count": case.page_count,
        "probe_count": case.probe_count,
        "probe_summary": case.probe_summary,
        "pdf_url": media_url(case.pdf.name),
        "preview": preview_out(case),
    }


def _srcset(path, widths):
    base = path.rsplit("/", 1)[0]
    return ", ".join(f"{media_url(f'{base}/w{width}.webp')} {width}w" for width in widths)


def preview_out(case):
    if not case.preview:
        return None
    return {
        "url": media_url(case.preview.name),
        "srcset": _srcset(case.preview.name, case.preview_widths),
        "width": case.preview_width,
        "height": case.preview_height,
    }


def overlay_out(run):
    if not run.overlay:
        return None
    return {
        "url": media_url(run.overlay.name),
        "srcset": _srcset(run.overlay.name, run.overlay_widths),
    }


def _counts(run):
    return {
        "TP": run.tp,
        "FN": run.fn,
        "FP": run.fp,
        "TN": run.tn,
        "unsupported": run.unsupported,
        "undecided": run.undecided,
    }


def run_leak_rate(run):
    from pdfredeval.score.metrics import rate

    return rate(run.fn, run.tp + run.fn).to_dict()


def _run_out(run):
    holdout = run.case.visibility == CaseVisibility.HOLDOUT
    submission = run.submission
    return {
        "run_id": "" if holdout else run.run_id,
        "case_id": "" if holdout else run.case.case_id,
        "family": run.case.family,
        "holdout": holdout,
        "tool": leaderboard.tool_ref(submission.tool),
        "surface": submission.surface,
        "counts": _counts(run),
        "leak_rate": run_leak_rate(run),
        "weighted_leak_rate": run.weighted_leak_rate,
        "text_retention": run.text_retention,
        "gates_passed": run.gates_passed,
        "overlay": None if holdout else overlay_out(run),
        "output_pdf_url": None if holdout else media_url(run.output_pdf.name),
        "submitter": {"name": submission.submitter_name, "role": submission.submitter_role},
        "provenance": leaderboard.provenance(run),
        "scored_by": run.scored_by,
        "reviewed_at": submission.reviewed_at,
    }


# --- public reads ----------------------------------------------------------------


@router.get("/suites", response=list[SuiteSummaryOut], summary="Benchmark suites, one per medium")
def list_benchmark_suites(request: HttpRequest):
    out = []
    for suite in Suite.objects.filter(is_public=True):
        current = suite.revisions.filter(is_current=True).first()
        tools = (
            Run.objects.filter(
                submission__revision=current, submission__status=SubmissionStatus.APPROVED
            )
            .values("submission__tool", "submission__surface")
            .distinct()
            .count()
            if current
            else 0
        )
        out.append(
            {
                "slug": suite.slug,
                "name": suite.name,
                "description_md": suite.description_md,
                "current_revision": current.revision if current else None,
                "case_count": current.cases.filter(visibility=CaseVisibility.PUBLIC).count()
                if current
                else 0,
                "tool_count": tools,
            }
        )
    return out


@router.get("/suites/{suite}", response=SuiteOut, summary="A suite's cases and leaderboard")
def get_benchmark_suite(
    request: HttpRequest, suite: str, revision: str | None = None, scope: Scope = "all"
):
    """One revision's leaderboard - the current one unless `revision` names another.
    Scores from different revisions never share a table."""
    suite_row = _suite_or_404(suite)
    target = _revision_or_404(suite_row, revision)
    cases = target.cases.all()
    return {
        "slug": suite_row.slug,
        "name": suite_row.name,
        "description_md": suite_row.description_md,
        "revisions": [
            _revision_out(r) for r in suite_row.revisions.annotate(n=Count("cases")).filter(n__gt=0)
        ],
        "revision": _revision_out(target),
        "scope": scope,
        "cases": [_case_out(c) for c in cases if c.visibility == CaseVisibility.PUBLIC],
        "holdout_case_count": sum(1 for c in cases if c.visibility == CaseVisibility.HOLDOUT),
        "leaderboard": leaderboard.build(target, scope=scope),
    }


@router.get(
    "/suites/{suite}/cases/{case_id}",
    response=CaseDetailOut,
    summary="One case and every approved run on it",
)
def get_benchmark_case(request: HttpRequest, suite: str, case_id: str, revision: str | None = None):
    target = _revision_or_404(_suite_or_404(suite), revision)
    case = target.cases.filter(case_id=case_id, visibility=CaseVisibility.PUBLIC).first()
    if case is None:
        raise HttpError(404, f"Revision {target.revision} has no public case {case_id!r}.")
    runs = leaderboard.latest_per_tool_and_case(leaderboard.approved_runs(target), case_id=case.pk)
    return {**_case_out(case), "revision": target.revision, "runs": [_run_out(r) for r in runs]}


@router.get(
    "/suites/{suite}/tools/{slug}",
    response=ToolReportOut,
    summary="One tool's pooled report, per surface",
)
def get_benchmark_tool_report(
    request: HttpRequest, suite: str, slug: str, revision: str | None = None, scope: Scope = "all"
):
    target = _revision_or_404(_suite_or_404(suite), revision)
    tool = Tool.objects.filter(slug=slug).first()
    runs = [
        run
        for run in leaderboard.approved_runs(target, scope=scope)
        if tool and run.submission.tool_id == tool.pk
    ]
    if not runs:
        raise HttpError(404, f"No approved {target.revision} results for {slug!r} yet.")

    by_surface = {}
    for run in runs:
        by_surface.setdefault(run.submission.surface, []).append(run)
    surfaces = []
    for surface, surface_runs in sorted(by_surface.items()):
        kept, excluded = leaderboard.select(surface_runs)
        surfaces.append(
            {
                "surface": surface,
                "summary": leaderboard.pool(kept),
                "runs_excluded": excluded,
                "breakdowns": leaderboard.pool_breakdowns([run.report for run in kept]),
                "runs": [_run_out(run) for run in sorted(kept, key=lambda r: r.case.case_id)],
            }
        )
    return {
        "tool": leaderboard.tool_ref(tool),
        "suite": suite,
        "revision": target.revision,
        "scope": scope,
        "case_count": target.cases.count(),
        "surfaces": surfaces,
    }


@router.get("/runs/{run_id}", response=RunDetailOut, summary="One approved run, whole")
def get_benchmark_run(request: HttpRequest, run_id: str):
    run = (
        Run.objects.filter(
            Q(run_id=run_id),
            submission__status=SubmissionStatus.APPROVED,
            case__visibility=CaseVisibility.PUBLIC,
            status="scored",
        )
        .select_related("submission__tool", "case__revision")
        .first()
    )
    if run is None:
        raise HttpError(404, f"No published run {run_id!r}.")
    submission = run.submission
    return {
        **_run_out(run),
        "report": run.report,
        "manifest": run.manifest,
        "verification": run.verification,
        "verification_diff": run.verification_diff,
        "scorer_version": run.scorer_version,
        "tool_version": submission.tool_version,
        "tier": submission.tier,
        "notes": submission.notes,
        "revision": run.case.revision.revision,
    }


# --- writes ----------------------------------------------------------------------
# Every write takes either credential: the site sends the user's bearer token, and the
# pdfredeval CLI an API key (`X-API-Key: <prefix>.<key>`, minted from /account).

WRITE_AUTH = [APIKeyAuth(), JWTAuth()]

# manifest.json is ~1.5 KB and report.json ~13 KB; this is headroom, not a target.
MAX_JSON_BYTES = 2 * 1024 * 1024


def _refused(exc):
    return HttpError(422, str(exc))


def _mine_or_404(request, submission_id):
    submission = (
        Submission.objects.filter(pk=submission_id, submitted_by=request.auth)
        .select_related("tool", "suite", "revision")
        .first()
    )
    if submission is None:
        raise HttpError(404, "No submission of yours with that id.")
    return submission


def _check_pdf_size(upload):
    """Before a byte is read: Django streams a large upload to disk, and reading it back
    into memory to be parsed is exactly what the cap exists to prevent."""
    cap = settings.BENCHMARK_MAX_PDF_BYTES
    if upload.size > cap:
        raise HttpError(422, f"That PDF is larger than the {cap // 1024 // 1024} MB limit.")


def _read_json(upload, name):
    if upload.size > MAX_JSON_BYTES:
        raise HttpError(422, f"That {name} is too large to be one pdfredeval wrote.")
    try:
        return json.loads(upload.read())
    except (ValueError, UnicodeDecodeError) as exc:
        raise HttpError(422, f"That {name} is not valid JSON: {exc}") from exc


def my_run_out(run):
    return {
        "run_id": run.run_id,
        "case_id": run.case.case_id,
        "status": run.status,
        "error": run.error,
        "verification": run.verification,
        "counts": _counts(run),
        "leak_rate": run_leak_rate(run),
        "overlay": overlay_out(run),
    }


def my_submission_out(submission):
    return {
        "id": submission.id,
        "suite": submission.suite.slug,
        "revision": submission.revision.revision,
        "tool": leaderboard.tool_ref(submission.tool),
        "surface": submission.surface,
        "origin": submission.origin,
        "status": submission.status,
        "submitter": {"name": submission.submitter_name, "role": submission.submitter_role},
        "review_note": submission.review_note,
        "created_at": submission.created_at,
        "submitted_at": submission.submitted_at,
        "reviewed_at": submission.reviewed_at,
        "runs": [my_run_out(run) for run in submission.runs.select_related("case")],
    }


@router.post(
    "/suites/{suite}/submissions",
    response={201: MySubmissionOut},
    auth=WRITE_AUTH,
    throttle=[BenchmarkWriteThrottle()],
    summary="Open a submission of one tool's results",
)
def create_benchmark_submission(request: HttpRequest, suite: str, payload: SubmissionIn):
    try:
        submission = services.open_submission(user=request.auth, suite=suite, **payload.dict())
    except BenchmarkError as exc:
        raise _refused(exc) from exc
    return Status(201, my_submission_out(submission))


@router.get(
    "/submissions/mine",
    response=list[MySubmissionOut],
    auth=WRITE_AUTH,
    summary="Your benchmark submissions, newest first",
)
def list_my_benchmark_submissions(request: HttpRequest):
    submissions = Submission.objects.filter(submitted_by=request.auth).select_related(
        "tool", "suite", "revision"
    )
    return [my_submission_out(s) for s in submissions.exclude(status=SubmissionStatus.WITHDRAWN)]


@router.get(
    "/submissions/{submission_id}",
    response=MySubmissionOut,
    auth=WRITE_AUTH,
    summary="One of your submissions - poll it while it scores",
)
def get_my_benchmark_submission(request: HttpRequest, submission_id: UUID):
    return my_submission_out(_mine_or_404(request, submission_id))


@router.post(
    "/submissions/{submission_id}/outputs",
    response={201: MyRunOut},
    auth=WRITE_AUTH,
    throttle=[BenchmarkWriteThrottle()],
    summary="Upload one redacted PDF for us to score",
)
def upload_benchmark_output(
    request: HttpRequest,
    submission_id: UUID,
    payload: Form[CaseUploadIn],
    pdf: File[UploadedFile],
):
    submission = _mine_or_404(request, submission_id)
    _check_pdf_size(pdf)
    try:
        run = services.add_output(
            user=request.auth, submission=submission, case_id=payload.case_id, pdf=pdf.read()
        )
    except BenchmarkError as exc:
        raise _refused(exc) from exc
    return Status(201, my_run_out(run))


@router.post(
    "/submissions/{submission_id}/runs",
    response={201: MyRunOut},
    auth=WRITE_AUTH,
    throttle=[BenchmarkWriteThrottle()],
    summary="Publish one run scored with pdfredeval",
)
def publish_benchmark_run(
    request: HttpRequest,
    submission_id: UUID,
    manifest: File[UploadedFile],
    report: File[UploadedFile],
    pdf: File[UploadedFile],
    overlay: File[UploadedFile] = None,
):
    """`manifest.json`, `score/report.json`, the delivered PDF and (optionally) the
    overlay PNG - exactly the files `pdfredeval publish` sends. Never the ground truth."""
    submission = _mine_or_404(request, submission_id)
    _check_pdf_size(pdf)
    if overlay is not None and overlay.size > images.MAX_UPLOAD_BYTES:
        raise HttpError(422, "That overlay is larger than an overlay PNG can be.")
    try:
        run = services.add_scored_run(
            user=request.auth,
            submission=submission,
            manifest=_read_json(manifest, "manifest.json"),
            report=_read_json(report, "report.json"),
            overlay=overlay.read() if overlay is not None else None,
            pdf=pdf.read(),
        )
    except BenchmarkError as exc:
        raise _refused(exc) from exc
    return Status(201, my_run_out(run))


@router.post(
    "/submissions/{submission_id}/finalize",
    response=MySubmissionOut,
    auth=WRITE_AUTH,
    throttle=[BenchmarkWriteThrottle()],
    summary="Send a submission for scoring and review",
)
def finalize_benchmark_submission(request: HttpRequest, submission_id: UUID):
    submission = _mine_or_404(request, submission_id)
    try:
        submission = services.finalize(user=request.auth, submission=submission)
    except BenchmarkError as exc:
        raise _refused(exc) from exc
    return my_submission_out(submission)


@router.delete(
    "/submissions/{submission_id}",
    response=MySubmissionOut,
    auth=WRITE_AUTH,
    summary="Withdraw a submission that is not yet published",
)
def withdraw_benchmark_submission(request: HttpRequest, submission_id: UUID):
    submission = _mine_or_404(request, submission_id)
    try:
        submission = services.withdraw(user=request.auth, submission=submission)
    except BenchmarkError as exc:
        raise _refused(exc) from exc
    return my_submission_out(submission)


@router.post(
    "/suites/{suite}/cases",
    response={201: CaseOut},
    auth=WRITE_AUTH,
    summary="Publish a case and its ground truth (staff)",
)
def publish_benchmark_case(
    request: HttpRequest,
    suite: str,
    payload: Form[CasePublishIn],
    pdf: File[UploadedFile],
    ground_truth: File[UploadedFile],
):
    """What `pdfredeval publish-cases` sends. The ground truth is kept, never served."""
    if not request.auth.is_staff:
        raise HttpError(403, "Only Redaction Tools staff publish cases.")
    _check_pdf_size(pdf)
    try:
        case = services.publish_case(
            user=request.auth,
            suite=suite,
            pdf=pdf.read(),
            ground_truth=_read_json(ground_truth, "ground_truth.json"),
            visibility=payload.visibility,
        )
    except BenchmarkError as exc:
        raise _refused(exc) from exc
    return Status(201, _case_out(case))
