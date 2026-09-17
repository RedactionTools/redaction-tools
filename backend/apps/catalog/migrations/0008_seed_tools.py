"""Seed the launch catalog: seven tools whose prices a human has already vetted.

Figures are transcribed from the comparison tables that backed
pdf-redaction.com's /alternatives/ pages, so the catalog opens with numbers an
editor checked rather than numbers a crawler guessed. Every PlanPrice lands
source=MANUAL and pinned: the crawler observes these from phase 2 but never
overwrites them until staff unpin.

Tools are created DRAFT. Publishing needs 400+ characters of original editorial,
which is an editor's job - migration 0009 supplies it and flips the status.
"""

from django.db import migrations

# slug: (name, website, hq country)
VENDORS = {
    "stabrise": ("StabRise", "https://stabrise.com", "UA"),
    "adobe": ("Adobe", "https://www.adobe.com", "US"),
    "nitro": ("Nitro Software", "https://www.gonitro.com", "US"),
    "foxit": ("Foxit Software", "https://www.foxit.com", "US"),
    "caseguard": ("CaseGuard", "https://caseguard.com", "US"),
    "redactable": ("Redactable", "https://www.redactable.com", "US"),
    "ilovepdf": ("iLovePDF", "https://www.ilovepdf.com", "ES"),
}

# (dimension code, value code) pairs, so a facet is named the way the taxonomy
# names it rather than by a slug that may differ (api -> api-tools).
TOOLS = [
    {
        "slug": "pdf-redaction",
        "name": "PDF Redaction",
        "vendor": "stabrise",
        "website_url": "https://pdf-redaction.com",
        "pricing_url": "https://pdf-redaction.com/pricing/",
        "logo_url": "/images/tools/pdf-redaction.svg",
        "is_first_party": True,
        "tagline": "AI-assisted PDF redaction that runs in the browser.",
        "facets": [
            ("media", "pdf"), ("media", "image"),
            ("deployment", "online"), ("deployment", "api"), ("deployment", "self-hosted"),
            ("method", "ai"), ("method", "hybrid"),
            ("pricing_model", "freemium"), ("pricing_model", "pay-per-page"),
            ("platform", "web"), ("platform", "windows"), ("platform", "linux"),
            ("capability", "ocr"), ("capability", "batch"), ("capability", "true-removal"),
            ("capability", "entity-detection"),
            ("compliance", "gdpr"),
        ],
        "plans": [
            {"code": "free", "name": "Free", "tier_order": 0, "is_free_tier": True,
             "amount": "0.0000", "currency": "USD", "unit": "month",
             "billing_period": "monthly",
             "highlights": ["25 pages per document", "Automatic entity detection"]},
            {"code": "pro", "name": "Pro", "tier_order": 1,
             "amount": "15.0000", "currency": "USD", "unit": "month",
             "billing_period": "monthly",
             "highlights": ["Unlimited documents", "Batch processing", "API access"]},
            {"code": "payg", "name": "Pay as you go", "tier_order": 2,
             "amount": "0.0500", "currency": "USD", "unit": "page",
             "billing_period": "usage", "highlights": ["No subscription"]},
        ],
    },
    {
        "slug": "adobe-acrobat",
        "name": "Adobe Acrobat",
        "vendor": "adobe",
        "website_url": "https://www.adobe.com/acrobat.html",
        "pricing_url": "https://www.adobe.com/acrobat/pricing.html",
        "logo_url": "/images/tools/adobe-acrobat.svg",
        "tagline": "The incumbent PDF editor, with redaction behind a paid tier.",
        "facets": [
            ("media", "pdf"),
            ("deployment", "desktop"), ("deployment", "online"),
            ("method", "manual"),
            ("pricing_model", "subscription"),
            ("platform", "windows"), ("platform", "macos"), ("platform", "web"),
            ("capability", "ocr"), ("capability", "batch"), ("capability", "true-removal"),
            ("capability", "metadata-removal"),
            ("audience", "enterprise"), ("audience", "legal"),
        ],
        "plans": [
            {"code": "trial", "name": "Free trial", "tier_order": 0,
             "is_trial": True, "trial_days": 7},
            {"code": "pro", "name": "Acrobat Pro", "tier_order": 1,
             "amount": "22.9900", "currency": "USD", "unit": "month",
             "billing_period": "monthly",
             "highlights": ["Search and redact", "Sanitize document", "Batch redaction"]},
        ],
    },
    {
        "slug": "nitro-pdf",
        "name": "Nitro Pro",
        "vendor": "nitro",
        "website_url": "https://www.gonitro.com",
        "pricing_url": "https://www.gonitro.com/pricing",
        "logo_url": "/images/tools/nitro.svg",
        "tagline": "Windows-first PDF productivity suite with redaction.",
        "facets": [
            ("media", "pdf"),
            ("deployment", "desktop"),
            ("method", "manual"),
            ("pricing_model", "subscription"),
            ("platform", "windows"),
            ("capability", "ocr"), ("capability", "batch"),
            ("audience", "enterprise"),
        ],
        "plans": [
            {"code": "trial", "name": "Free trial", "tier_order": 0,
             "is_trial": True, "trial_days": 14},
            {"code": "standard", "name": "Nitro PDF Pro", "tier_order": 1,
             "amount": "14.0000", "currency": "EUR", "unit": "seat_month",
             "billing_period": "monthly", "highlights": ["Per-seat licensing"]},
        ],
    },
    {
        "slug": "foxit-editor",
        "name": "Foxit PDF Editor",
        "vendor": "foxit",
        "website_url": "https://www.foxit.com/pdf-editor/",
        "pricing_url": "https://www.foxit.com/pdf-editor/pricing.html",
        "logo_url": "/images/tools/foxit.svg",
        "tagline": "Lower-cost Acrobat alternative with manual redaction.",
        "facets": [
            ("media", "pdf"),
            ("deployment", "desktop"), ("deployment", "online"),
            ("method", "manual"),
            ("pricing_model", "subscription"),
            ("platform", "windows"), ("platform", "macos"),
            ("capability", "ocr"), ("capability", "metadata-removal"),
        ],
        "plans": [
            {"code": "trial", "name": "Free trial", "tier_order": 0,
             "is_trial": True, "trial_days": 14},
            {"code": "pro", "name": "PDF Editor Pro", "tier_order": 1,
             "amount": "12.9900", "currency": "USD", "unit": "month",
             "billing_period": "monthly", "highlights": ["Redaction and sanitization"]},
        ],
    },
    {
        "slug": "caseguard",
        "name": "CaseGuard Studio",
        "vendor": "caseguard",
        "website_url": "https://caseguard.com",
        "pricing_url": "https://caseguard.com/pricing/",
        "logo_url": "/images/tools/caseguard.svg",
        "tagline": "Enterprise redaction for video, audio and documents.",
        "facets": [
            ("media", "video"), ("media", "audio"), ("media", "image"), ("media", "pdf"),
            ("deployment", "desktop"),
            ("method", "ai"),
            ("pricing_model", "subscription"),
            ("platform", "windows"),
            ("capability", "face-detection"), ("capability", "licence-plate-detection"),
            ("capability", "speech-to-text"), ("capability", "batch"),
            ("capability", "audit-log"),
            ("compliance", "cjis"), ("compliance", "hipaa"),
            ("audience", "government"), ("audience", "law-enforcement"),
            ("audience", "legal"),
        ],
        "plans": [
            {"code": "studio", "name": "CaseGuard Studio", "tier_order": 0,
             "amount": "279.0000", "currency": "USD", "unit": "seat_month",
             "billing_period": "monthly",
             "highlights": ["Automatic face and plate detection", "Audio redaction",
                            "Audit logging"]},
        ],
    },
    {
        "slug": "redactable",
        "name": "Redactable",
        "vendor": "redactable",
        "website_url": "https://www.redactable.com",
        "pricing_url": "https://www.redactable.com/pricing",
        "logo_url": "/images/tools/redactable.svg",
        "tagline": "Cloud-native AI redaction with a limited free tier.",
        "facets": [
            ("media", "pdf"),
            ("deployment", "online"),
            ("method", "ai"),
            ("pricing_model", "freemium"), ("pricing_model", "pay-per-document"),
            ("platform", "web"),
            ("capability", "true-removal"), ("capability", "audit-log"),
            ("compliance", "gdpr"),
            ("audience", "legal"),
        ],
        "plans": [
            {"code": "free", "name": "Free", "tier_order": 0, "is_free_tier": True,
             "amount": "0.0000", "currency": "USD", "unit": "month",
             "billing_period": "monthly", "highlights": ["2 documents per month"]},
            {"code": "pro", "name": "Pro", "tier_order": 1,
             "amount": "29.0000", "currency": "USD", "unit": "month",
             "billing_period": "monthly", "highlights": ["Unlimited documents",
                                                         "Redaction certificate"]},
            {"code": "payg", "name": "Pay per document", "tier_order": 2,
             "amount": "1.0000", "currency": "USD", "unit": "document",
             "billing_period": "usage"},
        ],
    },
    {
        "slug": "ilovepdf",
        "name": "iLovePDF",
        "vendor": "ilovepdf",
        "website_url": "https://www.ilovepdf.com",
        "pricing_url": "https://www.ilovepdf.com/pricing",
        "logo_url": "/images/tools/ilovepdf.svg",
        "tagline": "Online PDF toolbox where redaction is one tool of many.",
        "facets": [
            ("media", "pdf"),
            ("deployment", "online"),
            ("method", "manual"),
            ("pricing_model", "freemium"),
            ("platform", "web"), ("platform", "ios"), ("platform", "android"),
            ("capability", "batch"),
            ("audience", "individual"),
        ],
        "plans": [
            {"code": "free", "name": "Free", "tier_order": 0, "is_free_tier": True,
             "amount": "0.0000", "currency": "EUR", "unit": "month",
             "billing_period": "monthly", "highlights": ["Capped, amount unpublished"]},
            {"code": "premium", "name": "Premium", "tier_order": 1,
             "amount": "9.0000", "currency": "EUR", "unit": "month",
             "billing_period": "monthly", "highlights": ["Unlimited tool use"]},
        ],
    },
]

SOURCE_NOTE = "Seeded from an editor-vetted comparison table."


def seed(apps, schema_editor):
    Vendor = apps.get_model("catalog", "Vendor")
    Tool = apps.get_model("catalog", "Tool")
    FacetValue = apps.get_model("catalog", "FacetValue")
    ToolFacet = apps.get_model("catalog", "ToolFacet")
    Plan = apps.get_model("catalog", "Plan")
    PlanPrice = apps.get_model("catalog", "PlanPrice")
    CrawlSource = apps.get_model("catalog", "CrawlSource")

    if Tool.objects.exists():
        return

    vendors = {
        slug: Vendor.objects.create(name=name, slug=slug, website_url=url, hq_country=country)
        for slug, (name, url, country) in VENDORS.items()
    }
    facets = {
        (value.dimension.code, value.code): value
        for value in FacetValue.objects.select_related("dimension")
    }

    for order, spec in enumerate(TOOLS):
        tool = Tool.objects.create(
            vendor=vendors[spec["vendor"]],
            name=spec["name"],
            slug=spec["slug"],
            status="draft",
            website_url=spec["website_url"],
            pricing_url=spec["pricing_url"],
            logo_url=spec["logo_url"],
            is_first_party=spec.get("is_first_party", False),
            tagline=spec["tagline"],
            sort_order=order * 10,
        )
        for key in spec["facets"]:
            ToolFacet.objects.create(tool=tool, value=facets[key])

        for plan_spec in spec["plans"]:
            plan = Plan.objects.create(
                tool=tool,
                name=plan_spec["name"],
                code=plan_spec["code"],
                tier_order=plan_spec["tier_order"],
                is_free_tier=plan_spec.get("is_free_tier", False),
                is_trial=plan_spec.get("is_trial", False),
                trial_days=plan_spec.get("trial_days"),
                highlights=plan_spec.get("highlights", []),
                source_url=spec["pricing_url"],
            )
            # A trial has no price row: "free for 14 days" is not a price, and
            # recording it as one is how a trial becomes a fake free tier.
            if "amount" not in plan_spec:
                continue
            PlanPrice.objects.create(
                plan=plan,
                amount=plan_spec["amount"],
                currency=plan_spec["currency"],
                unit=plan_spec["unit"],
                billing_period=plan_spec["billing_period"],
                source="manual",
                is_pinned=True,
                source_note=SOURCE_NOTE,
            )

        # The crawler is phase 2, but the source it will read is known now.
        # Our own pricing page is not crawled: we know what we charge.
        CrawlSource.objects.create(
            tool=tool,
            url=spec["pricing_url"],
            is_enabled=not spec.get("is_first_party", False),
        )


def noop_reverse(apps, schema_editor):
    """Seed data is not unwound: a reverse would delete rows staff may have edited."""


class Migration(migrations.Migration):
    dependencies = [("catalog", "0007_alter_tool_logo_url_alter_vendor_logo_url")]

    operations = [migrations.RunPython(seed, noop_reverse)]
