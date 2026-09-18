"""Add the detection capabilities to the `capability` facet.

A new migration rather than an edit to 0004: that one bails on the first row it
finds, so a database seeded at launch would never see values appended to its
list - the diff would look right and prod would stay wrong.

Idempotent in its own right too. `get_or_create` keyed on (dimension, code) is
the pair the table already uniquely constrains, so re-running adds nothing.
"""

from django.db import migrations
from django.db.models import Max

# code, label, slug
CAPABILITIES = [
    ("handwritten-recognition", "Handwritten recognition", "handwritten-recognition"),
    ("signature-detection", "Signature detection", "signature-detection"),
    ("logo-detection", "Logo detection", "logo-detection"),
    ("stamp-detection", "Stamp detection", "stamp-detection"),
    # A slug carries no slash, so the label and the segment part ways here.
    ("qr-barcode-detection", "QR/Bar code detection", "qr-barcode-detection"),
]


def add_capabilities(apps, schema_editor):
    FacetDimension = apps.get_model("catalog", "FacetDimension")
    FacetValue = apps.get_model("catalog", "FacetValue")

    dimension = FacetDimension.objects.filter(code="capability").first()
    if dimension is None:  # pragma: no cover - only if 0004 never ran
        return

    # Continue the existing run instead of interleaving with it: 0004 numbered
    # its values in tens, so the next one starts after the current highest.
    start = (dimension.values.aggregate(Max("sort_order"))["sort_order__max"] or 0) + 10

    for index, (code, label, slug) in enumerate(CAPABILITIES):
        FacetValue.objects.get_or_create(
            dimension=dimension,
            code=code,
            defaults={
                "slug": slug,
                "label": label,
                # Same as every other facet: filter-only until the catalog is
                # big enough to fill a landing page.
                "is_landing_page": False,
                "sort_order": start + index * 10,
            },
        )


def noop_reverse(apps, schema_editor):
    """Not unwound, for the reason 0004 gives plus one of its own: deleting a
    value cascades to every ToolFacet staff have since tagged with it."""


class Migration(migrations.Migration):
    dependencies = [("catalog", "0014_fix_caseguard_logo_extension")]

    operations = [migrations.RunPython(add_capabilities, noop_reverse)]
