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

from apps.catalog.constants import (
    PLAN_URL_FIELDS,
    STAFF_EDITABLE_PLAN_FIELDS,
    STAFF_EDITABLE_TOOL_FIELDS,
    URL_FIELDS,
)
from apps.catalog.models import (
    BillingPeriod,
    Plan,
    PlanLimit,
    PlanLimitKind,
    PlanPrice,
    PriceProposalStatus,
    PriceSource,
    PriceUnit,
    Tool,
    ToolRevision,
    ToolRevisionOrigin,
    ToolRevisionStatus,
    ToolStatus,
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
        "editor_verdict": tool.editor_verdict,
        "editor_notes": tool.editor_notes,
        "sort_order": tool.sort_order,
        "last_verified_at": _stamp(tool.last_verified_at),
        "prices_changed_at": _stamp(tool.prices_changed_at),
        "facets": [
            {"dimension": facet.value.dimension.code, "value": facet.value.code}
            for facet in tool.facets.all()
        ],
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
                now = timezone.now()
                # Staff edits are applied, not proposed. The row records that as
                # fact so every MCP edit surfaces in the queue staff already read.
                ToolRevision.objects.create(
                    tool=tool,
                    author=user,
                    origin=ToolRevisionOrigin.STAFF,
                    changes=applied,
                    base_snapshot=before,
                    status=ToolRevisionStatus.APPROVED,
                    reviewed_by=user,
                    reviewed_at=now,
                    applied_at=now,
                )
    except IntegrityError as exc:
        # Caught outside the atomic block: inside it the connection is already
        # aborted and every later query fails too.
        raise StaffError(f"That edit conflicts with an existing row: {exc}") from exc

    return {"slug": tool.slug, "changed": sorted(applied), **_summary(tool)}


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
