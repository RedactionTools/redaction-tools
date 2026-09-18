"""The staff catalog tools, over JSON-RPC.

The rules are tested in `test_catalog_staff.py`; this file proves the wiring -
that the schemas the model sees match what staff may write, that a refusal comes
back as something a model can correct from, and that a refused write leaves
nothing behind.
"""

import json

import pytest

from apps.catalog.constants import STAFF_EDITABLE_TOOL_FIELDS
from apps.catalog.models import PlanPrice, Tool, ToolRevision

pytestmark = pytest.mark.django_db

SEEDED = "pdf-redaction"
METADATA_URL = "http://169.254.169.254/latest/meta-data/"

TOOLS = {
    "catalog_list_tools",
    "catalog_get_tool",
    "catalog_list_plans",
    "catalog_update_tool",
    "catalog_update_plan",
    "catalog_set_plan_price",
}


def payload(result):
    """The structured body of a successful tool result."""
    assert result["isError"] is False, result
    return json.loads(result["content"][0]["text"])


def test_the_server_offers_exactly_the_staff_catalog_tools(mcp):
    names = {tool["name"] for tool in mcp("tools/list").json()["result"]["tools"]}

    assert names == TOOLS


def test_list_tools_pages_the_catalog(call_tool):
    body = payload(call_tool("catalog_list_tools", {"limit": 3}))

    # The seed migrations put seven tools in every test database.
    assert body["count"] == 7
    assert len(body["items"]) == 3


def test_list_tools_reaches_drafts_the_public_api_hides(call_tool, staff_user):
    Tool.objects.filter(slug=SEEDED).update(status="draft")

    slugs = {row["slug"] for row in payload(call_tool("catalog_list_tools"))["items"]}

    assert SEEDED in slugs


def test_get_tool_reports_what_stands_between_a_draft_and_a_page(call_tool):
    Tool.objects.filter(slug=SEEDED).update(status="draft", description_md="Short.")

    body = payload(call_tool("catalog_get_tool", {"slug": SEEDED}))

    assert body["listable"] is False
    blob = " ".join(body["listability_reasons"])
    assert "draft" in blob
    assert "description_md" in blob


def test_an_unknown_slug_is_correctable_rather_than_a_crash(call_tool):
    result = call_tool("catalog_get_tool", {"slug": "no-such-tool"})

    # In-band, so the model sees it and tries a different slug.
    assert result["isError"] is True
    assert "no-such-tool" in result["content"][0]["text"]


def test_a_misspelt_argument_is_rejected_rather_than_ignored(call_tool):
    result = call_tool("catalog_update_tool", {"slug": SEEDED, "taglien": "oops"})

    assert result["isError"] is True
    assert "taglien" in result["content"][0]["text"]


def test_update_tool_changes_the_listing(call_tool):
    body = payload(call_tool("catalog_update_tool", {"slug": SEEDED, "tagline": "Careful"}))

    assert body["changed"] == ["tagline"]
    assert Tool.objects.get(slug=SEEDED).tagline == "Careful"


def test_a_refused_edit_names_the_offending_field(call_tool):
    result = call_tool("catalog_update_tool", {"slug": SEEDED, "pricing_url": METADATA_URL})

    assert result["isError"] is True
    assert "pricing_url" in result["content"][0]["text"]


def test_a_refused_edit_writes_none_of_itself(call_tool):
    """One bad field refuses the whole edit, not just its own half.

    The guard is that validation runs before the transaction opens, so the
    common refusal never touches the database. django_mcpz savepoints the tool
    call on top of that, which is what covers a failure partway through a write.
    """
    before = Tool.objects.get(slug=SEEDED).tagline

    result = call_tool(
        "catalog_update_tool",
        {"slug": SEEDED, "tagline": "Half-applied", "pricing_url": METADATA_URL},
    )

    assert result["isError"] is True
    assert Tool.objects.get(slug=SEEDED).tagline == before
    assert not ToolRevision.objects.filter(tool__slug=SEEDED).exists()


def test_update_plan_changes_the_plan(call_tool):
    body = payload(
        call_tool("catalog_update_plan", {"slug": SEEDED, "code": "pro", "min_seats": 4})
    )

    assert body["changed"] == ["min_seats"]


def test_set_plan_price_publishes_a_new_current_figure(call_tool):
    body = payload(
        call_tool(
            "catalog_set_plan_price",
            {
                "slug": SEEDED,
                "code": "pro",
                "amount": "21.00",
                "unit": "month",
                "billing_period": "monthly",
                "source_note": "Vendor pricing page, checked today.",
            },
        )
    )

    assert body["changed"] is True
    assert body["previous"]["amount"] == "15.0000"
    current = PlanPrice.objects.get(
        plan__tool__slug=SEEDED, plan__code="pro", is_current=True, is_overage=False
    )
    assert str(current.amount) == "21.0000"


def test_the_update_tool_schema_offers_every_staff_editable_field(mcp):
    """Keeps the schema the model reads and the allowlist from drifting apart."""
    tools = {tool["name"]: tool for tool in mcp("tools/list").json()["result"]["tools"]}

    properties = set(tools["catalog_update_tool"]["inputSchema"]["properties"])

    assert properties == STAFF_EDITABLE_TOOL_FIELDS | {"slug"}


def test_the_write_tools_are_annotated_as_writes(mcp):
    tools = {tool["name"]: tool for tool in mcp("tools/list").json()["result"]["tools"]}

    assert tools["catalog_get_tool"]["annotations"]["readOnlyHint"] is True
    assert tools["catalog_update_tool"]["annotations"]["destructiveHint"] is True


def test_a_non_staff_caller_is_offered_no_tools(mcp, user_token):
    """If the door check is ever loosened, the per-tool permission still holds."""
    assert mcp("tools/list", token=user_token).status_code == 403
