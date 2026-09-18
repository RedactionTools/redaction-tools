"""Response schemas for the catalog API.

Every route declares a real schema rather than a bare dict: the OpenAPI document
is what Orval turns into the typed frontend client, and an undeclared shape
generates an untyped one.
"""

from datetime import datetime
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


class ToolDetailOut(ToolListItemOut):
    website_url: str
    pricing_url: str
    docs_url: str
    description_md: str
    vendor_copy_md: str
    pros: list[str]
    cons: list[str]
    faq: list[dict]
    facets: list[ToolFacetOut]
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
