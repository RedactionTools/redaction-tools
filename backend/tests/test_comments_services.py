"""The comment rules, as plain functions: who skips review, and what may be posted where."""

import pytest
from django.contrib.auth import get_user_model

from apps.catalog.models import Tool, ToolStatus
from apps.comments import services
from apps.comments.models import Comment, CommentSettings, CommentStatus

pytestmark = pytest.mark.django_db

TOOL = "pdf-redaction"
POST = "introducing-redaction-tools"


def _published(author, count):
    tool = Tool.objects.get(slug=TOOL)
    for n in range(count):
        Comment.objects.create(
            tool=tool, author=author, body=f"#{n}", status=CommentStatus.PUBLISHED
        )


def _settings(**changes):
    CommentSettings.objects.filter(pk=1).update(**changes)


# --- Who skips review ----------------------------------------------------------


def test_a_new_account_waits_for_review(user):
    assert services.initial_status(user) == CommentStatus.PENDING


def test_staff_always_publish(staff_user):
    assert services.initial_status(staff_user) == CommentStatus.PUBLISHED


def test_auto_approve_publishes_everyone(user):
    _settings(auto_approve=True)

    assert services.initial_status(user) == CommentStatus.PUBLISHED


def test_an_account_is_trusted_after_enough_published_comments(user):
    _published(user, 3)

    assert services.initial_status(user) == CommentStatus.PUBLISHED


def test_one_short_of_the_threshold_is_not_trusted(user):
    _published(user, 2)

    assert services.initial_status(user) == CommentStatus.PENDING


def test_a_zero_threshold_turns_trust_off(user):
    _settings(trusted_after=0)
    _published(user, 10)

    assert services.initial_status(user) == CommentStatus.PENDING


# --- Posting -------------------------------------------------------------------


def test_posting_on_a_tool(user):
    comment = services.post_comment(
        user=user, target_type="tool", slug=TOOL, body="  Does it OCR?  "
    )

    assert (comment.tool.slug, comment.body, comment.status, comment.depth) == (
        TOOL,
        "Does it OCR?",
        CommentStatus.PENDING,
        0,
    )


def test_posting_on_a_blog_post(user):
    comment = services.post_comment(user=user, target_type="blog", slug=POST, body="Nice.")

    assert (comment.tool, comment.blog_slug) == (None, POST)


def test_a_tool_that_is_not_listable_takes_no_comments(user):
    Tool.objects.filter(slug=TOOL).update(status=ToolStatus.DRAFT)

    with pytest.raises(services.CommentNotFound):
        services.post_comment(user=user, target_type="tool", slug=TOOL, body="Hi")


def test_an_unknown_tool_takes_no_comments(user):
    with pytest.raises(services.CommentNotFound):
        services.post_comment(user=user, target_type="tool", slug="nope", body="Hi")


def test_a_malformed_blog_slug_is_refused(user):
    with pytest.raises(services.CommentError, match="slug"):
        services.post_comment(user=user, target_type="blog", slug="../etc", body="Hi")


def test_an_unknown_target_type_is_refused(user):
    with pytest.raises(services.CommentError, match="target"):
        services.post_comment(user=user, target_type="vendor", slug=TOOL, body="Hi")


@pytest.mark.parametrize("body", ["", "   \n "])
def test_an_empty_body_is_refused(user, body):
    with pytest.raises(services.CommentError, match="empty"):
        services.post_comment(user=user, target_type="tool", slug=TOOL, body=body)


def test_an_overlong_body_is_refused(user, settings):
    settings.COMMENTS_MAX_LENGTH = 10

    with pytest.raises(services.CommentError, match="10"):
        services.post_comment(user=user, target_type="tool", slug=TOOL, body="x" * 11)


def test_an_account_cannot_pile_up_pending_comments(user, settings):
    settings.COMMENTS_MAX_PENDING = 2
    for _ in range(2):
        services.post_comment(user=user, target_type="tool", slug=TOOL, body="Hi")

    with pytest.raises(services.CommentError, match="review"):
        services.post_comment(user=user, target_type="tool", slug=TOOL, body="Hi")


def test_the_pending_cap_does_not_apply_once_comments_publish(user, settings):
    settings.COMMENTS_MAX_PENDING = 1
    _settings(auto_approve=True)

    for _ in range(3):
        services.post_comment(user=user, target_type="tool", slug=TOOL, body="Hi")


# --- Replies -------------------------------------------------------------------


@pytest.fixture
def parent(staff_user):
    return services.post_comment(user=staff_user, target_type="tool", slug=TOOL, body="Root")


def test_a_reply_sits_one_level_below_its_parent(user, parent):
    reply = services.post_comment(
        user=user, target_type="tool", slug=TOOL, body="Reply", parent_id=parent.pk
    )

    assert (reply.parent, reply.depth) == (parent, 1)


def test_a_reply_must_be_on_its_parents_page(user, parent):
    with pytest.raises(services.CommentError, match="same page"):
        services.post_comment(
            user=user, target_type="blog", slug=POST, body="Reply", parent_id=parent.pk
        )


def test_an_unpublished_comment_takes_no_replies(user):
    pending = services.post_comment(user=user, target_type="tool", slug=TOOL, body="Root")

    with pytest.raises(services.CommentError, match="reply"):
        services.post_comment(
            user=user, target_type="tool", slug=TOOL, body="Reply", parent_id=pending.pk
        )


def test_an_unknown_parent_is_refused(user):
    with pytest.raises(services.CommentError, match="reply"):
        services.post_comment(
            user=user, target_type="tool", slug=TOOL, body="Reply", parent_id=999999
        )


def test_threads_stop_at_the_depth_cap(staff_user, settings):
    settings.COMMENTS_MAX_DEPTH = 2
    node = services.post_comment(user=staff_user, target_type="tool", slug=TOOL, body="0")
    for _ in range(2):
        node = services.post_comment(
            user=staff_user, target_type="tool", slug=TOOL, body="n", parent_id=node.pk
        )

    with pytest.raises(services.CommentError, match="deep"):
        services.post_comment(
            user=staff_user, target_type="tool", slug=TOOL, body="n", parent_id=node.pk
        )


# --- Editing and deleting ------------------------------------------------------


def test_editing_a_published_comment_sends_it_back_to_review(user):
    comment = services.post_comment(user=user, target_type="tool", slug=TOOL, body="Fine")
    Comment.objects.filter(pk=comment.pk).update(status=CommentStatus.PUBLISHED)

    edited = services.edit_comment(user=user, comment_id=comment.pk, body="Buy pills")

    assert (edited.body, edited.status) == ("Buy pills", CommentStatus.PENDING)
    assert edited.edited_at is not None


def test_a_trusted_author_edits_without_review(user):
    _published(user, 3)
    comment = services.post_comment(user=user, target_type="tool", slug=TOOL, body="Fine")

    edited = services.edit_comment(user=user, comment_id=comment.pk, body="Finer")

    assert edited.status == CommentStatus.PUBLISHED


def test_only_the_author_may_edit(user, parent):
    with pytest.raises(services.CommentNotFound):
        services.edit_comment(user=user, comment_id=parent.pk, body="Mine now")


def test_a_rejected_comment_cannot_be_edited_back_into_review(user):
    comment = services.post_comment(user=user, target_type="tool", slug=TOOL, body="Spam")
    Comment.objects.filter(pk=comment.pk).update(status=CommentStatus.REJECTED)

    with pytest.raises(services.CommentError, match="rejected"):
        services.edit_comment(user=user, comment_id=comment.pk, body="Not spam")


def test_deleting_blanks_the_comment_but_keeps_the_row(user):
    comment = services.post_comment(user=user, target_type="tool", slug=TOOL, body="Oops")

    services.delete_own_comment(user=user, comment_id=comment.pk)

    comment.refresh_from_db()
    assert (comment.status, comment.body) == (CommentStatus.REMOVED, "")


def test_only_the_author_may_delete(parent):
    stranger = get_user_model().objects.create_user(email="stranger@example.com")

    with pytest.raises(services.CommentNotFound):
        services.delete_own_comment(user=stranger, comment_id=parent.pk)


# --- The public thread ---------------------------------------------------------


def _thread():
    return services.public_thread(target_type="tool", slug=TOOL)


def test_the_thread_shows_only_published_comments(user, parent):
    services.post_comment(user=user, target_type="tool", slug=TOOL, body="Pending")

    assert [row["body"] for row in _thread()] == ["Root"]


def test_a_removed_comment_with_published_replies_stays_as_a_placeholder(user, parent):
    _published(user, 3)
    reply = services.post_comment(
        user=user, target_type="tool", slug=TOOL, body="Reply", parent_id=parent.pk
    )
    Comment.objects.filter(pk=parent.pk).update(status=CommentStatus.REMOVED, body="")

    rows = {row["id"]: row for row in _thread()}

    assert rows[parent.pk] | {"created_at": None} == {
        "id": parent.pk,
        "parent_id": None,
        "depth": 0,
        "status": "removed",
        "body": None,
        "author": None,
        "created_at": None,
        "edited_at": None,
    }
    assert rows[reply.pk]["parent_id"] == parent.pk


def test_a_removed_comment_with_no_replies_is_gone(parent):
    Comment.objects.filter(pk=parent.pk).update(status=CommentStatus.REMOVED)

    assert _thread() == []


def test_authors_are_named_but_never_by_email(user, parent):
    get_user_model().objects.filter(pk=user.pk).update(name="")
    _published(user, 1)

    authors = [row["author"] for row in _thread()]

    assert authors[0] == {
        "id": parent.author.pk,
        "name": "Staff",
        "is_staff": True,
        "is_vendor": False,
    }
    assert authors[1]["name"] == "Member"
    assert "example.com" not in repr(_thread())


def test_an_owner_of_the_tool_is_badged_as_its_vendor(owner):
    _published(owner, 1)

    assert _thread()[0]["author"]["is_vendor"] is True


def test_the_thread_of_a_tool_that_is_not_listable_is_not_found(parent):
    Tool.objects.filter(slug=TOOL).update(status=ToolStatus.DRAFT)

    with pytest.raises(services.CommentNotFound):
        _thread()


def test_an_author_sees_their_own_comments_awaiting_review(user, parent):
    mine = services.post_comment(user=user, target_type="tool", slug=TOOL, body="Mine")
    services.post_comment(user=user, target_type="blog", slug=POST, body="Elsewhere")

    rows = services.my_pending(user=user, target_type="tool", slug=TOOL)

    assert [(row["id"], row["status"]) for row in rows] == [(mine.pk, "pending")]
