"""Seed the facet taxonomy.

Idempotent: re-running `migrate` on a populated database is a no-op, so this can
ship alongside a squash or a restored dump without duplicating rows.

`is_landing_page` is False for every value. With a launch catalog this size no
facet clears the >=4-tool content bar, so facets ship filter-only and are
promoted in phase 3 by flipping the flag - data, not a code change.
"""

from django.db import migrations

# code, label, is_landing_dimension, sort_order, [(value code, label, slug)]
DIMENSIONS = [
    ("media", "Media", True, 10, [
        ("pdf", "PDF", "pdf"),
        ("image", "Image", "image"),
        ("video", "Video", "video"),
        ("audio", "Audio", "audio"),
        ("text", "Text and logs", "text"),
    ]),
    ("deployment", "Deployment", True, 20, [
        ("online", "Online", "online"),
        ("desktop", "Desktop", "desktop"),
        ("self-hosted", "Self-hosted", "self-hosted"),
        # `api` and `manual` are too generic to own as URL segments.
        ("api", "API", "api-tools"),
        ("browser-extension", "Browser extension", "browser-extension"),
    ]),
    ("method", "Redaction method", True, 30, [
        ("manual", "Manual", "manual-redaction"),
        ("ai", "AI-powered", "ai"),
        ("hybrid", "Hybrid", "hybrid"),
        ("rule-based", "Rule-based", "rule-based"),
    ]),
    ("pricing_model", "Pricing model", True, 40, [
        ("free", "Free", "free"),
        ("freemium", "Freemium", "freemium"),
        ("subscription", "Subscription", "subscription"),
        ("pay-per-page", "Pay per page", "pay-per-page"),
        ("pay-per-document", "Pay per document", "pay-per-document"),
        ("pay-per-minute", "Pay per minute", "pay-per-minute"),
        ("one-time", "One-time purchase", "one-time"),
        ("open-source", "Open source", "open-source"),
        ("quote-only", "Quote only", "quote-only"),
    ]),
    ("compliance", "Compliance", True, 50, [
        ("hipaa", "HIPAA", "hipaa"),
        ("gdpr", "GDPR", "gdpr"),
        ("ccpa", "CCPA", "ccpa"),
        ("soc2", "SOC 2", "soc2"),
        ("iso27001", "ISO 27001", "iso27001"),
        ("cjis", "CJIS", "cjis"),
        ("ferpa", "FERPA", "ferpa"),
    ]),
    ("platform", "Platform", True, 60, [
        ("windows", "Windows", "windows"),
        ("macos", "macOS", "macos"),
        ("linux", "Linux", "linux"),
        ("ios", "iOS", "ios"),
        ("android", "Android", "android"),
        ("web", "Web", "web"),
    ]),
    ("capability", "Capability", False, 70, [
        ("ocr", "OCR", "ocr"),
        ("batch", "Batch processing", "batch"),
        ("metadata-removal", "Metadata removal", "metadata-removal"),
        ("audit-log", "Audit log", "audit-log"),
        ("true-removal", "True content removal", "true-removal"),
        ("face-detection", "Face detection", "face-detection"),
        ("licence-plate-detection", "Licence plate detection", "licence-plate-detection"),
        ("entity-detection", "Entity detection", "entity-detection"),
        ("speech-to-text", "Speech to text", "speech-to-text"),
        ("webhooks", "Webhooks", "webhooks"),
        ("air-gapped", "Air-gapped", "air-gapped"),
        ("sso", "SSO", "sso"),
    ]),
    ("audience", "Audience", False, 80, [
        ("legal", "Legal", "legal"),
        ("healthcare", "Healthcare", "healthcare"),
        ("government", "Government", "government"),
        ("law-enforcement", "Law enforcement", "law-enforcement"),
        ("enterprise", "Enterprise", "enterprise"),
        ("individual", "Individual", "individual"),
    ]),
]


def seed(apps, schema_editor):
    FacetDimension = apps.get_model("catalog", "FacetDimension")
    FacetValue = apps.get_model("catalog", "FacetValue")

    if FacetDimension.objects.exists():
        return

    for code, label, is_landing, sort_order, values in DIMENSIONS:
        dimension = FacetDimension.objects.create(
            code=code, label=label, is_landing_dimension=is_landing, sort_order=sort_order
        )
        for index, (value_code, value_label, slug) in enumerate(values):
            FacetValue.objects.create(
                dimension=dimension,
                code=value_code,
                slug=slug,
                label=value_label,
                is_landing_page=False,
                sort_order=index * 10,
            )


def noop_reverse(apps, schema_editor):
    """Seed data is not unwound: a reverse would delete rows staff may have edited."""


class Migration(migrations.Migration):
    dependencies = [("catalog", "0003_facetdimension_facetvalue_toolfacet_and_more")]

    operations = [migrations.RunPython(seed, noop_reverse)]
