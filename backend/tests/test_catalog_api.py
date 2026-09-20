"""The public catalog read API.

Everything here is served from the listable set: a tool that cannot clear the
indexability bar is a database row, not a resource.
"""

import pytest

from apps.catalog.models import (
    Plan,
    PlanPrice,
    PriceUnit,
    Tool,
    ToolStatus,
    Vendor,
)

LIST_URL = "/api/v1/catalog/tools"


def _png_bytes(width, height):
    import io

    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (20, 60, 120)).save(buffer, format="PNG")
    return buffer.getvalue()


def _slugs(payload):
    return [tool["slug"] for tool in payload["items"]]


@pytest.fixture
def draft_tool(db):
    vendor = Vendor.objects.create(
        name="Fixture Vendor", slug="fixture-vendor", website_url="https://93.184.216.34/"
    )
    return Tool.objects.create(
        vendor=vendor,
        name="Draft Tool",
        slug="draft-tool",
        website_url="https://93.184.216.34/draft",
    )


@pytest.mark.django_db
def test_list_serves_the_seeded_catalog(client):
    payload = client.get(LIST_URL).json()

    assert payload["count"] == 7
    assert "adobe-acrobat" in _slugs(payload)


@pytest.mark.django_db
def test_list_excludes_anything_that_is_not_listable(client, draft_tool):
    """Drafts and half-finished entries never reach the public API."""
    payload = client.get(LIST_URL).json()

    assert "draft-tool" not in _slugs(payload)


@pytest.mark.django_db
def test_a_row_carries_what_the_hub_table_renders(client):
    payload = client.get(f"{LIST_URL}?q=acrobat").json()

    # `acrobat` also matches Foxit, whose editorial names it - pick by slug.
    row = next(item for item in payload["items"] if item["slug"] == "adobe-acrobat")
    assert row["slug"] == "adobe-acrobat"
    assert row["vendor"]["name"] == "Adobe"
    assert row["tagline"]
    assert "pdf" in row["facet_slugs"]


@pytest.mark.django_db
def test_a_trial_is_reported_as_a_trial_and_not_as_a_free_tier(client):
    payload = client.get(f"{LIST_URL}?q=acrobat").json()

    row = next(item for item in payload["items"] if item["slug"] == "adobe-acrobat")
    summary = row["price_summary"]
    assert summary["has_free_tier"] is False
    assert summary["is_trial"] is True
    assert summary["trial_days"] == 7


@pytest.mark.django_db
def test_the_from_price_is_the_cheapest_recurring_paid_plan(client):
    payload = client.get(f"{LIST_URL}?q=redactable").json()

    summary = payload["items"][0]["price_summary"]
    assert summary["has_free_tier"] is True
    assert summary["from_amount"] == "29.0000"
    assert summary["unit"] == PriceUnit.MONTH


@pytest.mark.django_db
def test_a_per_page_price_is_never_presented_as_a_monthly_from_price(client):
    """$0.05 per page is not $0.05 a month; only comparable units set the figure."""
    payload = client.get(f"{LIST_URL}?q=pdf+redaction").json()

    summary = next(t for t in payload["items"] if t["slug"] == "pdf-redaction")["price_summary"]
    assert summary["unit"] == PriceUnit.MONTH
    assert summary["from_amount"] == "15.0000"


@pytest.mark.django_db
def test_every_price_says_where_it_came_from(client):
    payload = client.get(LIST_URL).json()

    summaries = [tool["price_summary"] for tool in payload["items"]]
    sources = {summary["source"] for summary in summaries if summary["source"]}
    assert sources == {"manual"}


@pytest.mark.django_db
def test_filtering_within_a_dimension_is_an_or(client):
    payload = client.get(f"{LIST_URL}?media=video,audio").json()

    assert _slugs(payload) == ["caseguard"]


@pytest.mark.django_db
def test_filtering_across_dimensions_is_an_and(client):
    """Each dimension narrows; a second filter must not widen the result."""
    pdf_only = client.get(f"{LIST_URL}?media=pdf").json()["count"]
    pdf_and_ai = client.get(f"{LIST_URL}?media=pdf&method=ai").json()

    assert pdf_and_ai["count"] < pdf_only
    assert set(_slugs(pdf_and_ai)) == {"pdf-redaction", "redactable", "caseguard"}


@pytest.mark.django_db
def test_free_tier_filter(client):
    payload = client.get(f"{LIST_URL}?has_free_tier=true").json()

    assert set(_slugs(payload)) == {"pdf-redaction", "redactable", "ilovepdf"}


@pytest.mark.django_db
def test_search_matches_name_tagline_and_summary(client):
    assert _slugs(client.get(f"{LIST_URL}?q=licence+plate").json()) == ["caseguard"]
    assert _slugs(client.get(f"{LIST_URL}?q=foxit").json()) == ["foxit-editor"]


@pytest.mark.django_db
def test_ordering_by_price_puts_the_cheapest_first_and_the_unpriced_last(client):
    """A tool with no comparable price sorts last in both directions, never first."""
    ascending = _slugs(client.get(f"{LIST_URL}?ordering=price").json())
    descending = _slugs(client.get(f"{LIST_URL}?ordering=-price").json())

    assert ascending[0] == "ilovepdf"
    assert descending[0] == "caseguard"


@pytest.mark.django_db
def test_the_first_party_tool_is_not_sorted_first(client):
    """We are in our own catalog; default order is price then name, never us."""
    payload = client.get(LIST_URL).json()

    assert _slugs(payload)[0] != "pdf-redaction"


@pytest.mark.django_db
def test_detail_carries_plans_prices_and_editorial(client):
    payload = client.get(f"{LIST_URL}/caseguard").json()

    assert payload["slug"] == "caseguard"
    assert len(payload["description_md"]) >= 400
    plan = payload["plans"][0]
    assert plan["code"] == "studio"
    assert plan["prices"][0]["amount"] == "279.0000"
    assert plan["prices"][0]["source"] == "manual"


@pytest.mark.django_db
def test_detail_carries_facets_the_page_can_name(client):
    """A slug is not a label. The detail carries both, plus the dimension each
    belongs to, so a page can group and name what a tool does without shipping a
    second copy of the taxonomy."""
    payload = client.get(f"{LIST_URL}/caseguard").json()

    capabilities = [facet for facet in payload["facets"] if facet["dimension"] == "capability"]
    assert {"face-detection", "batch"} <= {facet["slug"] for facet in capabilities}
    assert "Face detection" in {facet["label"] for facet in capabilities}
    assert capabilities[0]["dimension_label"] == "Capability"


@pytest.mark.django_db
def test_detail_404s_on_an_unknown_slug(client):
    response = client.get(f"{LIST_URL}/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {"detail": "No tool with that slug."}


@pytest.mark.django_db
def test_detail_404s_on_a_tool_that_is_not_listable(client, draft_tool):
    assert client.get(f"{LIST_URL}/draft-tool").status_code == 404


@pytest.mark.django_db
def test_facets_carry_live_counts(client):
    payload = client.get("/api/v1/catalog/facets").json()

    media = next(d for d in payload if d["code"] == "media")
    counts = {value["code"]: value["tool_count"] for value in media["values"]}
    assert counts["pdf"] == 7
    assert counts["video"] == 1
    assert media["values"][0]["code"] == "pdf"


@pytest.mark.django_db
def test_no_facet_advertises_a_landing_page_yet(client):
    payload = client.get("/api/v1/catalog/facets").json()

    assert not [v for d in payload for v in d["values"] if v["has_landing_page"]]


@pytest.mark.django_db
def test_stats_give_the_homepage_its_factual_lede(client):
    payload = client.get("/api/v1/catalog/stats").json()

    assert payload["tools"] == 7
    assert payload["with_free_tier"] == 3
    assert payload["media"] == ["pdf", "image", "video", "audio", "text"]
    assert payload["generated_at"]


@pytest.mark.django_db
def test_an_archived_tool_leaves_the_catalog(client):
    Tool.objects.filter(slug="ilovepdf").update(status=ToolStatus.ARCHIVED)

    assert "ilovepdf" not in _slugs(client.get(LIST_URL).json())


@pytest.mark.django_db
def test_a_quote_only_tool_is_listed_without_a_price(client):
    tool = Tool.objects.get(slug="nitro-pdf")
    PlanPrice.objects.filter(plan__tool=tool).delete()
    Plan.objects.filter(tool=tool).update(is_enterprise_quote=True, is_trial=False)

    payload = client.get(f"{LIST_URL}?q=nitro").json()

    summary = payload["items"][0]["price_summary"]
    assert summary["is_quote_only"] is True
    assert summary["from_amount"] is None


@pytest.mark.django_db
def test_a_profile_carries_published_screenshots_with_a_srcset(client):
    """A picture ships as every width it was rendered at, so a phone is not sent
    the 1920 and the figure can be reserved before it loads."""
    from apps.catalog import screenshots
    from apps.catalog.models import ToolScreenshotSource, ToolScreenshotStatus

    tool = Tool.objects.get(slug="adobe-acrobat")
    screenshots.store(
        tool=tool,
        data=_png_bytes(2000, 1000),
        alt_text="The Acrobat redaction panel",
        caption="Marking text for redaction",
        source=ToolScreenshotSource.STAFF,
        status=ToolScreenshotStatus.PUBLISHED,
    )

    payload = client.get(f"{LIST_URL}/adobe-acrobat").json()

    shot = payload["screenshots"][0]
    assert shot["alt"] == "The Acrobat redaction panel"
    assert shot["caption"] == "Marking text for redaction"
    assert (shot["width"], shot["height"]) == (2000, 1000)
    assert shot["url"].startswith("http")
    assert "480w" in shot["srcset"] and "1920w" in shot["srcset"]


@pytest.mark.django_db
def test_a_screenshot_awaiting_review_is_not_on_the_profile(client):
    """A vendor uploading a picture must not be able to publish one."""
    from apps.catalog import screenshots
    from apps.catalog.models import ToolScreenshotSource

    tool = Tool.objects.get(slug="adobe-acrobat")
    screenshots.store(
        tool=tool,
        data=_png_bytes(1000, 500),
        alt_text="Not reviewed yet",
        source=ToolScreenshotSource.VENDOR,
    )

    payload = client.get(f"{LIST_URL}/adobe-acrobat").json()

    assert payload["screenshots"] == []
