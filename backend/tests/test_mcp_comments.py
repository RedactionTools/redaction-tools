"""The staff comment tools, over JSON-RPC.

The rules are tested in `test_comments_staff.py`; this file proves the wiring.
"""

import json

import pytest

from apps.comments import services
from apps.comments.models import CommentStatus

pytestmark = pytest.mark.django_db

TOOLS = {"comments_list", "comments_review", "comments_get_settings", "comments_set_settings"}


def payload(result):
    assert result["isError"] is False, result
    return json.loads(result["content"][0]["text"])


@pytest.fixture
def pending(user):
    return services.post_comment(
        user=user, target_type="tool", slug="pdf-redaction", body="Is it fast?"
    )


def test_the_server_offers_the_comment_tools(mcp):
    names = {tool["name"] for tool in mcp("tools/list").json()["result"]["tools"]}

    assert {name for name in names if name.startswith("comments_")} == TOOLS


def test_listing_the_queue(call_tool, pending):
    body = payload(call_tool("comments_list", {"status": "pending"}))

    assert (body["count"], body["items"][0]["body"]) == (1, "Is it fast?")


def test_reviewing_a_comment(call_tool, pending, staff_user):
    body = payload(call_tool("comments_review", {"comment_id": pending.pk, "status": "published"}))

    pending.refresh_from_db()
    assert (body["status"], pending.status, pending.reviewed_by) == (
        "published",
        CommentStatus.PUBLISHED,
        staff_user,
    )


def test_a_bad_review_comes_back_as_an_error_the_model_can_fix(call_tool, pending):
    result = call_tool("comments_review", {"comment_id": pending.pk, "status": "pending"})

    assert result["isError"] is True
    assert "status must be one of" in result["content"][0]["text"]


def test_switching_auto_approve(call_tool):
    body = payload(call_tool("comments_set_settings", {"auto_approve": True}))

    assert body == {"auto_approve": True, "trusted_after": 3}
    assert payload(call_tool("comments_get_settings"))["auto_approve"] is True
