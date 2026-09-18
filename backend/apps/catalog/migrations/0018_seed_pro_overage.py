"""Record what PDF Redaction's Pro plan meters, and what it charges past it.

A metered plan is two published figures, not one: $15 a month, and $0.05 for
every page beyond the 500 it includes. Without the second the catalog implies
the fee is the whole story, which is exactly the misreading this product
exists to prevent.

The overage rate is stored as a second current `PlanPrice` row rather than a
field on the plan, so it carries the same source, pinning and evidence as every
other figure we publish. The unique constraint admits both because they differ
on `is_overage`.

`highlights` loses "Unlimited documents" in the same breath: a plan cannot be
unlimited and metered at once, and leaving the line would contradict the number
now sitting beside it.
"""

from django.db import migrations

TOOL = "pdf-redaction"
PLAN = "pro"
ALLOWANCE = 500
OVERAGE = "0.0500"
NOTE = "Seeded from an editor-vetted comparison table."
HIGHLIGHTS = ["500 pages a month, then $0.05 a page", "Batch processing", "API access"]


def add_overage(apps, schema_editor):
    Plan = apps.get_model("catalog", "Plan")
    PlanLimit = apps.get_model("catalog", "PlanLimit")
    PlanPrice = apps.get_model("catalog", "PlanPrice")

    plan = Plan.objects.filter(tool__slug=TOOL, code=PLAN).first()
    if plan is None:  # pragma: no cover - only if 0008 never ran
        return

    PlanLimit.objects.get_or_create(
        plan=plan,
        kind="pages_per_month",
        label="Pages per month",
        defaults={"value": ALLOWANCE, "unit": "pages", "sort_order": 0},
    )

    PlanPrice.objects.get_or_create(
        plan=plan,
        currency="USD",
        billing_period="usage",
        is_overage=True,
        is_current=True,
        defaults={
            "amount": OVERAGE,
            "unit": "page",
            "source": "manual",
            # Historical migrations do not run `save()`, so the pin that a
            # non-crawler price would set for itself is set here by hand.
            "is_pinned": True,
            "source_note": NOTE,
        },
    )

    if plan.highlights != HIGHLIGHTS:
        plan.highlights = HIGHLIGHTS
        plan.save(update_fields=["highlights"])


def remove_overage(apps, schema_editor):
    Plan = apps.get_model("catalog", "Plan")
    PlanLimit = apps.get_model("catalog", "PlanLimit")
    PlanPrice = apps.get_model("catalog", "PlanPrice")

    PlanPrice.objects.filter(
        plan__tool__slug=TOOL, plan__code=PLAN, is_overage=True
    ).delete()
    PlanLimit.objects.filter(
        plan__tool__slug=TOOL, plan__code=PLAN, kind="pages_per_month"
    ).delete()

    plan = Plan.objects.filter(tool__slug=TOOL, code=PLAN).first()
    if plan is not None:
        plan.highlights = ["Unlimited documents", "Batch processing", "API access"]
        plan.save(update_fields=["highlights"])


class Migration(migrations.Migration):
    dependencies = [("catalog", "0017_plan_price_overage")]

    operations = [migrations.RunPython(add_overage, remove_overage)]
