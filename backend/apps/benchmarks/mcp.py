"""The staff benchmark MCP tools.

Thin, like `apps.comments.mcp`: each tool is a typed signature over a function in
`apps.benchmarks.staff`, which holds the rules and knows nothing about MCP. Cases and
runs still arrive from the pdfredeval CLI; what an editor does from here is read the
results and decide on them.
"""

import contextlib
from datetime import datetime
from typing import Annotated, Any
from uuid import UUID

import msgspec
from django_mcpz.server import ToolError
from msgspec import UNSET, Meta, Struct, UnsetType

from apps.accounts.mcp_auth import is_staff
from apps.benchmarks import staff
from apps.catalog.staff import StaffError


@contextlib.contextmanager
def _as_tool_error():
    try:
        yield
    except StaffError as exc:
        raise ToolError(str(exc)) from exc


def _passed(value):
    return None if value is UNSET else value


class Rate(Struct):
    value: Annotated[float | None, Meta(description="None when n is 0.")]
    n: int
    count: int
    ci95: Annotated[list[float] | None, Meta(description="Wilson 95% interval.")]


class ToolRef(Struct):
    slug: str
    name: str
    logo_url: str | None
    listable: Annotated[bool, Meta(description="Whether the catalog has a public page for it.")]


class Submitter(Struct):
    name: str
    role: Annotated[str, Meta(description="staff, owner or community.")]


class SubmissionRow(Struct):
    id: UUID
    suite: str
    revision: str
    tool: ToolRef
    surface: str
    tier: Annotated[str, Meta(description="The plan the tool ran on, if the submitter said.")]
    origin: Annotated[str, Meta(description="upload (we scored it) or cli (they did).")]
    status: str
    submitter: Submitter
    runs: int
    verification: Annotated[
        list[str], Meta(description="Distinct rescore verdicts across its runs.")
    ]
    submitted_at: datetime | None
    reviewed_at: datetime | None


class SubmissionPage(Struct):
    count: Annotated[int, Meta(description="The whole filtered set, not this page.")]
    items: list[SubmissionRow]


class Screenshot(Struct):
    id: int
    run_id: str
    status: str
    url: str | None
    width: int
    height: int
    created_at: datetime


class RunRow(Struct):
    run_id: str
    case_id: str
    family: str
    holdout: Annotated[bool, Meta(description="Scored but never shown publicly.")]
    status: str
    error: str
    scored_by: str
    verification: Annotated[
        str, Meta(description="not_needed, pending, verified, mismatch or failed.")
    ]
    verification_diff: Annotated[
        dict[str, Any], Meta(description="Per field: what was claimed and what we measured.")
    ]
    counts: dict[str, int]
    leak_rate: Rate
    weighted_leak_rate: float | None
    text_retention: Annotated[float | None, Meta(description="Below 0.9 fails the usability gate.")]
    gates_passed: bool | None
    reach: Annotated[dict[str, Rate], Meta(description="Share removed, per channel.")]
    overlay_url: str | None
    output_pdf_url: str | None
    screenshots: list[Screenshot]


class SubmissionDetail(Struct):
    id: UUID
    suite: str
    revision: str
    tool: ToolRef
    surface: str
    tier: str
    origin: str
    status: str
    submitter: Submitter
    verification: list[str]
    submitted_at: datetime | None
    reviewed_at: datetime | None
    tool_version: str
    notes: str
    review_note: str
    reviewed_by: str | None
    runs: list[RunRow]


class LeaderboardRow(Struct):
    tool: ToolRef
    surface: str
    leak_rate: Rate
    over_redaction_rate: Rate
    counts: dict[str, int]
    cases: int
    gates_failed: int
    lowest_text_retention: float | None
    provenance: Annotated[
        str, Meta(description="server, verified, unverified or mismatch: its weakest run.")
    ]
    runs_excluded: int
    submitters: list[Submitter]
    last_reviewed_at: datetime


class Leaderboard(Struct):
    suite: str
    revision: str
    is_current: bool
    scope: str
    rows: Annotated[list[LeaderboardRow], Meta(description="Best first.")]


class RevisionRow(Struct):
    revision: str
    is_current: bool
    published_at: datetime | None
    cases: int
    holdout_cases: int


class SuiteRow(Struct):
    slug: str
    name: str
    is_public: bool
    revisions: list[RevisionRow]
    awaiting_review: int


class SuiteList(Struct):
    suites: list[SuiteRow]


class QueuedScreenshot(Struct):
    id: int
    run_id: str
    status: str
    url: str | None
    width: int
    height: int
    created_at: datetime
    submission_id: UUID
    tool: ToolRef


class ScreenshotPage(Struct):
    count: int
    items: list[QueuedScreenshot]


class Published(Struct):
    published: int


class NoParams(Struct):
    pass


class LeaderboardParams(Struct):
    suite: Annotated[str, Meta(description="A suite slug from benchmarks_list_suites.")] = "pdf"
    revision: Annotated[
        str | UnsetType, Meta(description="e.g. v0.1.1. Defaults to the current one.")
    ] = UNSET
    scope: Annotated[
        str, Meta(description="'all', or 'verified' for runs we scored or confirmed.")
    ] = "all"


class ListSubmissionsParams(Struct):
    status: Annotated[
        str | UnsetType,
        Meta(
            description=(
                "draft, scoring, scoring_failed, pending_review, approved, rejected or "
                "withdrawn. pending_review is the queue."
            )
        ),
    ] = UNSET
    suite: str | UnsetType = UNSET
    tool: Annotated[str | UnsetType, Meta(description="The tool's catalog slug.")] = UNSET
    limit: Annotated[int, Meta(ge=1, le=100)] = 20
    offset: Annotated[int, Meta(ge=0)] = 0


class SubmissionParams(Struct):
    submission_id: Annotated[UUID, Meta(description="From benchmarks_list_submissions.")]


class ReviewSubmissionParams(Struct):
    submission_id: UUID
    status: Annotated[str, Meta(description="approved or rejected.")]
    note: Annotated[
        str, Meta(description="Required to reject: the submitter reads it and acts on it.")
    ] = ""


class ListScreenshotsParams(Struct):
    status: Annotated[str, Meta(description="pending (the queue) or published.")] = "pending"
    limit: Annotated[int, Meta(ge=1, le=100)] = 20
    offset: Annotated[int, Meta(ge=0)] = 0


class PublishScreenshotsParams(Struct):
    screenshot_ids: Annotated[list[int], Meta(min_length=1, max_length=100)]


def register(server):
    """Attach the staff benchmark tools to `server`."""

    @server.tool(
        description=(
            "List benchmark suites, public or not, with their dataset revisions, case "
            "counts and how many submissions await review."
        ),
        read_only=True,
        idempotent=True,
        open_world=False,
        permission=is_staff,
    )
    def benchmarks_list_suites(request, params: NoParams) -> SuiteList:
        return msgspec.convert({"suites": staff.list_suites()}, SuiteList)

    @server.tool(
        description=(
            "The leaderboard exactly as the site builds it - pooled counts, Wilson "
            "intervals, provenance - for any revision, including a suite not yet public."
        ),
        read_only=True,
        idempotent=True,
        open_world=False,
        permission=is_staff,
    )
    def benchmarks_get_leaderboard(request, params: LeaderboardParams) -> Leaderboard:
        with _as_tool_error():
            return msgspec.convert(
                staff.get_leaderboard(
                    suite=params.suite, revision=_passed(params.revision), scope=params.scope
                ),
                Leaderboard,
            )

    @server.tool(
        description=(
            "List benchmark submissions, newest first. Pass status='pending_review' for "
            "the review queue."
        ),
        read_only=True,
        idempotent=True,
        open_world=False,
        permission=is_staff,
    )
    def benchmarks_list_submissions(request, params: ListSubmissionsParams) -> SubmissionPage:
        with _as_tool_error():
            return msgspec.convert(
                staff.list_submissions(
                    status=_passed(params.status),
                    suite=_passed(params.suite),
                    tool=_passed(params.tool),
                    limit=params.limit,
                    offset=params.offset,
                ),
                SubmissionPage,
            )

    @server.tool(
        description=(
            "Read one submission whole before deciding on it: each run's counts and leak "
            "rate, where our rescore disagrees with the submitter's claim "
            "(verification_diff), usability gates, the overlay and output PDF URLs and its "
            "screenshots. Holdout runs are shown in full."
        ),
        read_only=True,
        idempotent=True,
        open_world=False,
        permission=is_staff,
    )
    def benchmarks_get_submission(request, params: SubmissionParams) -> SubmissionDetail:
        with _as_tool_error():
            return msgspec.convert(
                staff.get_submission(submission_id=params.submission_id), SubmissionDetail
            )

    @server.tool(
        description=(
            "Approve or reject a submission awaiting review. Approval publishes every run "
            "in it to the leaderboard at once; either decision emails the submitter. A "
            "rejection needs a note saying why - the submitter reads it."
        ),
        read_only=False,
        destructive=True,
        idempotent=False,
        open_world=False,
        permission=is_staff,
    )
    def benchmarks_review_submission(request, params: ReviewSubmissionParams) -> SubmissionDetail:
        with _as_tool_error():
            return msgspec.convert(
                staff.review_submission(
                    user=request.user,
                    submission_id=params.submission_id,
                    status=params.status,
                    note=params.note,
                ),
                SubmissionDetail,
            )

    @server.tool(
        description=(
            "List run screenshots. Pending ones were added after their run was approved, "
            "so no review has seen them; look at each url before publishing."
        ),
        read_only=True,
        idempotent=True,
        open_world=False,
        permission=is_staff,
    )
    def benchmarks_list_screenshots(request, params: ListScreenshotsParams) -> ScreenshotPage:
        with _as_tool_error():
            return msgspec.convert(
                staff.list_screenshots(
                    status=params.status, limit=params.limit, offset=params.offset
                ),
                ScreenshotPage,
            )

    @server.tool(
        description=(
            "Publish pending run screenshots on their run's public page. Every id must be "
            "pending, or nothing is published."
        ),
        read_only=False,
        idempotent=True,
        open_world=False,
        permission=is_staff,
    )
    def benchmarks_publish_screenshots(request, params: PublishScreenshotsParams) -> Published:
        with _as_tool_error():
            return msgspec.convert(
                staff.publish_screenshots(user=request.user, screenshot_ids=params.screenshot_ids),
                Published,
            )
