"""Staff writes against the catalog.

The MCP server is the only caller today, and nothing here knows that: no
request, no transport, no framework. Refusals are raised as `StaffError`, which
each caller turns into whatever it calls a recoverable failure - an in-band
`isError` result for a model, a 422 for a future HTTP route.

`user` is a required argument everywhere rather than read off an ambient
request, so there is no path that writes a price or a revision without recording
who did it.
"""

from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.utils.text import slugify

from apps.catalog import logos
from apps.catalog import screenshots as screenshot_service
from apps.catalog.constants import (
    PLAN_URL_FIELDS,
    STAFF_EDITABLE_PLAN_FIELDS,
    STAFF_EDITABLE_TOOL_FACET_FIELDS,
    STAFF_EDITABLE_TOOL_FIELDS,
    URL_FIELDS,
)
from apps.catalog.images import ImageRejected
from apps.catalog.models import (
    REQUIRED_FACET_DIMENSIONS,
    BillingPeriod,
    FacetDimension,
    FacetValue,
    Plan,
    PlanLimit,
    PlanLimitKind,
    PlanPrice,
    PriceProposalStatus,
    PriceSource,
    PriceUnit,
    Tool,
    ToolFacet,
    ToolRevision,
    ToolRevisionOrigin,
    ToolRevisionStatus,
    ToolScreenshot,
    ToolScreenshotSource,
    ToolScreenshotStatus,
    ToolStatus,
    Vendor,
    listability_blockers,
)
from apps.catalog.services import external_url_errors
from apps.catalog.slugs import validate_catalog_slug as validate_slug


class StaffError(Exception):
    """A write refused for a reason the caller can act on and retry."""


def _reject_unknown_fields(changes, allowed, what):
    if forbidden := sorted(set(changes) - allowed):
        # Named rather than dropped: a silent drop teaches the caller that an
        # edit landed when it did not, and a model will report success.
        raise StaffError(
            f"Not staff-editable on a {what}: {', '.join(forbidden)}. "
            f"Editable: {', '.join(sorted(allowed))}."
        )


def _reject_bad_urls(changes, fields):
    if errors := external_url_errors(changes, set(changes) & fields):
        raise StaffError("; ".join(f"{field}: {message}" for field, message in errors))


def _summary(tool):
    reasons = list(listability_blockers(tool))
    return {"listable": not reasons, "listability_reasons": reasons}


def list_tools(*, status=None, q=None, unlistable_only=False, limit=20, offset=0):
    """A page of listings, drafts and archived rows included.

    Deliberately not `Tool.objects.published()`: the public API hides everything
    that is not a page, and the whole point of a staff surface is to reach the
    rows that are not one yet.
    """
    queryset = Tool.objects.select_related("vendor").prefetch_related(
        "facets__value__dimension", "plans__prices"
    )
    if status:
        if status not in ToolStatus.values:
            raise StaffError(f"status must be one of: {', '.join(ToolStatus.values)}.")
        queryset = queryset.filter(status=status)
    if q:
        queryset = queryset.filter(
            Q(name__icontains=q) | Q(slug__icontains=q) | Q(vendor__name__icontains=q)
        )

    tools = list(queryset)
    if unlistable_only:
        tools = [tool for tool in tools if not tool.is_listable()]
    count = len(tools)
    return {
        "count": count,
        "items": [_row(tool) for tool in tools[offset : offset + limit]],
    }


def tool_detail(slug):
    """Everything staff edit, plus what stands between the tool and a page."""
    tool = (
        Tool.objects.select_related("vendor")
        .prefetch_related("facets__value__dimension", "plans__prices", "plans__limits")
        .filter(slug=slug)
        .first()
    )
    if tool is None:
        raise StaffError(f"No tool with slug {slug!r}.")
    return {
        "slug": tool.slug,
        "name": tool.name,
        "vendor": tool.vendor.name,
        "status": tool.status,
        "website_url": tool.website_url,
        "pricing_url": tool.pricing_url,
        "docs_url": tool.docs_url,
        "logo_url": tool.logo_url,
        "is_first_party": tool.is_first_party,
        "tagline": tool.tagline,
        "summary": tool.summary,
        # In full, not truncated: this is the field you would be editing, and a
        # truncated one makes every edit a blind one.
        "description_md": tool.description_md,
        "vendor_copy_md": tool.vendor_copy_md,
        "pros": tool.pros,
        "cons": tool.cons,
        "faq": tool.faq,
        "editor_verdict": tool.editor_verdict,
        "editor_notes": tool.editor_notes,
        "sort_order": tool.sort_order,
        "last_verified_at": _stamp(tool.last_verified_at),
        "prices_changed_at": _stamp(tool.prices_changed_at),
        "facets": [_facet(facet) for facet in tool.facets.all()],
        "plans": [_plan(plan) for plan in tool.plans.all()],
        "open_revisions": tool.revisions.filter(status=ToolRevisionStatus.SUBMITTED).count(),
        "open_price_proposals": tool.price_proposals.filter(
            status=PriceProposalStatus.PENDING
        ).count(),
        **_summary(tool),
    }


def list_plans(*, slug):
    """Every plan on one tool, with its current prices and limits."""
    tool = Tool.objects.prefetch_related("plans__prices", "plans__limits").filter(slug=slug).first()
    if tool is None:
        raise StaffError(f"No tool with slug {slug!r}.")
    return {"tool": slug, "plans": [_plan(plan) for plan in tool.plans.all()]}


def _row(tool):
    current = [p for plan in tool.plans.all() for p in plan.prices.all() if p.is_current]
    return {
        "slug": tool.slug,
        "name": tool.name,
        "vendor": tool.vendor.name,
        "status": tool.status,
        "plans": len(tool.plans.all()),
        # One short string rather than a nested object: these rows go into a
        # model's context by the dozen.
        "price_from": (
            f"{min(p.amount for p in current)} {current[0].currency}" if current else None
        ),
        "listable": tool.is_listable(),
    }


def _plan(plan):
    return {
        "code": plan.code,
        "name": plan.name,
        "tier_order": plan.tier_order,
        "is_public": plan.is_public,
        "is_free_tier": plan.is_free_tier,
        "is_trial": plan.is_trial,
        "trial_days": plan.trial_days,
        "is_enterprise_quote": plan.is_enterprise_quote,
        "min_seats": plan.min_seats,
        "highlights": plan.highlights,
        "source_url": plan.source_url,
        # Current rows only. The closed history is what makes a detail payload
        # explode, and it is not what an editor is looking at.
        "prices": [_price(p) for p in plan.prices.all() if p.is_current],
        "limits": [
            {"kind": limit.kind, "label": limit.label, "value": limit.display_value}
            for limit in plan.limits.all()
        ],
    }


def _stamp(value):
    return value.isoformat() if value else None


def create_tool(*, user, slug, name, vendor, website_url, changes=None):
    """Add a listing as a DRAFT, under the vendor of that name.

    The vendor is matched the way approving a submission matches it, on the
    slug of its name, so a second tool from the same company joins its row
    rather than forking it.

    DRAFT, never published: publishing is a lifecycle step an editor takes once
    the copy, facets and a pricing position are in, and the result's
    `listability_reasons` says which of those are still missing.
    """
    changes = dict(changes or {})
    # `name` and `website_url` are arguments already; taking them twice would
    # leave the caller guessing which one won.
    _reject_unknown_fields(
        changes, STAFF_EDITABLE_TOOL_FIELDS - {"name", "website_url"}, "new tool"
    )
    # The slug is the public URL and cannot be edited afterwards, so it is
    # checked here rather than left to the column.
    try:
        validate_slug(slug)
    except DjangoValidationError as exc:
        raise StaffError(f"slug {slug!r}: {exc.messages[0]}") from exc
    _reject_bad_urls({**changes, "website_url": website_url}, URL_FIELDS)

    try:
        with transaction.atomic():
            if Tool.objects.filter(slug=slug).exists():
                raise StaffError(
                    f"A tool with slug {slug!r} already exists. Edit it with catalog_update_tool."
                )
            vendor_row, _ = Vendor.objects.get_or_create(
                slug=slugify(vendor)[:80], defaults={"name": vendor, "website_url": website_url}
            )
            tool = Tool.objects.create(
                vendor=vendor_row,
                slug=slug,
                name=name,
                website_url=website_url,
                status=ToolStatus.DRAFT,
                **changes,
            )
    except IntegrityError as exc:
        raise StaffError(f"That tool conflicts with an existing row: {exc}") from exc

    return {"slug": tool.slug, "vendor": vendor_row.name, **_summary(tool)}


def update_tool(*, user, slug, changes):
    """Apply a staff edit to a listing and record it as an applied revision.

    Fields already holding the requested value are dropped rather than written,
    so a retried call is a no-op and leaves the audit trail alone.
    """
    _reject_unknown_fields(changes, STAFF_EDITABLE_TOOL_FIELDS, "tool")
    # Before the transaction opens: the common refusal should not touch the
    # database at all.
    _reject_bad_urls(changes, URL_FIELDS)

    try:
        # A savepoint under ATOMIC_REQUESTS, a transaction without it. Either
        # way the two writes below land together or not at all, whatever the
        # caller has already opened.
        with transaction.atomic():
            tool = Tool.objects.select_for_update().filter(slug=slug).first()
            if tool is None:
                raise StaffError(f"No tool with slug {slug!r}.")

            applied = {f: v for f, v in changes.items() if getattr(tool, f) != v}
            if applied:
                before = {f: getattr(tool, f) for f in applied}
                for field, value in applied.items():
                    setattr(tool, field, value)
                # updated_at is auto_now, and update_fields restricts the
                # columns written - so it has to be named or the row's mtime
                # silently goes stale.
                tool.save(update_fields=[*applied, "updated_at"])
                _record_revision(tool=tool, user=user, changes=applied, before=before)
    except IntegrityError as exc:
        # Caught outside the atomic block: inside it the connection is already
        # aborted and every later query fails too.
        raise StaffError(f"That edit conflicts with an existing row: {exc}") from exc

    return {"slug": tool.slug, "changed": sorted(applied), **_summary(tool)}


def _record_revision(*, tool, user, changes, before):
    """Record an edit staff already applied.

    Staff edits are applied, not proposed. The row records that as fact so
    every MCP edit surfaces in the queue staff already read.
    """
    now = timezone.now()
    ToolRevision.objects.create(
        tool=tool,
        author=user,
        origin=ToolRevisionOrigin.STAFF,
        changes=changes,
        base_snapshot=before,
        status=ToolRevisionStatus.APPROVED,
        reviewed_by=user,
        reviewed_at=now,
        applied_at=now,
    )


def update_plan(*, user, slug, code, changes):
    """Apply a staff edit to one plan of one tool."""
    _reject_unknown_fields(changes, STAFF_EDITABLE_PLAN_FIELDS, "plan")
    _reject_bad_urls(changes, PLAN_URL_FIELDS)

    try:
        with transaction.atomic():
            plan = Plan.objects.select_for_update().filter(tool__slug=slug, code=code).first()
            if plan is None:
                raise StaffError(f"No plan {code!r} on tool {slug!r}.")

            applied = {f: v for f, v in changes.items() if getattr(plan, f) != v}
            if applied:
                for field, value in applied.items():
                    setattr(plan, field, value)
                plan.save(update_fields=[*applied, "updated_at"])
    except IntegrityError as exc:
        raise StaffError(f"That edit conflicts with an existing row: {exc}") from exc

    return {"tool": slug, "code": plan.code, "changed": sorted(applied)}


def _has_pricing_position(plan):
    """Whether this plan contributes to the tool's pricing position.

    The same three ways `Tool.has_pricing_position()` counts, narrowed to one
    plan - a current price, an explicit free tier, or quote-only - and public,
    because a plan the catalog does not show cannot carry the tool past the
    listability bar.
    """
    return bool(
        plan.is_public
        and (
            plan.is_free_tier
            or plan.is_enterprise_quote
            or plan.prices.filter(is_current=True).exists()
        )
    )


def create_plan(*, user, slug, code, name, changes=None):
    """Add a plan to a tool.

    Deliberately a separate tool from the price. A plan is a shell - what it is
    called, who it is for, what it caps - and the figure it charges is a row
    with its own provenance, entered by `set_plan_price`. Folding the two
    together would mean one call that half-succeeds.

    The result reports `has_pricing_position`, which is False until the plan has
    a current price, a free-tier flag or the enterprise-quote flag. A plan
    without one is invisible to the public catalog, so a caller that stops here
    has not finished.
    """
    changes = dict(changes or {})
    _reject_unknown_fields(changes, STAFF_EDITABLE_PLAN_FIELDS, "plan")
    _reject_bad_urls(changes, PLAN_URL_FIELDS)
    # The crawler matches plans on `code` and it is half of the tool/code
    # uniqueness, so it is validated as the identifier it is rather than as
    # free text.
    try:
        validate_slug(code)
    except DjangoValidationError as exc:
        raise StaffError(f"code {code!r}: {exc.messages[0]}") from exc

    try:
        with transaction.atomic():
            tool = Tool.objects.filter(slug=slug).first()
            if tool is None:
                raise StaffError(f"No tool with slug {slug!r}.")
            if Plan.objects.filter(tool=tool, code=code).exists():
                raise StaffError(
                    f"{slug!r} already has a plan coded {code!r}. Edit it with "
                    "catalog_update_plan, or pick another code."
                )
            plan = Plan.objects.create(tool=tool, code=code, name=name, **changes)
    except IntegrityError as exc:
        raise StaffError(f"That plan conflicts with an existing row: {exc}") from exc

    return {
        "tool": slug,
        "code": plan.code,
        "name": plan.name,
        "has_pricing_position": _has_pricing_position(plan),
    }


def set_plan_limit(*, user, slug, code, kind, value=None, is_unlimited=False, note=""):
    """Record a published cap, replacing the one it already holds of that kind.

    An upsert, because the table is unique on (plan, kind) and a caller
    correcting a figure means to move it rather than to add a second row.

    A cap with no number and no note is refused: `PlanLimit.display_value`
    would render "Not published", which is a claim about the vendor, not about
    the caller having left the field blank.
    """
    if kind not in PlanLimitKind.values:
        raise StaffError(f"kind must be one of: {', '.join(PlanLimitKind.values)}.")
    if value is None and not is_unlimited and not note:
        raise StaffError(
            "Give a value, or is_unlimited, or a note saying what the vendor "
            "publishes instead. A cap is never guessed."
        )

    try:
        with transaction.atomic():
            plan = Plan.objects.select_for_update().filter(tool__slug=slug, code=code).first()
            if plan is None:
                raise StaffError(f"No plan {code!r} on tool {slug!r}.")
            limit, created = PlanLimit.objects.update_or_create(
                plan=plan,
                kind=kind,
                defaults={"value": value, "is_unlimited": is_unlimited, "note": note},
            )
    except IntegrityError as exc:
        raise StaffError(f"That limit conflicts with an existing row: {exc}") from exc

    return {
        "tool": slug,
        "code": code,
        "kind": limit.kind,
        "label": limit.label,
        "display": limit.display_value,
        "created": created,
    }


def set_plan_price(
    *,
    user,
    slug,
    code,
    amount,
    unit,
    billing_period,
    currency="USD",
    is_overage=False,
    source_note="",
    source_evidence_url="",
):
    """Publish a staff-entered figure, closing the one it supersedes.

    Scoped to the (currency, billing period, overage) slot that
    `uniq_current_plan_price` keys on, and only that slot. A metered plan's
    overage rate is a separate published figure and has to survive a change to
    the plan's own price - which is where this deliberately diverges from
    `PriceProposalAdmin.approve_proposals`, whose wholesale close would retire
    both.

    `price_is_stale`, `Plan.verified_at` and `Plan.last_changed_at` are left
    alone on purpose: they belong to the crawler, and inventing a second
    freshness rule on a new code path is how two subsystems start disagreeing.
    """
    if unit not in PriceUnit.values:
        raise StaffError(f"unit must be one of: {', '.join(PriceUnit.values)}.")
    if billing_period not in BillingPeriod.values:
        raise StaffError(f"billing_period must be one of: {', '.join(BillingPeriod.values)}.")
    _reject_bad_urls(
        {"source_evidence_url": source_evidence_url}, frozenset({"source_evidence_url"})
    )

    try:
        with transaction.atomic():
            plan = (
                Plan.objects.select_for_update()
                .select_related("tool")
                .filter(tool__slug=slug, code=code)
                .first()
            )
            if plan is None:
                raise StaffError(f"No plan {code!r} on tool {slug!r}.")

            slot = {
                "is_current": True,
                "currency": currency,
                "billing_period": billing_period,
                "is_overage": is_overage,
            }
            current = plan.prices.filter(**slot).first()
            if current is not None and current.amount == _decimal(amount) and current.unit == unit:
                # The figure has not moved. Opening a row anyway would write a
                # change into the published history that never happened.
                return {"changed": False, "price": _price(current), "previous": None}

            now = timezone.now()
            previous = _price(current) if current is not None else None
            # Closed, not edited: the profile shows a price history, and editing
            # the row in place destroys the evidence of what changed.
            plan.prices.filter(**slot).update(is_current=False, effective_to=now)
            price = PlanPrice.objects.create(
                plan=plan,
                currency=currency,
                amount=amount,
                unit=unit,
                billing_period=billing_period,
                is_overage=is_overage,
                effective_from=now,
                source=PriceSource.MANUAL,
                # is_pinned is left to PlanPrice.save(), which pins anything
                # non-crawler. Passing it here would put one rule in two places.
                entered_by=user,
                source_note=source_note or f"Entered by staff, {now:%Y-%m-%d}.",
                source_evidence_url=source_evidence_url,
            )
            # .update(), not .save(): no auto_now churn on the tool's mtime, and
            # no read-modify-write race with a concurrent edit to the same row.
            Tool.objects.filter(pk=plan.tool_id).update(prices_changed_at=now, last_verified_at=now)
    except IntegrityError as exc:
        raise StaffError(
            "A current price already exists for that plan, currency, billing "
            f"period and overage flag: {exc}"
        ) from exc

    return {"changed": True, "price": _price(price), "previous": previous}


def _decimal(amount):
    try:
        return Decimal(str(amount))
    except (InvalidOperation, ValueError) as exc:
        raise StaffError(f"amount {amount!r} is not a number.") from exc


def _price(price):
    return {
        "amount": str(price.amount),
        "currency": price.currency,
        "unit": price.unit,
        "billing_period": price.billing_period,
        "is_overage": price.is_overage,
        "source": price.source,
        "source_note": price.source_note,
    }


# --- Facets ----------------------------------------------------------------
# A facet is addressed as (dimension code, value code) - the pair
# `tool_detail` reports - never by its slug, which is only a URL segment and
# differs from the code where the code was too generic to own one (`api`).


def list_facets():
    """The whole vocabulary, so a caller picks a value rather than guessing one."""
    dimensions = FacetDimension.objects.prefetch_related("values")
    return {
        "dimensions": [
            {
                "code": dimension.code,
                "label": dimension.label,
                "required": dimension.code in REQUIRED_FACET_DIMENSIONS,
                "values": [
                    {"code": value.code, "slug": value.slug, "label": value.label}
                    for value in dimension.values.all()
                ],
            }
            for dimension in dimensions
        ]
    }


def add_tool_facet(*, user, slug, dimension, value, evidence_url="", verified_at=None):
    """Put one facet value on a listing."""
    _reject_bad_urls({"evidence_url": evidence_url}, {"evidence_url"})
    verified_at = _date(verified_at, "verified_at")
    tool = _tool(slug)
    facet_value = _facet_value(dimension, value)
    if tool.facets.filter(value=facet_value).exists():
        raise StaffError(
            f"{slug!r} already has {dimension} {value!r}. "
            "Change its evidence with catalog_update_tool_facet."
        )
    before = tool.facet_slugs
    with transaction.atomic():
        facet = ToolFacet.objects.create(
            tool=tool, value=facet_value, evidence_url=evidence_url, verified_at=verified_at
        )
        _record_facet_revision(tool=tool, user=user, before=before)
    return {"tool": tool.slug, "facet": _facet(facet), **_summary(tool)}


def update_tool_facet(*, user, slug, dimension, value, changes):
    """Edit the evidence behind one of a listing's facets.

    Not in the revision trail: that records what a page says, and the evidence
    changes nothing a reader sees. `user` is taken so every write here has the
    same shape.
    """
    changes = dict(changes)
    _reject_unknown_fields(changes, STAFF_EDITABLE_TOOL_FACET_FIELDS, "tool facet")
    _reject_bad_urls(changes, {"evidence_url"})
    if "verified_at" in changes:
        changes["verified_at"] = _date(changes["verified_at"], "verified_at")
    facet = _tool_facet(_tool(slug), dimension, value)
    applied = {f: v for f, v in changes.items() if getattr(facet, f) != v}
    if applied:
        for field, new in applied.items():
            setattr(facet, field, new)
        facet.save(update_fields=[*applied, "updated_at"])
    return {"tool": slug, "facet": _facet(facet), "changed": sorted(applied)}


def remove_tool_facet(*, user, slug, dimension, value):
    """Take one facet value off a listing.

    Refused when it is the last value on a required dimension of a published
    listing: that would unlist a live page as a side effect of a tidy-up. Add
    the replacement first, or archive the tool in the admin.
    """
    tool = _tool(slug)
    facet = _tool_facet(tool, dimension, value)
    if (
        tool.status == ToolStatus.PUBLISHED
        and dimension in REQUIRED_FACET_DIMENSIONS
        and not tool.facets.filter(value__dimension__code=dimension).exclude(pk=facet.pk).exists()
    ):
        raise StaffError(
            f"{value!r} is {slug!r}'s only {dimension} facet, and the published page "
            f"needs one. Add the replacement with catalog_add_tool_facet first."
        )
    removed = _facet(facet)
    before = tool.facet_slugs
    with transaction.atomic():
        facet.delete()
        _record_facet_revision(tool=tool, user=user, before=before)
    return {"tool": slug, "removed": removed, **_summary(tool)}


def _tool_facet(tool, dimension, value):
    facet_value = _facet_value(dimension, value)
    facet = tool.facets.select_related("value__dimension").filter(value=facet_value).first()
    if facet is None:
        raise StaffError(
            f"{tool.slug!r} has no {dimension} {value!r}. Add it with catalog_add_tool_facet."
        )
    return facet


def _record_facet_revision(*, tool, user, before):
    """Facets are rows, so the trail records them the way a proposal carries
    them - as `facet_slugs`, the whole list, which the admin knows how to apply."""
    _record_revision(
        tool=tool,
        user=user,
        changes={"facet_slugs": tool.facet_slugs},
        before={"facet_slugs": before},
    )


def _tool(slug):
    tool = Tool.objects.filter(slug=slug).first()
    if tool is None:
        raise StaffError(f"No tool with slug {slug!r}.")
    return tool


def _facet_value(dimension, value):
    values = FacetValue.objects.select_related("dimension").filter(dimension__code=dimension)
    found = next((row for row in values if row.code == value), None)
    if not values:
        codes = FacetDimension.objects.values_list("code", flat=True)
        raise StaffError(f"No facet dimension {dimension!r}. Valid: {', '.join(codes)}.")
    if found is None:
        raise StaffError(
            f"No {dimension} facet {value!r}. Valid: {', '.join(row.code for row in values)}."
        )
    return found


def _facet(facet):
    return {
        "dimension": facet.value.dimension.code,
        "value": facet.value.code,
        "slug": facet.value.slug,
        "evidence_url": facet.evidence_url,
        "verified_at": _stamp(facet.verified_at),
    }


# --- Logos -----------------------------------------------------------------


def _fetch_logo(image_url):
    """Fetch, re-encode and store a logo, returning the URL we now serve it at.

    Through the screenshot fetcher on purpose: it is the one that re-checks
    every redirect hop against the SSRF guard.
    """
    return _store_logo(screenshot_service.fetch(image_url))


def _store_logo(data):
    try:
        return logos.write(data)
    except ImageRejected as exc:
        raise StaffError(str(exc)) from exc


def set_tool_logo(*, user, slug, image_url):
    """Re-host the logo at `image_url` and point the listing at it.

    Applied through `update_tool`, so it lands in the revision trail like any
    other staff edit and a repeat call with the same picture changes nothing.
    """
    return _set_tool_logo(user=user, slug=slug, load=lambda: _fetch_logo(image_url))


def upload_tool_logo(*, user, slug, data):
    """The same for a file the editor already holds."""
    return _set_tool_logo(user=user, slug=slug, load=lambda: _store_logo(data))


def _set_tool_logo(*, user, slug, load):
    # Looked up before the load, so a mistyped slug costs no download and
    # leaves no orphaned file.
    if not Tool.objects.filter(slug=slug).exists():
        raise StaffError(f"No tool with slug {slug!r}.")
    logo_url = load()
    result = update_tool(user=user, slug=slug, changes={"logo_url": logo_url})
    return {"logo_url": logo_url, **result}


def set_vendor_logo(*, user, vendor, image_url):
    """Re-host the logo at `image_url` and point the vendor at it.

    The vendor is found by the slug of its name, the way `create_tool` finds
    one - a caller sees vendor names, never their slugs. `user` is unused but
    taken, so every write in this module is attributable in the same shape.
    """
    row = Vendor.objects.filter(slug=slugify(vendor)[:80]).first()
    if row is None:
        raise StaffError(f"No vendor named {vendor!r}.")
    row.logo_url = _fetch_logo(image_url)
    row.save(update_fields=["logo_url", "updated_at"])
    return {"vendor": row.name, "logo_url": row.logo_url}


# --- Screenshots -----------------------------------------------------------
# A model cannot hand us a file over JSON-RPC, so it hands us a URL and the
# server fetches it. Published on arrival, like every other staff write here:
# there is no draft step on this surface, and the review queue exists for
# pictures vendors send in.


def add_screenshot(*, user, slug, image_url, alt_text, caption="", captured_at=None, status=None):
    """Fetch `image_url`, render it, and put it on the listing."""
    return _add_screenshot(
        user=user,
        slug=slug,
        load=lambda: screenshot_service.fetch(image_url),
        source_url=image_url,
        alt_text=alt_text,
        caption=caption,
        captured_at=captured_at,
        status=status,
    )


def upload_screenshot(*, user, slug, data, alt_text, caption="", captured_at=None, status=None):
    """The same for a file the editor already holds - the tool page's path."""
    return _add_screenshot(
        user=user,
        slug=slug,
        load=lambda: data,
        source_url="",
        alt_text=alt_text,
        caption=caption,
        captured_at=captured_at,
        status=status,
    )


def _add_screenshot(*, user, slug, load, source_url, alt_text, caption, captured_at, status):
    # `load` rather than bytes, so every refusal below costs no download.
    tool = Tool.objects.filter(slug=slug).first()
    if tool is None:
        raise StaffError(f"No tool with slug {slug!r}.")
    if not alt_text.strip():
        # Refused rather than defaulted: alt text is what a screen reader
        # announces, and a generated one would describe nothing.
        raise StaffError("alt_text is required: say what the picture shows.")

    status = status or ToolScreenshotStatus.PUBLISHED
    _reject_unknown_status(status)
    captured_at = _date(captured_at)

    try:
        shot = screenshot_service.store(
            tool=tool,
            data=load(),
            alt_text=alt_text.strip(),
            caption=caption,
            captured_at=captured_at,
            source=ToolScreenshotSource.STAFF,
            status=status,
            source_url=source_url,
            uploaded_by=user,
        )
    except ImageRejected as exc:
        raise StaffError(str(exc)) from exc

    if status != ToolScreenshotStatus.PENDING:
        screenshot_service.review(screenshot=shot, user=user, status=status)
    return _screenshot(shot)


def list_screenshots(*, slug):
    """Every screenshot on a listing, at any status.

    Pending rows included, and the reason to call this: they are what a vendor
    has sent in and nobody has looked at.
    """
    tool = Tool.objects.filter(slug=slug).first()
    if tool is None:
        raise StaffError(f"No tool with slug {slug!r}.")
    return {"tool": slug, "items": [_screenshot(shot) for shot in tool.screenshots.all()]}


def review_screenshot(*, user, screenshot_id, status, note=""):
    """Publish or reject one screenshot, recording who decided."""
    _reject_unknown_status(status)
    shot = ToolScreenshot.objects.select_related("tool").filter(pk=screenshot_id).first()
    if shot is None:
        raise StaffError(f"No screenshot with id {screenshot_id}.")
    return _screenshot(
        screenshot_service.review(screenshot=shot, user=user, status=status, note=note)
    )


def _date(value, field="captured_at"):
    """An ISO date string as a date, because MCP has no date type.

    Parsed here rather than left to the ORM: assigning a string to a DateField
    survives the save and comes back out of the row as a date, so the only thing
    that would notice a malformed one is the response schema.
    """
    if not value or not isinstance(value, str):
        return value or None
    if (parsed := parse_date(value)) is None:
        raise StaffError(f"{field} must be an ISO date like 2026-09-01, not {value!r}.")
    return parsed


def _reject_unknown_status(status):
    if status not in ToolScreenshotStatus.values:
        raise StaffError(f"status must be one of: {', '.join(ToolScreenshotStatus.values)}.")


def _screenshot(shot):
    return {
        "id": shot.pk,
        "tool": shot.tool.slug,
        "alt_text": shot.alt_text,
        "caption": shot.caption,
        "status": shot.status,
        "source": shot.source,
        "source_url": shot.source_url,
        "width": shot.width,
        "height": shot.height,
        "rendition_widths": shot.rendition_widths,
        "url": shot.display_url,
        "captured_at": shot.captured_at.isoformat() if shot.captured_at else None,
        "review_note": shot.review_note,
    }
