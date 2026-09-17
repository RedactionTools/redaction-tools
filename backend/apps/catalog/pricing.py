"""Turning a tool's plans into the one figure a comparison table can show."""

from apps.catalog.models import BillingPeriod, PriceUnit

# Rough monthly equivalents, used ONLY to order mixed-unit plans against each
# other. Never displayed: a per-page price is not a monthly price, and rendering
# one as the other is the single easiest way to publish a misleading number.
MONTHLY_FACTOR = {
    PriceUnit.MONTH: 1,
    PriceUnit.SEAT_MONTH: 1,
    PriceUnit.YEAR: 1 / 12,
    PriceUnit.SEAT_YEAR: 1 / 12,
    PriceUnit.ONE_TIME: 1 / 24,
}


def entry_price(plans):
    """The cheapest recurring, non-free, publicly priced plan - the "from" figure.

    Returns `(monthly_equivalent, plan, price)` or None. Usage-priced plans are
    skipped rather than converted: there is no honest way to express $0.05 per
    page as a monthly rate without inventing a volume.
    """
    best = None
    for plan in plans:
        if not plan.is_public or plan.is_free_tier or plan.is_enterprise_quote:
            continue
        for price in plan.prices.all():
            if not price.is_current:
                continue
            factor = MONTHLY_FACTOR.get(price.unit)
            if factor is None:
                continue
            monthly = float(price.amount) * factor
            if best is None or monthly < best[0]:
                best = (monthly, plan, price)
    return best


def price_summary(tool):
    """The price block every hub row and profile header renders."""
    plans = [plan for plan in tool.plans.all() if plan.is_public]
    free_plan = next((plan for plan in plans if plan.is_free_tier), None)
    trial_plan = next((plan for plan in plans if plan.is_trial), None)
    best = entry_price(plans)

    summary = {
        "has_free_tier": free_plan is not None,
        "is_trial": trial_plan is not None,
        "trial_days": trial_plan.trial_days if trial_plan else None,
        # Quote-only is a stance, not a missing price: it is only true when every
        # public plan is a quote, otherwise a published tier would be hidden.
        "is_quote_only": bool(plans) and all(plan.is_enterprise_quote for plan in plans),
        "from_amount": None,
        "currency": None,
        "unit": None,
        "billing_period": None,
        "source": None,
        "is_pinned": False,
        "source_note": "",
        "source_url": tool.pricing_url or "",
        "last_verified_at": tool.last_verified_at,
        "last_changed_at": tool.prices_changed_at,
        "is_stale": tool.price_is_stale,
    }
    if best is not None:
        _, _, price = best
        summary.update(
            from_amount=price.amount,
            currency=price.currency,
            unit=price.unit,
            billing_period=price.billing_period,
            source=price.source,
            is_pinned=price.is_pinned,
            source_note=price.source_note,
        )
    elif free_plan is not None:
        summary.update(
            from_amount=0,
            currency=_free_currency(free_plan),
            unit=PriceUnit.MONTH,
            billing_period=BillingPeriod.MONTHLY,
        )
    return summary


def _free_currency(free_plan):
    price = next((p for p in free_plan.prices.all() if p.is_current), None)
    return price.currency if price else "USD"


def sort_key(tool, summary):
    """Order by monthly-equivalent price, then name.

    Tools with no comparable price sort last in BOTH directions - an unpriced
    entry is not the cheapest, and it is not the most expensive either.
    """
    best = entry_price([plan for plan in tool.plans.all() if plan.is_public])
    if best is not None:
        return (0, best[0], tool.name.lower())
    if summary["has_free_tier"]:
        return (0, 0.0, tool.name.lower())
    return (1, 0.0, tool.name.lower())
