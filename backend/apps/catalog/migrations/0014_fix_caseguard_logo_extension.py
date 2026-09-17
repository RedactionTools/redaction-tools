"""Point CaseGuard's listing at the logo file we actually host.

Migration 0008 recorded `/images/tools/caseguard.svg` for every seeded tool by
pattern, but the asset is a PNG. The extension was a guess, and a path that does
not resolve renders as a broken image in the comparison table.

Corrected here rather than by editing 0008: that migration has already run, and
rewriting applied history would leave existing databases wrong while looking
right in the diff.
"""

from django.db import migrations


def fix_logo_path(apps, schema_editor):
    Tool = apps.get_model("catalog", "Tool")
    Tool.objects.filter(slug="caseguard", logo_url="/images/tools/caseguard.svg").update(
        logo_url="/images/tools/caseguard.png"
    )


def reverse(apps, schema_editor):
    Tool = apps.get_model("catalog", "Tool")
    Tool.objects.filter(slug="caseguard", logo_url="/images/tools/caseguard.png").update(
        logo_url="/images/tools/caseguard.svg"
    )


class Migration(migrations.Migration):
    dependencies = [("catalog", "0013_priceproposal_toolrevision")]

    operations = [migrations.RunPython(fix_logo_path, reverse)]
