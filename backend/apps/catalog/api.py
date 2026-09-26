"""The public catalog API.

Route function names are the operation ids, and therefore the generated hook
names - `list_tools` becomes `useListTools()`. They must stay unique across the
whole API; `tests/test_openapi_schema.py` enforces that.

Everything here serves the listable set only. `is_listable()` reads related rows
and is therefore applied in Python, so these routes page an in-memory list rather
than a queryset - correct at catalog scale, and the point at which that stops
being true is the point to move the bar into SQL.
"""

from types import SimpleNamespace

from django.conf import settings
from django.http import HttpRequest
from django.utils import timezone
from ninja import File, Form, Query, Router, Status
from ninja.errors import HttpError, ValidationError
from ninja.files import UploadedFile

from apps.accounts.api import JWTAuth
from apps.benchmarks import leaderboard
from apps.catalog import images
from apps.catalog import screenshots as screenshot_service
from apps.catalog.claims import domain_matches, issue_claim_code, verify_claim_code
from apps.catalog.constants import OWNER_EDITABLE_FIELDS, URL_FIELDS
from apps.catalog.filters import ToolFilters, apply_filters
from apps.catalog.images import ImageRejected
from apps.catalog.models import (
    FacetDimension,
    FacetValue,
    PriceProposal,
    PriceProposalStatus,
    Tool,
    ToolClaim,
    ToolClaimStatus,
    ToolRevision,
    ToolScreenshot,
    ToolScreenshotSource,
    ToolScreenshotStatus,
    ToolStatus,
    ToolSubmission,
)
from apps.catalog.pricing import price_summary, sort_key
from apps.catalog.schemas import (
    CatalogStatsOut,
    FacetDimensionOut,
    MyListingOut,
    MyScreenshotOut,
    PriceProposalIn,
    PriceProposalOut,
    ScreenshotUploadIn,
    ToolClaimIn,
    ToolClaimOut,
    ToolClaimVerifyIn,
    ToolDetailOut,
    ToolListItemOut,
    ToolPageOut,
    ToolRevisionIn,
    ToolRevisionOut,
    ToolSubmissionIn,
    ToolSubmissionOut,
)
from apps.catalog.services import check_external_urls, client_ip, conflict, normalize_host
from apps.catalog.throttles import ClaimThrottle, ScreenshotThrottle, SubmitThrottle
from apps.core.schemas import ErrorSchema

router = Router(tags=["catalog"])

MAX_PAGE_SIZE = 100


def _base_queryset():
    return (
        Tool.objects.published()
        .select_related("vendor")
        .prefetch_related(
            "facets__value__dimension", "plans__prices", "plans__limits", "screenshots"
        )
    )


def _row(tool):
    return {
        "slug": tool.slug,
        "name": tool.name,
        "tagline": tool.tagline,
        "summary": tool.summary,
        "logo_url": tool.logo_url,
        "is_first_party": tool.is_first_party,
        "vendor": tool.vendor,
        "facet_slugs": tool.facet_slugs,
        "price_summary": price_summary(tool),
    }


def _faq(tool):
    """The questions this listing answers, less anything malformed.

    `Tool.faq` is a JSONField typed by hand in the admin, and `FaqItemOut` is
    strict about it. Without this filter a single mistyped key would turn a
    published profile into a 500 - so the boundary drops what it cannot
    serialise rather than letting one bad row take the page down.
    """
    entries = tool.faq if isinstance(tool.faq, list) else []
    return [
        {"question": entry["question"].strip(), "answer": entry["answer"].strip()}
        for entry in entries
        if isinstance(entry, dict)
        and isinstance(entry.get("question"), str)
        and isinstance(entry.get("answer"), str)
        and entry["question"].strip()
        and entry["answer"].strip()
    ]


def _facets(tool):
    """The tool's facets in the taxonomy's own order, so a page renders them in
    the order the editors chose rather than by primary key."""
    facets = sorted(
        tool.facets.all(),
        key=lambda facet: (
            facet.value.dimension.sort_order,
            facet.value.dimension.code,
            facet.value.sort_order,
            facet.value.code,
        ),
    )
    return [
        {
            "dimension": facet.value.dimension.code,
            "dimension_label": facet.value.dimension.label,
            "slug": facet.value.slug,
            "label": facet.value.label,
        }
        for facet in facets
    ]


def _screenshots(tool):
    """The tool's published pictures. Anything awaiting review is not a picture
    of this tool as far as the public API is concerned."""
    return [
        {
            "url": shot.display_url,
            "srcset": shot.srcset,
            "width": shot.width,
            "height": shot.height,
            "alt": shot.alt_text,
            "caption": shot.caption,
            "captured_at": shot.captured_at,
        }
        for shot in tool.screenshots.all()
        if shot.status == ToolScreenshotStatus.PUBLISHED
    ]


def _listable(queryset):
    return [tool for tool in queryset if tool.is_listable()]


@router.get("/tools", response=ToolPageOut, summary="List catalog tools")
def list_tools(
    request: HttpRequest,
    filters: ToolFilters = Query(...),  # noqa: B008 - ninja's declarative query binding
    page: int = 1,
    page_size: int = 50,
):
    tools = _listable(apply_filters(_base_queryset(), filters))
    rows = [(tool, _row(tool)) for tool in tools]

    if filters.has_free_tier is not None:
        rows = [
            pair
            for pair in rows
            if pair[1]["price_summary"]["has_free_tier"] == filters.has_free_tier
        ]

    ordering = filters.ordering or "price"
    if ordering in ("name", "-name"):
        rows.sort(key=lambda pair: pair[0].name.lower(), reverse=ordering.startswith("-"))
    elif ordering == "verified":
        rows.sort(
            key=lambda pair: (
                pair[0].last_verified_at is None,
                -(pair[0].last_verified_at.timestamp() if pair[0].last_verified_at else 0),
            )
        )
    else:
        keyed = [(sort_key(tool, row["price_summary"]), tool, row) for tool, row in rows]
        keyed.sort(key=lambda item: item[0])
        if ordering == "-price":
            # Unpriced tools stay last in BOTH directions: reversing the order
            # must not float "we could not price this" to the top.
            priced = [item for item in keyed if item[0][0] == 0]
            unpriced = [item for item in keyed if item[0][0] == 1]
            keyed = list(reversed(priced)) + unpriced
        rows = [(tool, row) for _, tool, row in keyed]

    page_size = max(1, min(page_size, MAX_PAGE_SIZE))
    start = (max(page, 1) - 1) * page_size
    window = rows[start : start + page_size]

    return {
        "count": len(rows),
        "items": [ToolListItemOut(**row).dict() for _, row in window],
    }


@router.get(
    "/tools/{slug}", response={200: ToolDetailOut, 404: ErrorSchema}, summary="One tool profile"
)
def get_tool(request: HttpRequest, slug: str):
    tool = _base_queryset().filter(slug=slug).first()
    if tool is None or not tool.is_listable():
        return Status(404, {"detail": "No tool with that slug."})

    plans = [
        {
            "code": plan.code,
            "name": plan.name,
            "tier_order": plan.tier_order,
            "is_free_tier": plan.is_free_tier,
            "is_trial": plan.is_trial,
            "trial_days": plan.trial_days,
            "is_enterprise_quote": plan.is_enterprise_quote,
            "min_seats": plan.min_seats,
            "highlights": plan.highlights,
            "source_url": plan.source_url,
            "verified_at": plan.verified_at,
            "prices": [price for price in plan.prices.all() if price.is_current],
            "limits": [
                {
                    "kind": limit.kind,
                    "label": limit.label,
                    "value": limit.value,
                    "unit": limit.unit,
                    "is_unlimited": limit.is_unlimited,
                    "note": limit.note,
                    "display": limit.display_value,
                }
                for limit in plan.limits.all()
            ],
        }
        for plan in tool.plans.all()
        if plan.is_public
    ]

    return Status(
        200,
        {
            **_row(tool),
            "website_url": tool.website_url,
            "pricing_url": tool.pricing_url,
            "docs_url": tool.docs_url,
            "description_md": tool.description_md,
            "vendor_copy_md": tool.vendor_copy_md,
            "pros": tool.pros,
            "cons": tool.cons,
            "faq": _faq(tool),
            "facets": _facets(tool),
            "screenshots": _screenshots(tool),
            "plans": plans,
            "benchmarks": [
                {"suite": suite.slug, "name": suite.name}
                for suite in leaderboard.suites_for_tool(tool)
            ],
            "updated_at": tool.updated_at,
        },
    )


@router.get("/facets", response=list[FacetDimensionOut], summary="Facet dimensions and counts")
def list_facets(request: HttpRequest):
    listable_ids = {tool.id for tool in _listable(_base_queryset())}

    dimensions = FacetDimension.objects.prefetch_related("values__tools")
    return [
        {
            "code": dimension.code,
            "label": dimension.label,
            "values": [
                {
                    "code": value.code,
                    "slug": value.slug,
                    "label": value.label,
                    "has_landing_page": value.is_landing_page,
                    # Counted over listable tools only, so a filter never promises
                    # results the list cannot deliver.
                    "tool_count": sum(
                        1 for link in value.tools.all() if link.tool_id in listable_ids
                    ),
                }
                for value in dimension.values.all()
            ],
        }
        for dimension in dimensions
    ]


@router.get("/stats", response=CatalogStatsOut, summary="Catalog totals for the hub lede")
def get_catalog_stats(request: HttpRequest):
    tools = _listable(_base_queryset())
    summaries = [price_summary(tool) for tool in tools]
    amounts = [
        summary["from_amount"]
        for summary in summaries
        if summary["from_amount"] is not None and summary["currency"] == "USD"
    ]

    return {
        "tools": len(tools),
        "with_free_tier": sum(1 for summary in summaries if summary["has_free_tier"]),
        "media": [value.code for value in FacetDimension.objects.get(code="media").values.all()],
        "cheapest_amount": min(amounts) if amounts else None,
        "dearest_amount": max(amounts) if amounts else None,
        "currency": "USD",
        "generated_at": timezone.now(),
    }


# --- Submission ------------------------------------------------------------
# Login is the primary anti-spam control: a spammer needs a verified account per
# campaign rather than a bare HTTP POST. That removes the whole anonymous-abuse
# surface, and with it the honeypot, the double opt-in and the nightly sweep of
# unconfirmed rows that an open endpoint would have needed.


@router.post(
    "/submissions",
    response={201: ToolSubmissionOut},
    auth=JWTAuth(),
    throttle=[SubmitThrottle()],
    summary="Submit a tool for review",
)
def submit_tool(request: HttpRequest, payload: ToolSubmissionIn):
    check_external_urls(payload, ("homepage_url", "pricing_url", "docs_url", "logo_url"))

    open_count = ToolSubmission.objects.filter(
        submitted_by=request.auth, status__in=ToolSubmission.OPEN_STATUSES
    ).count()
    if open_count >= settings.CATALOG_MAX_OPEN_SUBMISSIONS:
        raise conflict(
            f"You already have {open_count} submissions awaiting review. "
            "We will get to them before you send more."
        )

    host = normalize_host(payload.homepage_url)
    existing = next(
        (tool for tool in Tool.objects.all() if normalize_host(tool.website_url) == host), None
    )
    if existing is not None:
        # Point them at the claim flow rather than growing a duplicate queue.
        raise conflict(
            f"We already list that site as {existing.name} (/tool/{existing.slug}). "
            "If you work for the vendor, claim the listing instead."
        )
    if (
        ToolSubmission.objects.filter(status__in=ToolSubmission.OPEN_STATUSES)
        .filter(homepage_url__icontains=host)
        .exists()
    ):
        raise conflict("That site has already been submitted and is awaiting review.")

    submission = ToolSubmission.objects.create(
        **payload.dict(),
        submitted_by=request.auth,
        source_ip=client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:512],
    )
    return Status(201, submission)


@router.get(
    "/submissions",
    response=list[ToolSubmissionOut],
    auth=JWTAuth(),
    summary="Submissions you have made",
)
def list_my_submissions(request: HttpRequest):
    return ToolSubmission.objects.filter(submitted_by=request.auth)


# --- Claim -----------------------------------------------------------------
# A verified code proves someone can receive mail at the vendor's domain. It does
# not prove who they are, so every claim - domain-matched or not - still passes
# through staff review. Auto-approving on a domain match alone would hand edit
# rights on a ranking page to anyone with a catch-all mailbox.


def _claim_out(claim):
    return {
        "id": claim.pk,
        "tool": claim.tool.slug,
        "work_email": claim.work_email,
        "domain_matched": claim.domain_matched,
        "status": claim.status,
        "email_verified_at": claim.email_verified_at,
        "created_at": claim.created_at,
    }


@router.post(
    "/claims",
    response={201: ToolClaimOut, 404: ErrorSchema},
    auth=JWTAuth(),
    throttle=[ClaimThrottle()],
    summary="Claim a listing",
)
def claim_tool(request: HttpRequest, payload: ToolClaimIn):
    tool = Tool.objects.exclude(status=ToolStatus.ARCHIVED).filter(slug=payload.tool).first()
    if tool is None:
        return Status(404, {"detail": "No tool with that slug."})

    if ToolClaim.objects.filter(tool=tool, user=request.auth).exists():
        raise conflict("You have already claimed this listing.")

    claim = ToolClaim.objects.create(
        tool=tool,
        user=request.auth,
        work_email=payload.work_email,
        email_domain=payload.work_email.rsplit("@", 1)[-1].lower(),
        role=payload.role,
        evidence=payload.evidence,
        domain_matched=domain_matches(payload.work_email, tool.website_url),
    )
    issue_claim_code(claim)
    return Status(201, _claim_out(claim))


@router.post(
    "/claims/{claim_id}/verify",
    response={200: ToolClaimOut, 400: ErrorSchema, 404: ErrorSchema},
    auth=JWTAuth(),
    throttle=[ClaimThrottle()],
    summary="Confirm the emailed claim code",
)
def verify_tool_claim(request: HttpRequest, claim_id: int, payload: ToolClaimVerifyIn):
    # Scoped to the requester: someone else's claim is not found, not forbidden.
    claim = ToolClaim.objects.filter(pk=claim_id, user=request.auth).first()
    if claim is None:
        return Status(404, {"detail": "No claim with that id."})

    if not verify_claim_code(claim, payload.code):
        return Status(400, {"detail": "That code is not valid."})

    ToolClaim.objects.filter(pk=claim.pk).update(
        email_verified_at=timezone.now(), status=ToolClaimStatus.PENDING_REVIEW
    )
    claim.refresh_from_db()
    return Status(200, _claim_out(claim))


# --- Owner editing ---------------------------------------------------------
# Owners propose, editors dispose. There is deliberately no PATCH on a tool and
# no owner write path to Plan or PlanPrice: a permission bug here cannot become a
# live-price bug, because there is no code path from this API to a published
# figure that does not pass through a staff decision.


def _owned_tool_or_404(request, slug):
    tool = Tool.objects.owned_by(request.auth).filter(slug=slug).first()
    if tool is None:
        # Not found rather than forbidden: whether you own a listing is not
        # something an unrelated account needs confirmed.
        raise HttpError(404, "No listing of yours with that slug.")
    return tool


@router.get(
    "/my-listings", response=list[MyListingOut], auth=JWTAuth(), summary="Listings you maintain"
)
def list_my_listings(request: HttpRequest):
    # Prefetched because the payload carries facet slugs, which the owner's
    # editor prefills from: without it every listing costs its own query.
    return Tool.objects.owned_by(request.auth).prefetch_related("facets__value")


@router.post(
    "/my-listings/{slug}/revisions",
    response={201: ToolRevisionOut},
    auth=JWTAuth(),
    summary="Propose an edit to a listing you maintain",
)
def propose_tool_revision(request: HttpRequest, slug: str, payload: ToolRevisionIn):
    tool = _owned_tool_or_404(request, slug)

    if not payload.changes:
        raise ValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ["body", "changes"],
                    "msg": "Propose at least one change.",
                }
            ]
        )

    forbidden = sorted(set(payload.changes) - OWNER_EDITABLE_FIELDS)
    if forbidden:
        # Named rather than dropped: a silent drop trains vendors to believe an
        # edit landed when it did not.
        raise ValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ["body", "changes", field],
                    "msg": f"{field} is set by our editors and cannot be proposed.",
                }
                for field in forbidden
            ]
        )

    for field in set(payload.changes) & URL_FIELDS:
        check_external_urls(SimpleNamespace(**{field: payload.changes[field]}), (field,))

    if "facet_slugs" in payload.changes:
        _check_facet_slugs(payload.changes["facet_slugs"])

    revision = ToolRevision.objects.create(
        tool=tool,
        author=request.auth,
        changes=payload.changes,
        base_snapshot={field: getattr(tool, field) for field in payload.changes},
    )
    return Status(201, _revision_out(revision))


def _check_facet_slugs(slugs):
    """Every proposed facet has to exist in the taxonomy.

    Refused by name rather than filtered out: a silent drop is how a vendor
    comes to believe they are filed under something they are not.
    """
    if not isinstance(slugs, list) or not all(isinstance(slug, str) for slug in slugs):
        raise ValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ["body", "changes", "facet_slugs"],
                    "msg": "Propose facets as a list of slugs.",
                }
            ]
        )

    known = set(FacetValue.objects.filter(slug__in=slugs).values_list("slug", flat=True))
    unknown = sorted(set(slugs) - known)
    if unknown:
        raise ValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ["body", "changes", "facet_slugs", slug],
                    "msg": f"{slug} is not a facet in this catalog.",
                }
                for slug in unknown
            ]
        )


def _revision_out(revision):
    return {
        "id": revision.pk,
        "tool": revision.tool.slug,
        "changes": revision.changes,
        "status": revision.status,
        "admin_comment": revision.admin_comment,
        "created_at": revision.created_at,
        "applied_at": revision.applied_at,
    }


@router.post(
    "/my-listings/{slug}/price-proposals",
    response={201: PriceProposalOut},
    auth=JWTAuth(),
    throttle=[ClaimThrottle()],
    summary="Propose a price correction",
)
def propose_tool_price(request: HttpRequest, slug: str, payload: PriceProposalIn):
    tool = _owned_tool_or_404(request, slug)
    check_external_urls(payload, ("evidence_url",))

    plan = tool.plans.filter(code=payload.plan).first() if payload.plan else None
    if payload.plan and plan is None:
        raise HttpError(404, "No plan with that code on this listing.")

    current = plan.prices.filter(is_current=True).first() if plan else None
    proposal = PriceProposal.objects.create(
        tool=tool,
        plan=plan,
        proposed_plan_name=payload.proposed_plan_name,
        amount=payload.amount,
        currency=payload.currency,
        unit=payload.unit,
        billing_period=payload.billing_period,
        is_free_tier=payload.is_free_tier,
        is_trial=payload.is_trial,
        trial_days=payload.trial_days,
        is_enterprise_quote=payload.is_enterprise_quote,
        author=request.auth,
        rationale=payload.rationale,
        evidence_url=payload.evidence_url,
        previous_amount=current.amount if current else None,
        previous_currency=current.currency if current else "",
        previous_unit=current.unit if current else "",
    )
    return Status(201, _proposal_out(proposal))


def _proposal_out(proposal):
    return {
        "id": proposal.pk,
        "tool": proposal.tool.slug,
        "plan": proposal.plan.code if proposal.plan else None,
        "amount": proposal.amount,
        "currency": proposal.currency,
        "unit": proposal.unit,
        "billing_period": proposal.billing_period,
        "status": proposal.status,
        "created_at": proposal.created_at,
    }


@router.delete(
    "/price-proposals/{proposal_id}",
    response={204: None, 404: ErrorSchema},
    auth=JWTAuth(),
    summary="Withdraw a pending price proposal",
)
def withdraw_price_proposal(request: HttpRequest, proposal_id: int):
    deleted, _ = PriceProposal.objects.filter(
        pk=proposal_id, author=request.auth, status=PriceProposalStatus.PENDING
    ).delete()
    if not deleted:
        return Status(404, {"detail": "No pending proposal of yours with that id."})
    return Status(204, None)


# --- Owner screenshots -----------------------------------------------------
# The one kind of content an owner holds that we cannot produce ourselves: a
# picture of their own product. Still a proposal - an upload is stored, rendered
# and left pending, and only an editor moves it onto the profile.


def _my_screenshot_out(shot):
    return {
        "id": shot.pk,
        "url": shot.display_url,
        "srcset": shot.srcset,
        "width": shot.width,
        "height": shot.height,
        "alt": shot.alt_text,
        "caption": shot.caption,
        "status": shot.status,
        "review_note": shot.review_note,
        "created_at": shot.created_at,
    }


@router.get(
    "/my-listings/{slug}/screenshots",
    response=list[MyScreenshotOut],
    auth=JWTAuth(),
    summary="Screenshots on a listing you maintain",
)
def list_my_screenshots(request: HttpRequest, slug: str):
    """Every status, not just the published ones: a pending upload that was
    invisible here would be uploaded again."""
    tool = _owned_tool_or_404(request, slug)
    return [_my_screenshot_out(shot) for shot in tool.screenshots.all()]


@router.post(
    "/my-listings/{slug}/screenshots",
    response={201: MyScreenshotOut},
    auth=JWTAuth(),
    throttle=[ScreenshotThrottle()],
    summary="Upload a screenshot of a listing you maintain",
)
def upload_tool_screenshot(
    request: HttpRequest,
    slug: str,
    payload: Form[ScreenshotUploadIn],
    image: File[UploadedFile],
):
    tool = _owned_tool_or_404(request, slug)

    # Stripped before it is judged, so whitespace does not satisfy a field that
    # exists to be read aloud. The admin form strips too and the MCP tool
    # refuses a blank by name; this was the one surface that took it.
    alt_text = payload.alt_text.strip()
    if not alt_text:
        raise ValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ["body", "alt_text"],
                    "msg": "Say what the picture shows: this is read to anyone who cannot see it.",
                }
            ]
        )

    # Rejected uploads do not count: a vendor whose picture was turned down can
    # try a better one, and a rejection that consumed a slot forever would make
    # the review a punishment.
    held = tool.screenshots.exclude(status=ToolScreenshotStatus.REJECTED).count()
    if held >= settings.CATALOG_MAX_SCREENSHOTS:
        raise conflict(
            f"This listing already holds {held} screenshots, which is the limit. "
            "Withdraw one before adding another."
        )

    # Django puts no ceiling on an uploaded file's size - it streams a large one
    # to a temp file - so the size is checked before anything is read into
    # memory to be decoded.
    if image.size > images.MAX_UPLOAD_BYTES:
        raise _image_error(f"That file is too large. The limit is {_max_upload_mb()} MB.")

    try:
        shot = screenshot_service.store(
            tool=tool,
            data=image.read(),
            alt_text=alt_text,
            caption=payload.caption,
            captured_at=payload.captured_at,
            source=ToolScreenshotSource.VENDOR,
            uploaded_by=request.auth,
        )
    except ImageRejected as exc:
        raise _image_error(str(exc)) from exc

    return Status(201, _my_screenshot_out(shot))


@router.delete(
    "/my-listings/{slug}/screenshots/{screenshot_id}",
    response={204: None},
    auth=JWTAuth(),
    summary="Withdraw a screenshot you uploaded",
)
def withdraw_tool_screenshot(request: HttpRequest, slug: str, screenshot_id: int):
    """Only while it is still a proposal.

    A published picture is part of the listing, and a vendor pulling one is an
    edit to the listing - which goes through review like every other edit.
    """
    tool = _owned_tool_or_404(request, slug)
    shot = ToolScreenshot.objects.filter(tool=tool, pk=screenshot_id).first()
    if shot is None:
        raise HttpError(404, "No screenshot of yours with that id.")
    if shot.status == ToolScreenshotStatus.PUBLISHED:
        raise conflict(
            "That screenshot is published. Propose the change and an editor will remove it."
        )

    screenshot_service.discard(shot)
    return Status(204, None)


def _image_error(message):
    return ValidationError([{"type": "value_error", "loc": ["body", "image"], "msg": message}])


def _max_upload_mb():
    return images.MAX_UPLOAD_BYTES // 1024 // 1024
