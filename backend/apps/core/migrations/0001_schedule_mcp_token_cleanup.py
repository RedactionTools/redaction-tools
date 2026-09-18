"""Sweep expired MCP credentials daily.

Both django_mcpz apps accumulate rows that outlive their usefulness: expired and
revoked tokens, spent authorization codes, and dynamically registered clients
that never finished authorising. Open registration means that last table grows
whether or not anyone connects, so the sweep is not optional.

The project already runs a `qcluster`, so this rides it rather than adding a
cron entry to the deploy. Idempotent and guarded by an existence check, like the
catalog seeds: re-running `migrate` on a populated database is a no-op.
"""

from django.db import migrations

SCHEDULES = [
    ("mcpz-oauth-cleanup", "django_mcpz.oauth.cleanup.clear_expired"),
    ("mcpz-bearer-token-cleanup", "django_mcpz.bearer_tokens.cleanup.clear_expired"),
]


def add_schedules(apps, schema_editor):
    Schedule = apps.get_model("django_q", "Schedule")
    for name, func in SCHEDULES:
        Schedule.objects.get_or_create(
            name=name,
            defaults={"func": func, "schedule_type": "D", "repeats": -1},
        )


def drop_schedules(apps, schema_editor):
    Schedule = apps.get_model("django_q", "Schedule")
    Schedule.objects.filter(name__in=[name for name, _ in SCHEDULES]).delete()


class Migration(migrations.Migration):
    # `__latest__`, not `0001_initial`: a data migration gets the historical
    # model as of its dependencies, and `Schedule.name` arrives in a later
    # django_q migration. Pinned to the initial one this runs against a table
    # that has no `name` column yet, and every later migration in the run dies
    # with it.
    dependencies = [("django_q", "__latest__")]

    operations = [migrations.RunPython(add_schedules, drop_schedules)]
