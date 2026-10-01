"""Moderation, as plain functions: the module the staff API and the MCP both call."""

import pytest

from apps.comments import services, staff
from apps.comments.models import Comment, CommentSettings, CommentStatus

pytestmark = pytest.mark.django_db

TOOL = "pdf-redaction"
POST = "introducing-redaction-tools"


@pytest.fixture
def pending(user):
    return services.post_comment(user=user, target_type="tool", slug=TOOL, body="Is it fast?")


def test_the_queue_lists_pending_comments_newest_first(user, pending):
    newer = services.post_comment(user=user, target_type="blog", slug=POST, body="Hi")

    page = staff.list_comments(status="pending")

    assert page["count"] == 2
    assert [row["id"] for row in page["items"]] == [newer.pk, pending.pk]
    expected = {
        "target_type": "tool",
        "target_slug": TOOL,
        "target_title": "PDF Redaction",
        "body": "Is it fast?",
        "parent_body": None,
        "review_note": "",
    }
    assert {key: page["items"][1][key] for key in expected} == expected


def test_the_queue_filters_by_page(user, pending):
    services.post_comment(user=user, target_type="blog", slug=POST, body="Hi")

    page = staff.list_comments(target_type="tool", slug=TOOL)

    assert [row["id"] for row in page["items"]] == [pending.pk]


def test_the_queue_shows_what_a_reply_answers(user, staff_user):
    root = services.post_comment(user=staff_user, target_type="tool", slug=TOOL, body="Root")
    services.post_comment(user=user, target_type="tool", slug=TOOL, body="Re", parent_id=root.pk)

    page = staff.list_comments(status="pending")

    assert page["items"][0]["parent_body"] == "Root"


def test_the_queue_pages(user, settings):
    settings.COMMENTS_MAX_PENDING = 10
    for n in range(3):
        services.post_comment(user=user, target_type="tool", slug=TOOL, body=f"#{n}")

    page = staff.list_comments(limit=2, offset=2)

    assert (page["count"], [row["body"] for row in page["items"]]) == (3, ["#0"])


def test_an_unknown_status_filter_is_refused():
    with pytest.raises(staff.StaffError, match="status"):
        staff.list_comments(status="spam")


def test_publishing_records_who_decided(staff_user, pending):
    row = staff.review_comment(user=staff_user, comment_id=pending.pk, status="published")

    pending.refresh_from_db()
    assert (row["status"], pending.reviewed_by, pending.reviewed_at is not None) == (
        "published",
        staff_user,
        True,
    )


def test_rejecting_keeps_the_note(staff_user, pending):
    staff.review_comment(
        user=staff_user, comment_id=pending.pk, status="rejected", note="Off topic"
    )

    pending.refresh_from_db()
    assert (pending.status, pending.review_note) == (CommentStatus.REJECTED, "Off topic")


def test_removing_keeps_the_text_for_the_record(staff_user, pending):
    staff.review_comment(user=staff_user, comment_id=pending.pk, status="removed")

    pending.refresh_from_db()
    assert (pending.status, pending.body) == (CommentStatus.REMOVED, "Is it fast?")


def test_a_review_cannot_send_a_comment_back_to_pending(staff_user, pending):
    with pytest.raises(staff.StaffError, match="status"):
        staff.review_comment(user=staff_user, comment_id=pending.pk, status="pending")


def test_reviewing_an_unknown_comment_is_refused(staff_user):
    with pytest.raises(staff.StaffError, match="999999"):
        staff.review_comment(user=staff_user, comment_id=999999, status="published")


def test_reading_the_settings():
    assert staff.get_settings() == {"auto_approve": False, "trusted_after": 3}


def test_changing_the_settings_records_who(staff_user):
    result = staff.update_settings(user=staff_user, auto_approve=True)

    assert result == {"auto_approve": True, "trusted_after": 3}
    assert CommentSettings.load().updated_by == staff_user


def test_a_negative_threshold_is_refused(staff_user):
    with pytest.raises(staff.StaffError, match="trusted_after"):
        staff.update_settings(user=staff_user, trusted_after=-1)


def test_a_comment_from_an_auto_approved_account_skips_the_queue(staff_user, user):
    staff.update_settings(user=staff_user, auto_approve=True)

    comment = services.post_comment(user=user, target_type="tool", slug=TOOL, body="Now")

    assert Comment.objects.get(pk=comment.pk).status == CommentStatus.PUBLISHED
