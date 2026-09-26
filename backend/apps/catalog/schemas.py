"""Response schemas for the catalog API.

Every route declares a real schema rather than a bare dict: the OpenAPI document
is what Orval turns into the typed frontend client, and an undeclared shape
generates an untyped one.
"""

from datetime import date, datetime
from decimal import Decimal

from ninja import Schema


class VendorOut(Schema):
    slug: str
    name: str
    hq_country: str


class PriceOut(Schema):
    amount: Decimal
    currency: str
    unit: str
    billing_period: str
    # True marks the rate charged beyond the plan's allowance, so a reader never
    # mistakes a metered plan's overage for what the plan itself costs.
    is_overage: bool
    source: str
    is_pinned: bool
    source_note: str
    source_evidence_url: str
    effective_from: datetime


class PlanLimitOut(Schema):
    kind: str
    label: str
    value: int | None
    unit: str
    is_unlimited: bool
    note: str
    display: str


class PlanOut(Schema):
    code: str
    name: str
    tier_order: int
    is_free_tier: bool
    is_trial: bool
    trial_days: int | None
    is_enterprise_quote: bool
    min_seats: int
    highlights: list[str]
    source_url: str
    verified_at: datetime | None
    prices: list[PriceOut]
    limits: list[PlanLimitOut]


class PriceSummaryOut(Schema):
    """The one price a comparison row can honestly show, plus its provenance."""

    has_free_tier: bool
    is_trial: bool
    trial_days: int | None
    is_quote_only: bool
    from_amount: Decimal | None
    currency: str | None
    unit: str | None
    billing_period: str | None
    source: str | None
    is_pinned: bool
    source_note: str
    source_url: str
    last_verified_at: datetime | None
    last_changed_at: datetime | None
    is_stale: bool


class ToolListItemOut(Schema):
    slug: str
    name: str
    tagline: str
    summary: str
    logo_url: str
    is_first_party: bool
    vendor: VendorOut
    facet_slugs: list[str]
    price_summary: PriceSummaryOut


class ToolPageOut(Schema):
    """One page of hub rows. `count` is the size of the whole filtered set."""

    count: int
    items: list[ToolListItemOut]


class ToolFacetOut(Schema):
    """One recorded fact about a tool, carrying its own label.

    The list rows ship bare slugs, which is all a filter needs. A profile names
    what it shows, and resolving a slug to a label client-side would mean a
    second copy of the taxonomy in the frontend - or a request for the whole of
    it, which `list_facets` counts over every listable tool to answer.
    """

    dimension: str
    dimension_label: str
    slug: str
    label: str


class ToolScreenshotOut(Schema):
    """One picture of the tool, in every width it was rendered at.

    `url` is for a bare `src` and `srcset` is the real payload: the same capture
    at several widths, so the browser picks by viewport rather than being sent
    the desktop rendition on a phone. `width` and `height` are the source's, and
    are what lets a figure reserve its space before the image arrives.
    """

    url: str
    srcset: str
    width: int
    height: int
    alt: str
    caption: str
    # A UI shot goes stale silently, so a profile can say how old this one is.
    captured_at: date | None


class FaqItemOut(Schema):
    """One question a listing answers.

    Typed rather than left as a bare dict so the generated client gets a real
    shape instead of `{[key: string]: unknown}` - which is what kept the field
    unrendered. The source is a JSONField typed by hand in the admin, so the
    view normalises before serialising: with this schema in place a mistyped
    key would be a 500 on a public page rather than a missing answer.
    """

    question: str
    answer: str


class ToolDetailOut(ToolListItemOut):
    website_url: str
    pricing_url: str
    docs_url: str
    description_md: str
    vendor_copy_md: str
    pros: list[str]
    cons: list[str]
    faq: list[FaqItemOut]
    facets: list[ToolFacetOut]
    screenshots: list[ToolScreenshotOut]
    plans: list[PlanOut]
    updated_at: datetime


class FacetValueOut(Schema):
    code: str
    slug: str
    label: str
    has_landing_page: bool
    tool_count: int


class FacetDimensionOut(Schema):
    code: str
    label: str
    values: list[FacetValueOut]


class CatalogStatsOut(Schema):
    """What the homepage lede states: a count, a date and a price range."""

    tools: int
    with_free_tier: int
    media: list[str]
    cheapest_amount: Decimal | None
    dearest_amount: Decimal | None
    currency: str
    generated_at: datetime


class ToolSubmissionIn(Schema):
    """What a submitter may state. None of it is published verbatim."""

    name: str
    homepage_url: str
    description: str
    vendor_name: str = ""
    pricing_url: str = ""
    docs_url: str = ""
    logo_url: str = ""
    proposed_media: str = ""
    proposed_deployment: str = ""
    proposed_method: str = ""
    notes: str = ""
    contact_email: str = ""
    submitter_is_owner: bool = False


class ToolSubmissionOut(Schema):
    id: int
    name: str
    homepage_url: str
    status: str
    created_at: datetime
    reviewed_at: datetime | None


class ToolClaimIn(Schema):
    tool: str
    work_email: str
    role: str = ""
    evidence: str = ""


class ToolClaimVerifyIn(Schema):
    code: str


class ToolClaimOut(Schema):
    id: int
    tool: str
    work_email: str
    domain_matched: bool
    status: str
    email_verified_at: datetime | None
    created_at: datetime


class MyListingOut(Schema):
    """An owner's own view of a listing.

    Carries every field in `OWNER_EDITABLE_FIELDS` because the owner's editor
    prefills from here rather than from the public profile, which 404s on a
    listing that is not listable - the one its owner most needs to correct.
    """

    slug: str
    status: str
    name: str
    tagline: str
    summary: str
    website_url: str
    pricing_url: str
    docs_url: str
    logo_url: str
    vendor_copy_md: str
    facet_slugs: list[str]


class ScreenshotUploadIn(Schema):
    """The fields that travel beside the file in a multipart upload."""

    alt_text: str
    caption: str = ""
    captured_at: date | None = None


class MyScreenshotOut(Schema):
    """An owner's own view of a picture they uploaded, at any status.

    Carries `status` and `review_note` because the pending and rejected states
    are the two an owner needs explained: a picture that is on the profile needs
    no telling, and one that was turned down should say why rather than appear
    to have vanished.
    """

    id: int
    url: str
    srcset: str
    width: int
    height: int
    alt: str
    caption: str
    status: str
    review_note: str
    created_at: datetime


class ToolRevisionIn(Schema):
    changes: dict


class ToolRevisionOut(Schema):
    id: int
    tool: str
    changes: dict
    status: str
    admin_comment: str
    created_at: datetime
    applied_at: datetime | None


class PriceProposalIn(Schema):
    """A proposed figure. `plan` is the plan code, or null for a missing plan."""

    plan: str | None = None
    proposed_plan_name: str = ""
    amount: Decimal | None = None
    currency: str = "USD"
    unit: str = ""
    billing_period: str = ""
    is_free_tier: bool = False
    is_trial: bool = False
    trial_days: int | None = None
    is_enterprise_quote: bool = False
    rationale: str = ""
    evidence_url: str = ""


class PriceProposalOut(Schema):
    id: int
    tool: str
    plan: str | None
    amount: Decimal | None
    currency: str
    unit: str
    billing_period: str
    status: str
    created_at: datetime


# --- Staff -------------------------------------------------------------------
# The shapes `apps.catalog.staff` already returns, declared so the tool page's
# inline editors get a typed client.


class StaffChangesIn(Schema):
    # A dict rather than a field per column: `staff.update_tool` owns the
    # allowlist and names every field it refuses.
    changes: dict


class StaffToolUpdateOut(Schema):
    slug: str
    changed: list[str]
    listable: bool
    listability_reasons: list[str]


class StaffPriceOut(Schema):
    amount: str
    currency: str
    unit: str
    billing_period: str
    is_overage: bool
    source: str
    source_note: str


class StaffLimitOut(Schema):
    kind: str
    label: str
    value: str


class StaffPlanOut(Schema):
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
    prices: list[StaffPriceOut]
    limits: list[StaffLimitOut]


class StaffFacetOut(Schema):
    dimension: str
    value: str
    slug: str
    evidence_url: str
    verified_at: str | None


class StaffToolOut(Schema):
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
    pros: list[str]
    cons: list[str]
    faq: list[FaqItemOut]
    editor_verdict: str
    editor_notes: str
    sort_order: int
    last_verified_at: str | None
    prices_changed_at: str | None
    facets: list[StaffFacetOut]
    plans: list[StaffPlanOut]
    open_revisions: int
    open_price_proposals: int
    listable: bool
    listability_reasons: list[str]


class StaffPlanCreateIn(Schema):
    code: str
    name: str
    changes: dict = {}


class StaffPlanCreateOut(Schema):
    tool: str
    code: str
    name: str
    has_pricing_position: bool


class StaffPlanUpdateOut(Schema):
    tool: str
    code: str
    changed: list[str]


class StaffPlanLimitIn(Schema):
    value: int | None = None
    is_unlimited: bool = False
    note: str = ""


class StaffPlanLimitOut(Schema):
    tool: str
    code: str
    kind: str
    label: str
    display: str
    created: bool


class StaffPlanPriceIn(Schema):
    amount: Decimal
    unit: str
    billing_period: str
    currency: str = "USD"
    is_overage: bool = False
    source_note: str = ""
    source_evidence_url: str = ""


class StaffPlanPriceOut(Schema):
    changed: bool
    price: StaffPriceOut
    previous: StaffPriceOut | None


class StaffToolFacetIn(Schema):
    # Codes, not slugs: the pair `GET /catalog/facets` reports, and the one a
    # slug-less value (`api`) still has.
    dimension: str
    value: str
    evidence_url: str = ""
    verified_at: date | None = None


class StaffToolFacetOut(Schema):
    tool: str
    facet: StaffFacetOut
    listable: bool
    listability_reasons: list[str]


class StaffToolFacetRemovedOut(Schema):
    tool: str
    removed: StaffFacetOut
    listable: bool
    listability_reasons: list[str]


class StaffScreenshotOut(Schema):
    id: int
    tool: str
    alt_text: str
    caption: str
    status: str
    source: str
    source_url: str
    width: int
    height: int
    rendition_widths: list[int]
    url: str
    captured_at: str | None
    review_note: str


class StaffScreenshotReviewIn(Schema):
    status: str
    note: str = ""


class StaffToolLogoOut(StaffToolUpdateOut):
    logo_url: str
