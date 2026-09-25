"""Request and response shapes for the benchmarks API.

A pdfredeval report is passed through as a free-form object (`report`, `breakdowns`),
not re-declared field by field: it is the scorer's published record, versioned with the
scorer, and a copy of its schema here would drift the first time the submodule moves.
The fields the site sorts or badges on are declared.
"""

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from ninja import Schema

Role = Literal["staff", "owner", "community"]
Provenance = Literal["server", "verified", "unverified", "mismatch"]


class RateOut(Schema):
    """A proportion with the counts it came from and its Wilson 95% interval."""

    value: float | None
    n: int
    count: int
    ci95: list[float] | None


class CountsOut(Schema):
    TP: int
    FN: int
    FP: int
    TN: int
    unsupported: int
    undecided: int


class ToolRefOut(Schema):
    slug: str
    name: str
    logo_url: str
    #: Whether the tool has a public page to link to.
    listable: bool


class SubmitterOut(Schema):
    name: str
    role: Role


class OverlayOut(Schema):
    #: The full-size PNG: the rendition a reader zooms into.
    url: str
    srcset: str


class PreviewOut(Schema):
    """A case's first page, rendered: the full-size PNG plus WebP thumbnails."""

    url: str
    srcset: str
    width: int
    height: int


class RevisionOut(Schema):
    revision: str
    generator_version: str
    is_current: bool
    published_at: datetime | None
    case_count: int
    case_pack_url: str | None


class CaseOut(Schema):
    case_id: str
    family: str
    page_count: int
    probe_count: int
    probe_summary: dict[str, Any]
    pdf_url: str
    preview: PreviewOut | None


class PooledOut(Schema):
    leak_rate: RateOut
    over_redaction_rate: RateOut
    counts: CountsOut
    cases: int
    gates_failed: int
    lowest_text_retention: float | None
    provenance: Provenance


class LeaderboardRowOut(PooledOut):
    tool: ToolRefOut
    surface: str
    runs_excluded: int
    submitters: list[SubmitterOut]
    last_reviewed_at: datetime | None


class SuiteSummaryOut(Schema):
    slug: str
    name: str
    description_md: str
    current_revision: str | None
    case_count: int
    tool_count: int


class SuiteOut(Schema):
    slug: str
    name: str
    description_md: str
    revisions: list[RevisionOut]
    revision: RevisionOut
    scope: Literal["all", "verified"]
    cases: list[CaseOut]
    #: Scored cases the public cannot see, counted so a row's `cases` adds up.
    holdout_case_count: int
    leaderboard: list[LeaderboardRowOut]


class RunOut(Schema):
    run_id: str
    #: Empty for a holdout case: its id is withheld along with its files.
    case_id: str
    family: str
    holdout: bool
    tool: ToolRefOut
    surface: str
    counts: CountsOut
    leak_rate: RateOut
    weighted_leak_rate: float | None
    text_retention: float | None
    gates_passed: bool | None
    overlay: OverlayOut | None
    output_pdf_url: str | None
    submitter: SubmitterOut
    provenance: Provenance
    scored_by: Literal["server", "submitter"]
    reviewed_at: datetime | None


class RunDetailOut(RunOut):
    report: dict[str, Any]
    manifest: dict[str, Any]
    verification: str
    verification_diff: dict[str, Any]
    scorer_version: str
    tool_version: str
    tier: str
    notes: str
    revision: str


class CaseDetailOut(CaseOut):
    revision: str
    runs: list[RunOut]


class ToolSurfaceOut(Schema):
    surface: str
    summary: PooledOut
    runs_excluded: int
    breakdowns: dict[str, Any]
    runs: list[RunOut]


class ToolReportOut(Schema):
    tool: ToolRefOut
    suite: str
    revision: str
    scope: Literal["all", "verified"]
    case_count: int
    surfaces: list[ToolSurfaceOut]


# --- writes ------------------------------------------------------------------------


class SubmissionIn(Schema):
    #: The catalog slug of the tool that produced the outputs.
    tool: str
    surface: Literal["web", "api", "desktop"]
    #: `upload` - send redacted PDFs, we score them. `cli` - send runs scored with
    #: `pdfredeval score`; we rescore and flag any disagreement.
    origin: Literal["upload", "cli"] = "upload"
    tool_version: str = ""
    tier: str = ""
    notes: str = ""
    #: Defaults to the suite's current revision.
    revision: str | None = None


class MyRunOut(Schema):
    run_id: str
    case_id: str
    status: Literal["queued", "scored", "failed"]
    error: str
    verification: str
    counts: CountsOut
    leak_rate: RateOut
    overlay: OverlayOut | None


class MySubmissionOut(Schema):
    id: UUID
    suite: str
    revision: str
    tool: ToolRefOut
    surface: str
    origin: Literal["upload", "cli"]
    status: str
    submitter: SubmitterOut
    review_note: str
    created_at: datetime
    submitted_at: datetime | None
    reviewed_at: datetime | None
    runs: list[MyRunOut]


class CaseUploadIn(Schema):
    case_id: str


class CasePublishIn(Schema):
    visibility: Literal["public", "holdout"] = "public"
