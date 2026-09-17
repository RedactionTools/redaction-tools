"""What the seed migrations put in the database.

These are assertions about published facts, so they are worth pinning: a seed
that silently stops running leaves the catalog empty rather than broken.
"""

import pytest
from django.conf import settings

from apps.catalog.models import (
    FacetDimension,
    FacetValue,
    Plan,
    PlanPrice,
    PriceSource,
    PriceUnit,
    Tool,
)

MEDIA_VALUES = {"pdf", "image", "video", "audio", "text"}


@pytest.mark.django_db
def test_media_is_the_first_dimension_and_carries_every_medium():
    """`media` leads the taxonomy: on this domain it is the primary buying filter."""
    assert FacetDimension.objects.first().code == "media"

    media = FacetDimension.objects.get(code="media")
    assert set(media.values.values_list("code", flat=True)) == MEDIA_VALUES


@pytest.mark.django_db
def test_every_designed_dimension_is_seeded():
    assert set(FacetDimension.objects.values_list("code", flat=True)) == {
        "media",
        "deployment",
        "method",
        "pricing_model",
        "compliance",
        "platform",
        "capability",
        "audience",
    }


@pytest.mark.django_db
def test_no_facet_is_a_landing_page_yet():
    """Facets ship filter-only until the catalog is big enough to fill the pages."""
    assert not FacetValue.objects.filter(is_landing_page=True).exists()


@pytest.mark.django_db
def test_the_launch_catalog_is_seeded():
    assert set(Tool.objects.values_list("slug", flat=True)) == {
        "pdf-redaction",
        "adobe-acrobat",
        "nitro-pdf",
        "foxit-editor",
        "caseguard",
        "redactable",
        "ilovepdf",
    }


@pytest.mark.django_db
def test_every_seeded_tool_is_published_and_listable():
    """Seeding a tool that cannot be listed would put a dead row in the sitemap."""
    tools = list(Tool.objects.all())

    assert tools
    assert [tool.slug for tool in tools if not tool.is_listable()] == []


@pytest.mark.django_db
def test_the_catalog_is_not_pdf_only():
    """The `media` dimension is the point of this domain; prove it carries rows."""
    caseguard = Tool.objects.get(slug="caseguard")

    media = set(
        caseguard.facets.filter(value__dimension__code="media").values_list(
            "value__code", flat=True
        )
    )
    assert {"video", "audio"} <= media


@pytest.mark.django_db
def test_seeded_prices_match_the_vetted_figures():
    acrobat = Plan.objects.get(tool__slug="adobe-acrobat", code="pro")
    payg = Plan.objects.get(tool__slug="pdf-redaction", code="payg")

    assert str(acrobat.prices.get(is_current=True).amount) == "22.9900"
    assert payg.prices.get(is_current=True).unit == PriceUnit.PAGE


@pytest.mark.django_db
def test_a_trial_is_not_a_free_tier():
    """A 7-day trial must never normalize into a free tier - it drives the `free` facet."""
    trial = Plan.objects.get(tool__slug="adobe-acrobat", code="trial")

    assert trial.is_trial is True
    assert trial.is_free_tier is False
    assert trial.trial_days == 7
    assert not trial.prices.exists()


@pytest.mark.django_db
def test_seeded_prices_are_pinned_and_attributed_to_editors():
    """Every launch figure was entered by a human, so the crawler may not move it."""
    prices = PlanPrice.objects.all()

    assert prices.exists()
    assert not prices.exclude(source=PriceSource.MANUAL).exists()
    assert not prices.filter(is_pinned=False).exists()


@pytest.mark.django_db
def test_the_first_party_listing_discloses_itself():
    ours = Tool.objects.get(is_first_party=True)

    assert "our own product" in ours.description_md


@pytest.mark.django_db
def test_seeded_tools_record_when_a_human_verified_them():
    """Without a date the profile cannot say "as of", which is the whole point of
    publishing a price rather than asserting one."""
    tools = Tool.objects.all()

    assert tools.exists()
    assert not tools.filter(last_verified_at__isnull=True).exists()
    assert not tools.filter(prices_changed_at__isnull=True).exists()


@pytest.mark.django_db
def test_every_seeded_logo_points_at_a_file_we_actually_host():
    """Logos are re-hosted, so a recorded path with no file behind it is a broken
    image in the comparison table. Nothing else catches that."""
    logos = settings.BASE_DIR.parent / "frontend" / "public"
    if not logos.exists():  # pragma: no cover - backend-only checkouts
        pytest.skip("frontend/public is not present in this checkout")

    missing = [
        (tool.slug, tool.logo_url)
        for tool in Tool.objects.exclude(logo_url="")
        if tool.logo_url.startswith("/") and not (logos / tool.logo_url.lstrip("/")).is_file()
    ]

    assert missing == []
