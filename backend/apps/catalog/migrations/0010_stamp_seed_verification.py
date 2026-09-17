"""Record when the seeded prices were verified.

An editor checked these figures on the seed date, so the catalog should say so.
Without it every profile reads "costs from $22.99 per month" with no date, and a
price with no date is an assertion rather than an observation - which is exactly
the distinction this catalog sells.

`prices_changed_at` gets the same timestamp: the first recording of a price is
the last time it moved, as far as we know.
"""

from datetime import UTC, datetime

from django.db import migrations

VERIFIED_AT = datetime(2026, 9, 17, tzinfo=UTC)


def stamp(apps, schema_editor):
    Tool = apps.get_model("catalog", "Tool")
    Plan = apps.get_model("catalog", "Plan")

    Tool.objects.filter(last_verified_at__isnull=True).update(
        last_verified_at=VERIFIED_AT, prices_changed_at=VERIFIED_AT
    )
    Plan.objects.filter(verified_at__isnull=True).update(
        verified_at=VERIFIED_AT, last_changed_at=VERIFIED_AT
    )


def noop_reverse(apps, schema_editor):
    """Clearing the dates would make published prices look unverified."""


class Migration(migrations.Migration):
    dependencies = [("catalog", "0009_seed_editorial")]

    operations = [migrations.RunPython(stamp, noop_reverse)]
