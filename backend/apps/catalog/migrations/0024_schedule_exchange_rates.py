"""Refresh the ECB exchange rates daily.

Rides the qcluster like the MCP credential sweep in `core`. No `next_run`, so it
defaults to now and a fresh deploy has rates as soon as the worker starts rather
than a day later. Idempotent: re-running `migrate` is a no-op.
"""

from django.db import migrations

NAME = "catalog-exchange-rates"


def add_schedule(apps, schema_editor):
    Schedule = apps.get_model("django_q", "Schedule")
    Schedule.objects.get_or_create(
        name=NAME,
        defaults={
            "func": "apps.catalog.exchange_rates.refresh_exchange_rates",
            "schedule_type": "D",
            "repeats": -1,
        },
    )


def drop_schedule(apps, schema_editor):
    Schedule = apps.get_model("django_q", "Schedule")
    Schedule.objects.filter(name=NAME).delete()


class Migration(migrations.Migration):
    # `__latest__` for the same reason as core's 0001: `Schedule.name` arrives in a
    # later django_q migration than the initial one.
    dependencies = [("catalog", "0023_exchange_rate"), ("django_q", "__latest__")]

    operations = [migrations.RunPython(add_schedule, drop_schedule)]
