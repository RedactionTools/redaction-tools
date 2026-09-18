"""The catalog's staff MCP tools.

Thin on purpose. Every tool is a typed signature over a function in
`apps.catalog.staff`, which holds the rules and knows nothing about MCP. What
lives here is the shape of the conversation: what the model may pass, what it
gets back, and how a refusal reaches it.

Tool names are prefixed `catalog_` because "tool" is already the protocol's
word - an MCP tool called `list_tools` reads to a model as "list the MCP tools".
"""

import contextlib
from typing import Annotated, Any

import msgspec
from django_mcpz.server import ToolError
from msgspec import UNSET, Meta, Struct, UnsetType

from apps.accounts.mcp_auth import is_staff
from apps.catalog import staff

SLUG = Annotated[str, Meta(description="The tool's catalog slug, e.g. 'pdf-redaction'.")]
PLAN_CODE = Annotated[str, Meta(description="The plan's stable code, e.g. 'pro'.")]


@contextlib.contextmanager
def _as_tool_error():
    """Turn a refusal into an in-band error the model can correct from.

    Anything else stays an exception, which django_mcpz logs and reports
    generically - the right treatment for a bug, which a model cannot fix by
    rephrasing.
    """
    try:
        yield
    except staff.StaffError as exc:
        raise ToolError(str(exc)) from exc


def _changes(params, *keys):
    """The fields the caller actually passed, minus the ones that address the row."""
    return {
        field: value
        for field, value in msgspec.structs.asdict(params).items()
        if value is not UNSET and field not in keys
    }


class ListToolsParams(Struct):
    status: Annotated[
        str | UnsetType, Meta(description="Filter by draft, published or archived.")
    ] = UNSET
    q: Annotated[str | UnsetType, Meta(description="Substring of the name, slug or vendor.")] = (
        UNSET
    )
    unlistable_only: Annotated[
        bool | UnsetType,
        Meta(description="Only tools that do not yet clear the publication bar."),
    ] = UNSET
    limit: Annotated[int, Meta(ge=1, le=100)] = 20
    offset: Annotated[int, Meta(ge=0)] = 0


class ToolRow(Struct):
    slug: str
    name: str
    vendor: str
    status: str
    plans: int
    price_from: str | None
    listable: bool


class ToolPage(Struct):
    count: Annotated[int, Meta(description="The whole filtered set, not this page.")]
    items: list[ToolRow]


class SlugParams(Struct):
    slug: SLUG


class PriceOut(Struct):
    amount: str
    currency: str
    unit: str
    billing_period: str
    is_overage: bool
    source: str
    source_note: str


class LimitOut(Struct):
    kind: str
    label: str
    value: str


class PlanOut(Struct):
    code: str
    name: str
    tier_order: int
    is_public: bool
    is_free_tier: bool
    is_trial: bool
    trial_days: int | None
    is_enterprise_quote: bool
    min_seats: int
    highlights: list[str]
    source_url: str
    prices: list[PriceOut]
    limits: list[LimitOut]


class FacetOut(Struct):
    dimension: str
    value: str


class ToolDetail(Struct):
    slug: str
    name: str
    vendor: str
    status: str
    website_url: str
    pricing_url: str
    docs_url: str
    logo_url: str
    is_first_party: bool
    tagline: str
    summary: str
    description_md: str
    vendor_copy_md: str
    pros: list[Any]
    cons: list[Any]
    editor_verdict: str
    editor_notes: str
    sort_order: int
    last_verified_at: str | None
    prices_changed_at: str | None
    facets: list[FacetOut]
    plans: list[PlanOut]
    open_revisions: int
    open_price_proposals: int
    listable: bool
    listability_reasons: list[str]


class PlanList(Struct):
    tool: str
    plans: list[PlanOut]


class UpdateToolParams(Struct):
    """Only the fields you pass are written. Omit a field to leave it alone."""

    slug: SLUG
    name: str | UnsetType = UNSET
    website_url: str | UnsetType = UNSET
    pricing_url: str | UnsetType = UNSET
    docs_url: str | UnsetType = UNSET
    logo_url: Annotated[
        str | UnsetType, Meta(description="Site-relative path (preferred) or absolute URL.")
    ] = UNSET
    is_first_party: Annotated[
        bool | UnsetType, Meta(description="Our own product - triggers the disclosure banner.")
    ] = UNSET
    tagline: str | UnsetType = UNSET
    summary: Annotated[
        str | UnsetType, Meta(description="40-60 words; the liftable paragraph.")
    ] = UNSET
    description_md: Annotated[
        str | UnsetType,
        Meta(
            description=(
                "Our own editorial, in Markdown. 400 characters or more, or the "
                "tool is not listable. Vendor copy does not count - put that in "
                "vendor_copy_md."
            )
        ),
    ] = UNSET
    vendor_copy_md: Annotated[
        str | UnsetType, Meta(description='Fenced "From the vendor" block.')
    ] = UNSET
    pros: list[str] | UnsetType = UNSET
    cons: list[str] | UnsetType = UNSET
    faq: Annotated[list[dict[str, str]] | UnsetType, Meta(description="[{question, answer}]")] = (
        UNSET
    )
    editor_verdict: str | UnsetType = UNSET
    editor_notes: str | UnsetType = UNSET
    sort_order: Annotated[int, Meta(ge=0)] | UnsetType = UNSET


class UpdateToolResult(Struct):
    slug: str
    changed: Annotated[
        list[str], Meta(description="Fields that actually moved; empty if nothing did.")
    ]
    listable: bool
    listability_reasons: list[str]


class CreatePlanParams(Struct):
    slug: SLUG
    code: Annotated[
        str,
        Meta(
            description=(
                "A new stable code, lowercase and hyphenated, e.g. 'pro-plus'. "
                "The price crawler matches on it and it cannot be changed later."
            )
        ),
    ]
    name: Annotated[str, Meta(description="What the vendor calls the tier, e.g. 'Pro Plus'.")]
    tier_order: Annotated[int, Meta(ge=0)] | UnsetType = UNSET
    is_public: bool | UnsetType = UNSET
    is_free_tier: bool | UnsetType = UNSET
    is_trial: Annotated[bool | UnsetType, Meta(description="A trial is not a free tier.")] = UNSET
    trial_days: Annotated[int, Meta(ge=0)] | UnsetType = UNSET
    is_enterprise_quote: bool | UnsetType = UNSET
    min_seats: Annotated[int, Meta(ge=1)] | UnsetType = UNSET
    highlights: list[str] | UnsetType = UNSET
    source_url: str | UnsetType = UNSET


class CreatePlanResult(Struct):
    tool: str
    code: str
    name: str
    has_pricing_position: Annotated[
        bool,
        Meta(
            description=(
                "False until the plan has a current price, a free-tier flag or "
                "the quote-only flag. While it is False the plan is invisible "
                "to the public catalog."
            )
        ),
    ]


class SetPlanLimitParams(Struct):
    slug: SLUG
    code: PLAN_CODE
    kind: Annotated[
        str,
        Meta(
            description=(
                "pages_per_document, pages_per_month, documents_per_month, "
                "minutes_per_month, file_size_mb, seats, retention_days, "
                "api_calls_per_month or other."
            )
        ),
    ]
    value: Annotated[int, Meta(ge=0)] | UnsetType = UNSET
    is_unlimited: bool = False
    note: Annotated[
        str,
        Meta(description="What the vendor publishes instead of a number. Never a guess."),
    ] = ""


class SetPlanLimitResult(Struct):
    tool: str
    code: str
    kind: str
    label: str
    display: str
    created: bool


class UpdatePlanParams(Struct):
    """Only the fields you pass are written. Omit a field to leave it alone."""

    slug: SLUG
    code: PLAN_CODE
    name: str | UnsetType = UNSET
    tier_order: Annotated[int, Meta(ge=0)] | UnsetType = UNSET
    is_public: bool | UnsetType = UNSET
    is_free_tier: bool | UnsetType = UNSET
    is_trial: Annotated[bool | UnsetType, Meta(description="A trial is not a free tier.")] = UNSET
    trial_days: Annotated[int, Meta(ge=0)] | UnsetType = UNSET
    is_enterprise_quote: bool | UnsetType = UNSET
    min_seats: Annotated[int, Meta(ge=1)] | UnsetType = UNSET
    highlights: list[str] | UnsetType = UNSET
    source_url: str | UnsetType = UNSET


class UpdatePlanResult(Struct):
    tool: str
    code: str
    changed: list[str]


class SetPlanPriceParams(Struct):
    slug: SLUG
    code: PLAN_CODE
    amount: Annotated[str, Meta(description="Decimal string, e.g. '19.00'.")]
    unit: Annotated[
        str,
        Meta(
            description=(
                "month, year, seat_month, seat_year, page, document, minute, credit or one_time."
            )
        ),
    ]
    billing_period: Annotated[str, Meta(description="monthly, annual, one_time, usage or none.")]
    source_note: Annotated[
        str, Meta(description="Where the figure came from. Shown as its provenance.")
    ]
    currency: Annotated[str, Meta(min_length=3, max_length=3)] = "USD"
    is_overage: Annotated[
        bool,
        Meta(
            description=(
                "True only for the rate charged beyond a plan's included "
                "allowance - never for the plan's own price."
            )
        ),
    ] = False
    source_evidence_url: Annotated[
        str, Meta(description="The vendor page the figure was read from.")
    ] = ""


class SetPlanPriceResult(Struct):
    changed: Annotated[
        bool, Meta(description="False when the figure had not moved and nothing was written.")
    ]
    price: PriceOut
    previous: PriceOut | None


def register(server):
    """Attach the staff catalog tools to `server`."""

    @server.tool(
        description=(
            "List catalog tools - the products in the directory, not MCP tools. "
            "Includes drafts and archived rows, which the public API hides. "
            "Returns compact rows; call catalog_get_tool for the full record."
        ),
        read_only=True,
        idempotent=True,
        open_world=False,
        permission=is_staff,
    )
    def catalog_list_tools(request, params: ListToolsParams) -> ToolPage:
        with _as_tool_error():
            return msgspec.convert(staff.list_tools(**_changes(params)), ToolPage)

    @server.tool(
        description=(
            "Read one listing in full: every editable field, its facets, its "
            "plans with their current prices, and listability_reasons - what "
            "stands between it and being a public page."
        ),
        read_only=True,
        idempotent=True,
        open_world=False,
        permission=is_staff,
    )
    def catalog_get_tool(request, params: SlugParams) -> ToolDetail:
        with _as_tool_error():
            return msgspec.convert(staff.tool_detail(params.slug), ToolDetail)

    @server.tool(
        description="List one tool's plans, with their current prices and limits.",
        read_only=True,
        idempotent=True,
        open_world=False,
        permission=is_staff,
    )
    def catalog_list_plans(request, params: SlugParams) -> PlanList:
        with _as_tool_error():
            return msgspec.convert(staff.list_plans(slug=params.slug), PlanList)

    @server.tool(
        description=(
            "Edit a listing. Only the fields you pass are written; omit the "
            "rest. The edit is live and is recorded as an applied revision. "
            "Returns the fields that actually moved, and whether the tool now "
            "clears the publication bar."
        ),
        read_only=False,
        destructive=True,
        idempotent=True,
        open_world=False,
        permission=is_staff,
    )
    def catalog_update_tool(request, params: UpdateToolParams) -> UpdateToolResult:
        with _as_tool_error():
            return msgspec.convert(
                staff.update_tool(
                    user=request.user, slug=params.slug, changes=_changes(params, "slug")
                ),
                UpdateToolResult,
            )

    @server.tool(
        description=(
            "Add a plan to a tool. The price is a separate call - "
            "catalog_set_plan_price - so a figure keeps its own provenance, and "
            "a published cap is catalog_set_plan_limit. A plan with no price, "
            "free-tier flag or quote-only flag holds no pricing position and "
            "stays invisible to the public catalog, so do not stop here."
        ),
        read_only=False,
        destructive=False,
        idempotent=False,
        open_world=False,
        permission=is_staff,
    )
    def catalog_create_plan(request, params: CreatePlanParams) -> CreatePlanResult:
        with _as_tool_error():
            return msgspec.convert(
                staff.create_plan(
                    user=request.user,
                    slug=params.slug,
                    code=params.code,
                    name=params.name,
                    changes=_changes(params, "slug", "code", "name"),
                ),
                CreatePlanResult,
            )

    @server.tool(
        description=(
            "Record a plan's published cap - a page allowance, a seat count, a "
            "file-size limit. Replaces the cap of that kind rather than adding "
            "a second. A cap with no number needs is_unlimited or a note: the "
            "catalog records what the vendor published, never a guess. "
            "pages_per_month is what makes an overage rate apply."
        ),
        read_only=False,
        destructive=True,
        idempotent=True,
        open_world=False,
        permission=is_staff,
    )
    def catalog_set_plan_limit(request, params: SetPlanLimitParams) -> SetPlanLimitResult:
        with _as_tool_error():
            fields = _changes(params, "slug", "code")
            return msgspec.convert(
                staff.set_plan_limit(
                    user=request.user, slug=params.slug, code=params.code, **fields
                ),
                SetPlanLimitResult,
            )

    @server.tool(
        description=(
            "Edit one plan of one tool. Only the fields you pass are written. "
            "The plan's code cannot be changed - the price crawler matches on it."
        ),
        read_only=False,
        destructive=True,
        idempotent=True,
        open_world=False,
        permission=is_staff,
    )
    def catalog_update_plan(request, params: UpdatePlanParams) -> UpdatePlanResult:
        with _as_tool_error():
            return msgspec.convert(
                staff.update_plan(
                    user=request.user,
                    slug=params.slug,
                    code=params.code,
                    changes=_changes(params, "slug", "code"),
                ),
                UpdatePlanResult,
            )

    @server.tool(
        description=(
            "Publish a plan's price. The figure it supersedes is closed rather "
            "than edited, so the published history survives. Exactly one "
            "current figure per plan, currency, billing period and overage "
            "flag. Calling this with a figure that has not moved writes nothing."
        ),
        read_only=False,
        # Appends to a history and closes a row; it deletes nothing.
        destructive=False,
        idempotent=True,
        open_world=False,
        permission=is_staff,
    )
    def catalog_set_plan_price(request, params: SetPlanPriceParams) -> SetPlanPriceResult:
        with _as_tool_error():
            return msgspec.convert(
                staff.set_plan_price(user=request.user, **msgspec.structs.asdict(params)),
                SetPlanPriceResult,
            )
