"""Record PDF Redaction's free allowance as a limit, not just as prose.

The free tier's caps have always been published - they sit in the plan's
`highlights` as sentences - but a sentence cannot be compared, filtered or
calculated against. As `PlanLimit` rows they become numbers the cost calculator
can honour, so the free plan stops claiming to cover a volume it does not.

The two caps bite differently and both matter: 25 pages is the longest single
document the plan will take, 100 pages is all it will take in a month.

A new migration rather than an edit to 0008: that one bails the moment it finds
a tool, so a database seeded at launch would never see a limit appended.

Idempotent in its own right too - `get_or_create` is keyed on the
(plan, kind, label) triple the table already uniquely constrains.
"""

from django.db import migrations

# tool slug, plan code, kind, label, value, unit, sort_order
LIMITS = [
    ("pdf-redaction", "free", "pages_per_document", "Pages per document", 25, "pages", 0),
    ("pdf-redaction", "free", "pages_per_month", "Pages per month", 100, "pages", 10),
]


def add_limits(apps, schema_editor):
    Plan = apps.get_model("catalog", "Plan")
    PlanLimit = apps.get_model("catalog", "PlanLimit")

    for tool_slug, plan_code, kind, label, value, unit, sort_order in LIMITS:
        plan = Plan.objects.filter(tool__slug=tool_slug, code=plan_code).first()
        if plan is None:  # pragma: no cover - only if 0008 never ran
            continue

        PlanLimit.objects.get_or_create(
            plan=plan,
            kind=kind,
            label=label,
            defaults={"value": value, "unit": unit, "sort_order": sort_order},
        )


def remove_limits(apps, schema_editor):
    PlanLimit = apps.get_model("catalog", "PlanLimit")

    for tool_slug, plan_code, kind, label, _value, _unit, _sort in LIMITS:
        PlanLimit.objects.filter(
            plan__tool__slug=tool_slug, plan__code=plan_code, kind=kind, label=label
        ).delete()


class Migration(migrations.Migration):
    dependencies = [("catalog", "0015_seed_detection_capabilities")]

    operations = [migrations.RunPython(add_limits, remove_limits)]
