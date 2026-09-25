"""Writes against the benchmarks: cases, submissions, runs, reviews.

Every surface calls these - the owner/community API, the CLI's API-key routes and the
admin's review actions - and none of them is known here: no request, no transport.
Refusals are `BenchmarkError`, which each caller turns into its own recoverable
failure (a 422 from the API, a message in the admin).

`user` is a required keyword everywhere, as in `catalog/staff.py`, so there is no path
that publishes a case or a score without recording who did it.
"""

import hashlib
import io
import json
import time
import uuid
import zipfile
from collections import Counter

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.benchmarks import files
from apps.benchmarks.files import FileRejected
from apps.benchmarks.models import (
    Case,
    CaseVisibility,
    DatasetRevision,
    Run,
    RunStatus,
    ScoredBy,
    Submission,
    SubmissionOrigin,
    SubmissionStatus,
    SubmitterRole,
    Suite,
    Surface,
    Verification,
)
from apps.catalog.models import Tool, ToolStatus

# How far a PDF's media box may sit from the page size its ground truth records, in
# points. Writers round the box; a different paper size is tens of points off.
PAGE_SIZE_TOLERANCE_PT = 1.0

# Probe attributes the public summary counts. Values, boxes and the seed are absent by
# construction: a summary built only from these cannot leak the case.
SUMMARY_AXES = ("category", "severity", "difficulty", "kind", "channel", "trap")


class BenchmarkError(Exception):
    """A write refused for a reason the caller can act on and retry."""


def publish_case(*, user, suite, pdf, ground_truth, visibility=CaseVisibility.PUBLIC):
    """Add a case to the revision its ground truth names, or replace it there.

    Staff only: the ground truth is the answer key, and it arrives from nowhere but
    `pdfredeval publish-cases` run by an editor.
    """
    _require_staff(user, "publish cases")
    suite = _suite(suite)
    case_id, family, revision_name = _identity(ground_truth)

    try:
        stored = files.store_pdf(pdf, f"{case_id}.pdf")
    except FileRejected as exc:
        raise BenchmarkError(str(exc)) from exc
    _check_page_size(stored.page_size, ground_truth.get("page_size"))
    preview = files.store_preview(pdf)

    with transaction.atomic():
        revision = _revision(suite, revision_name, ground_truth.get("generator_version", ""))
        probes = ground_truth.get("probes") or []
        case, _ = Case.objects.update_or_create(
            revision=revision,
            case_id=case_id,
            defaults={
                "family": family,
                "visibility": visibility,
                "pdf": stored.path,
                "input_sha256": stored.sha256,
                "page_count": stored.page_count,
                "preview": preview.path,
                "preview_widths": preview.widths,
                "preview_width": preview.width,
                "preview_height": preview.height,
                "ground_truth": ground_truth,
                "probe_summary": summarize_probes(probes),
                "probe_count": len(probes),
            },
        )
        rebuild_case_pack(revision)
    return case


def open_submission(
    *, user, suite, tool, surface, origin, tool_version="", tier="", notes="", revision=None
):
    """Start a submission of one tool's runs against one revision (the current one).

    The role is decided here and frozen: staff, an approved owner of *this* tool, or
    anyone else. It is what the site shows beside the result, so it has to describe
    the account as it was when the result was sent, not as it is later.
    """
    suite = _suite(suite)
    listing = Tool.objects.filter(slug=tool, status=ToolStatus.PUBLISHED).first()
    if listing is None:
        raise BenchmarkError(
            f"The catalog has no published tool {tool!r}. Benchmark results attach to a "
            "listing - submit the tool first if it is missing."
        )
    if surface not in Surface.values:
        raise BenchmarkError(
            f"Unknown surface {surface!r}. Use one of: {', '.join(Surface.values)}."
        )
    target = _target_revision(suite, revision)

    return Submission.objects.create(
        suite=suite,
        revision=target,
        tool=listing,
        surface=surface,
        origin=origin,
        tool_version=tool_version,
        tier=tier,
        notes=notes,
        submitted_by=user,
        submitter_name=display_name(user),
        submitter_role=role_for(user, listing),
    )


# Shown for an account with no name. Never the email, or part of it: a leaderboard is
# public, and an address typed into a sign-in form was not given to be published.
ANONYMOUS_NAME = "Anonymous contributor"


def display_name(user):
    """The name a result is credited to. A nameless staff account is the site itself."""
    if user.name:
        return user.name
    return SubmitterRole.STAFF.label if user.is_staff else ANONYMOUS_NAME


def role_for(user, tool):
    if user.is_staff:
        return SubmitterRole.STAFF
    if Tool.objects.owned_by(user).filter(pk=tool.pk).exists():
        return SubmitterRole.OWNER
    return SubmitterRole.COMMUNITY


def add_output(*, user, submission, case_id, pdf):
    """Add one redacted PDF for us to score. Replaces an earlier upload for that case.

    We write the manifest ourselves - from the submission and the bytes - because the
    uploader sent nothing but a file, and a manifest is a claim about how it was made.
    """
    _require_open(user, submission, SubmissionOrigin.UPLOAD)
    case = _case_for(user, submission, case_id)
    stored = _store_output(pdf, case)

    manifest = {
        "run_id": _new_run_id(submission, case),
        "case_id": case.case_id,
        "tool_id": submission.tool_id_label,
        "transport": "manual",
        "observed_at": timezone.now().isoformat(timespec="seconds"),
        "attempt": 1,
        "dataset_revision": submission.revision.revision,
        "tool_version": submission.tool_version or None,
        "tier": submission.tier or None,
        "input_sha256": case.input_sha256,
        "output_sha256": stored.sha256,
        "output_name": f"redacted-{case.case_id}.pdf",
        "notes": None,
        "operator": None,
        "profile": {},
        "vendor_settings": {},
        "capabilities": {},
    }
    with transaction.atomic():
        submission.runs.filter(case=case).delete()
        return Run.objects.create(
            submission=submission,
            case=case,
            run_id=manifest["run_id"],
            output_pdf=stored.path,
            output_sha256=stored.sha256,
            manifest=manifest,
            scored_by=ScoredBy.SERVER,
            verification=Verification.NOT_NEEDED,
        )


def add_scored_run(*, user, submission, manifest, report, overlay, pdf):
    """Add one run the submitter scored with `pdfredeval score`.

    Their report is what we publish - it is theirs to stand behind, and it carries the
    engines and thresholds they ran with - but it is checked before it is stored and
    rescored by us after: every field that ties it to *this* case, *this* tool and
    *these* bytes must hold, and our own score of the same PDF decides `verification`.
    """
    _require_open(user, submission, SubmissionOrigin.CLI)
    parsed = _parse_manifest(manifest)
    _check_manifest(parsed, submission)
    case = _case_for(user, submission, parsed.case_id)
    if parsed.input_sha256 != case.input_sha256:
        raise BenchmarkError(
            f"The manifest's input_sha256 is not {case.case_id}'s: the run redacted some "
            "other file. Regenerate or re-download the case and run it again."
        )
    if files.sha256(pdf) != parsed.output_sha256:
        raise BenchmarkError(
            "The PDF sent is not the one the manifest's output_sha256 records - the "
            "report would describe a different file."
        )
    _check_report(report, parsed)

    stored = _store_output(pdf, case)
    try:
        drawn = files.store_overlay(overlay) if overlay else None
    except FileRejected as exc:
        raise BenchmarkError(f"Overlay: {exc}") from exc

    try:
        with transaction.atomic():
            submission.runs.filter(case=case).delete()
            return Run.objects.create(
                submission=submission,
                case=case,
                run_id=parsed.run_id,
                status=RunStatus.QUEUED,
                output_pdf=stored.path,
                output_sha256=stored.sha256,
                overlay=drawn.path if drawn else "",
                overlay_widths=drawn.widths if drawn else [],
                manifest=parsed.to_dict(),
                report=report,
                scored_by=ScoredBy.SUBMITTER,
                verification=Verification.PENDING,
                **headline(report),
            )
    except IntegrityError as exc:
        raise BenchmarkError(
            f"Run {parsed.run_id} is already published. Score a new attempt to send it again."
        ) from exc


def finalize(*, user, submission):
    """Send a submission: queue every run for (re)scoring, then it waits for review."""
    if submission.submitted_by_id != user.pk:
        raise BenchmarkError("That submission is not yours.")
    if submission.status != SubmissionStatus.DRAFT:
        raise BenchmarkError("That submission was already sent.")
    runs = list(submission.runs.all())
    if not runs:
        raise BenchmarkError("That submission has no runs yet - add at least one case first.")

    from apps.benchmarks import scoring

    submission.status = SubmissionStatus.SCORING
    submission.submitted_at = timezone.now()
    submission.save(update_fields=["status", "submitted_at", "updated_at"])
    for run in runs:
        scoring.enqueue(run)
    submission.refresh_from_db()
    return submission


REVIEWABLE = (SubmissionStatus.PENDING_REVIEW, SubmissionStatus.SCORING_FAILED)


def review(*, user, submission, status, note=""):
    """An editor's decision. Approval publishes every run in the submission at once."""
    _require_staff(user, "review benchmark submissions")
    if status not in (SubmissionStatus.APPROVED, SubmissionStatus.REJECTED):
        raise BenchmarkError(f"A review approves or rejects; {status!r} is neither.")
    if submission.status not in REVIEWABLE:
        raise BenchmarkError(
            f"That submission is {submission.get_status_display().lower()}, not awaiting review."
        )
    if status == SubmissionStatus.APPROVED and submission.status != SubmissionStatus.PENDING_REVIEW:
        raise BenchmarkError("A submission whose scoring failed can be rejected, not approved.")
    if status == SubmissionStatus.REJECTED and not note.strip():
        # The submitter reads this on their submissions page; a bare "rejected" teaches
        # them nothing they can fix.
        raise BenchmarkError("Say why in the review note - the submitter sees it.")

    submission.status = status
    submission.reviewed_by = user
    submission.reviewed_at = timezone.now()
    submission.review_note = note.strip()
    submission.save(
        update_fields=["status", "reviewed_by", "reviewed_at", "review_note", "updated_at"]
    )
    return submission


def withdraw(*, user, submission):
    """Take a submission back before it is published."""
    if submission.submitted_by_id != user.pk:
        raise BenchmarkError("That submission is not yours.")
    if submission.status == SubmissionStatus.APPROVED:
        raise BenchmarkError(
            "That submission is already published. Ask us to take it down if it is wrong."
        )
    if submission.status in (SubmissionStatus.REJECTED, SubmissionStatus.WITHDRAWN):
        raise BenchmarkError(f"That submission is already {submission.status}.")
    submission.status = SubmissionStatus.WITHDRAWN
    submission.save(update_fields=["status", "updated_at"])
    return submission


def headline(report):
    """The fields the leaderboard pools, copied out of a pdfredeval report."""
    summary = report.get("summary") or {}
    counts = summary.get("counts") or {}
    survivability = report.get("survivability") or {}
    return {
        "tp": counts.get("TP", 0),
        "fn": counts.get("FN", 0),
        "fp": counts.get("FP", 0),
        "tn": counts.get("TN", 0),
        "unsupported": counts.get("unsupported", 0),
        "undecided": counts.get("undecided", 0),
        "weighted_leak_rate": summary.get("weighted_leak_rate"),
        "text_retention": summary.get("text_retention"),
        "gates_passed": survivability.get("passed"),
        "thresholds_digest": thresholds_digest(report.get("thresholds")),
    }


def thresholds_digest(thresholds):
    """A fingerprint of the threshold table a score was computed under.

    Two runs are poolable only when this matches: pdfredeval's rule is that scores from
    different thresholds are different measurements.
    """
    if not thresholds:
        return ""
    return hashlib.sha256(json.dumps(thresholds, sort_keys=True).encode()).hexdigest()


def render_preview(case):
    """Render `case`'s preview again from its stored PDF. Returns the widths written."""
    preview = files.store_preview(files.read(case.pdf.name))
    case.preview = preview.path
    case.preview_widths = preview.widths
    case.preview_width = preview.width
    case.preview_height = preview.height
    case.save(
        update_fields=[
            "preview",
            "preview_widths",
            "preview_width",
            "preview_height",
            "updated_at",
        ]
    )
    return preview.widths


def summarize_probes(probes):
    """What a case contains, as counts: the public face of its ground truth."""
    summary = {
        "targets": sum(1 for p in probes if p.get("must_redact")),
        "distractors": sum(1 for p in probes if not p.get("must_redact")),
    }
    for axis in SUMMARY_AXES:
        counts = Counter(p.get(axis) for p in probes if p.get(axis) is not None)
        summary[f"by_{axis}"] = dict(sorted(counts.items()))
    return summary


def rebuild_case_pack(revision):
    """Zip every public case of `revision` into one download, or clear it if none.

    Content-addressed like everything else, so a new case means a new URL rather than
    a cached zip that is missing it.
    """
    public = revision.cases.filter(visibility=CaseVisibility.PUBLIC).order_by("family", "case_id")
    if not public.exists():
        revision.case_pack = ""
    else:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            for case in public:
                archive.writestr(f"{case.family}/{case.case_id}.pdf", files.read(case.pdf.name))
        name = f"{revision.suite.slug}-{revision.revision}-cases.zip"
        revision.case_pack = files.store_bytes(buffer.getvalue(), name)
    revision.save(update_fields=["case_pack", "updated_at"])


def _require_open(user, submission, origin):
    if submission.submitted_by_id != user.pk:
        raise BenchmarkError("That submission is not yours.")
    if submission.status != SubmissionStatus.DRAFT:
        raise BenchmarkError(
            f"That submission was already sent ({submission.get_status_display().lower()}). "
            "Open a new one."
        )
    if submission.origin != origin:
        raise BenchmarkError(
            "Runs scored with the CLI go into a CLI submission, and uploaded PDFs into an "
            "upload one - open a submission of the right kind."
        )


def _case_for(user, submission, case_id):
    case = submission.revision.cases.filter(case_id=case_id).first()
    # A holdout case is reported as absent rather than forbidden: confirming that one
    # exists under that id is itself a leak.
    if case is None or (case.visibility == CaseVisibility.HOLDOUT and not user.is_staff):
        raise BenchmarkError(f"Revision {submission.revision.revision} has no case {case_id!r}.")
    return case


def _store_output(pdf, case):
    try:
        stored = files.store_pdf(pdf, f"redacted-{case.case_id}.pdf")
    except FileRejected as exc:
        raise BenchmarkError(str(exc)) from exc
    if stored.page_count != case.page_count:
        raise BenchmarkError(
            f"That PDF has {stored.page_count} pages; {case.case_id} has "
            f"{case.page_count}. Send the tool's output for this case, whole."
        )
    return stored


def _new_run_id(submission, case):
    """A run id in pdfredeval's own format: `<utc stamp>-<tool slug>-<case>-a1-<hex6>`."""
    from pdfredeval.workspace import tool_slug

    stamp = time.strftime("%Y%m%dT%H%M%S", time.gmtime())
    slug = tool_slug(submission.tool_id_label)
    return f"{stamp}-{slug}-{case.case_id}-a1-{uuid.uuid4().hex[:6]}"


def _parse_manifest(manifest):
    from pdfredeval.errors import BenchmarkError as PdfredevalError
    from pdfredeval.manifest import RunManifest

    try:
        parsed = RunManifest.from_dict(manifest)
    except PdfredevalError as exc:
        raise BenchmarkError(str(exc)) from exc
    except (TypeError, ValueError) as exc:
        raise BenchmarkError(f"That manifest.json could not be read: {exc}") from exc
    if missing := parsed.missing_fields():
        raise BenchmarkError(
            f"The manifest is missing {', '.join(missing)} - a result is published only with "
            "all of them. Collect the run again with pdfredeval."
        )
    return parsed


def _check_manifest(parsed, submission):
    if parsed.tool_id != submission.tool_id_label:
        raise BenchmarkError(
            f"This run is {parsed.tool_id}, but the submission is for "
            f"{submission.tool_id_label}. Publish each tool in its own submission."
        )
    if parsed.dataset_revision != submission.revision.revision:
        raise BenchmarkError(
            f"This run was scored against {parsed.dataset_revision}; the submission is for "
            f"{submission.revision.revision}. Scores from different revisions never pool."
        )


def _check_report(report, parsed):
    if not isinstance(report, dict) or not isinstance(report.get("summary"), dict):
        raise BenchmarkError("That report.json has no summary - send score/report.json as written.")
    for field in ("run_id", "case_id"):
        if report.get(field) != getattr(parsed, field):
            raise BenchmarkError(
                f"The report's {field} ({report.get(field)!r}) is not the manifest's "
                f"({getattr(parsed, field)!r}): they describe different runs."
            )


def _target_revision(suite, name):
    revisions = suite.revisions.filter(cases__isnull=False).distinct()
    target = (
        revisions.filter(revision=name).first()
        if name
        else revisions.filter(is_current=True).first()
    )
    if target is None:
        raise BenchmarkError(
            f"The {suite.name} benchmark has no cases in "
            f"{'revision ' + name if name else 'its current revision'} yet."
        )
    return target


def _identity(ground_truth):
    try:
        return ground_truth["case_id"], ground_truth["family"], ground_truth["dataset_revision"]
    except (KeyError, TypeError) as exc:
        raise BenchmarkError(
            "That ground truth is missing case_id, family or dataset_revision. "
            "Send the ground_truth.json pdfredeval generated, unedited."
        ) from exc


def _check_page_size(actual, recorded):
    if not recorded:
        return
    if any(
        abs(a - float(r)) > PAGE_SIZE_TOLERANCE_PT for a, r in zip(actual, recorded, strict=False)
    ):
        raise BenchmarkError(
            f"That PDF's page size ({actual[0]:.1f} x {actual[1]:.1f} pt) is not the "
            f"{float(recorded[0]):.1f} x {float(recorded[1]):.1f} pt its ground truth "
            "records - is it the right case?"
        )


def _revision(suite, name, generator_version):
    revision, created = DatasetRevision.objects.get_or_create(
        suite=suite, revision=name, defaults={"generator_version": generator_version}
    )
    # A suite's first revision is its current one; after that, moving the leaderboard
    # to a new revision is an editor's call in the admin, never a side effect.
    if created and not suite.revisions.filter(is_current=True).exists():
        revision.is_current = True
        revision.published_at = timezone.now()
        revision.save(update_fields=["is_current", "published_at", "updated_at"])
    return revision


def _suite(slug):
    suite = Suite.objects.filter(slug=slug).first()
    if suite is None:
        raise BenchmarkError(f"There is no benchmark suite called {slug!r}.")
    return suite


def _require_staff(user, action):
    if not (user and user.is_staff):
        raise BenchmarkError(f"Only Redaction Tools staff can {action}.")
