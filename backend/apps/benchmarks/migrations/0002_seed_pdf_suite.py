"""Create the PDF suite, the first medium /benchmarks lists.

Only the suite: dataset revisions and their cases are published from the CLI
(`pdfredeval publish-cases`), because the ground truth lives in that repo and nowhere
else until an editor sends it.

Idempotent: `get_or_create` on the slug, so a database that already has the row -
edited by staff or not - is left as it is.
"""

from django.db import migrations

DESCRIPTION = (
    "Synthetic one-page PDFs, each seeded with sensitive values in the places redaction "
    "tools miss: the text layer, rendered pixels, metadata, annotations, earlier "
    "revisions. We score what each tool hands back, layer by layer."
)


def seed(apps, schema_editor):
    Suite = apps.get_model("benchmarks", "Suite")
    Suite.objects.get_or_create(
        slug="pdf",
        defaults={"name": "PDF redaction", "description_md": DESCRIPTION, "is_public": True},
    )


def noop_reverse(apps, schema_editor):
    """Seed data is not unwound: a reverse would delete a row staff may have edited."""


class Migration(migrations.Migration):
    dependencies = [("benchmarks", "0001_initial")]

    operations = [migrations.RunPython(seed, noop_reverse)]
