"""Comment mail: staff hear when one waits for review, an author when a reply to them is published.

Each is queued once the comment commits, so the tests run the on-commit hooks.
"""

import pytest
from django.contrib.auth import get_user_model
from django.core import mail

from apps.comments import services, staff
from apps.comments.models import CommentSettings

pytestmark = pytest.mark.django_db

TOOL = "pdf-redaction"


@pytest.fixture
def capture(django_capture_on_commit_callbacks):
    def run(fn, **kwargs):
        with django_capture_on_commit_callbacks(execute=True):
            return fn(**kwargs)

    return run


@pytest.fixture
def root(staff_user, capture):
    comment = capture(
        services.post_comment, user=staff_user, target_type="tool", slug=TOOL, body="Root"
    )
    mail.outbox.clear()
    return comment


def _to(address):
    return [message for message in mail.outbox if address in message.to]


def test_a_comment_waiting_for_review_tells_staff(user, staff_user, capture):
    capture(services.post_comment, user=user, target_type="tool", slug=TOOL, body="Is it fast?")

    (notice,) = _to("staff@example.com")
    assert notice.subject == "Comment to review on PDF Redaction"
    assert "Is it fast?" in notice.body
    assert "/staff/comments" in notice.body


def test_a_published_comment_does_not_trouble_staff(user, staff_user, capture):
    CommentSettings.objects.filter(pk=1).update(auto_approve=True)

    capture(services.post_comment, user=user, target_type="tool", slug=TOOL, body="Hi")

    assert _to("staff@example.com") == []


def test_a_published_reply_tells_the_author_it_answers(user, root, capture):
    CommentSettings.objects.filter(pk=1).update(auto_approve=True)

    capture(
        services.post_comment,
        user=user,
        target_type="tool",
        slug=TOOL,
        body="Thanks",
        parent_id=root.pk,
    )

    (notice,) = _to("staff@example.com")
    assert notice.subject == "Test User replied to your comment on PDF Redaction"
    assert "Thanks" in notice.body
    assert f"/tool/{TOOL}#comment-" in notice.body


def test_a_reply_waiting_for_review_tells_nobody_but_staff(user, root, capture):
    capture(
        services.post_comment,
        user=user,
        target_type="tool",
        slug=TOOL,
        body="Thanks",
        parent_id=root.pk,
    )

    assert [message.subject for message in mail.outbox] == ["Comment to review on PDF Redaction"]


def test_approving_a_reply_tells_the_author_it_answers(user, staff_user, root, capture):
    reply = services.post_comment(
        user=user, target_type="tool", slug=TOOL, body="Thanks", parent_id=root.pk
    )

    capture(staff.review_comment, user=staff_user, comment_id=reply.pk, status="published")

    assert [message.subject for message in _to("staff@example.com")] == [
        "Test User replied to your comment on PDF Redaction"
    ]


def test_replying_to_yourself_sends_nothing(staff_user, root, capture):
    capture(
        services.post_comment,
        user=staff_user,
        target_type="tool",
        slug=TOOL,
        body="Also",
        parent_id=root.pk,
    )

    assert mail.outbox == []


def test_a_reply_on_a_blog_post_links_to_the_post(user, capture):
    author = get_user_model().objects.create_user(
        email="author@example.com", name="Author", is_staff=True
    )
    root = services.post_comment(
        user=author, target_type="blog", slug="introducing-redaction-tools", body="Root"
    )
    CommentSettings.objects.filter(pk=1).update(auto_approve=True)

    capture(
        services.post_comment,
        user=user,
        target_type="blog",
        slug="introducing-redaction-tools",
        body="Re",
        parent_id=root.pk,
    )

    (notice,) = _to("author@example.com")
    assert "/blog/introducing-redaction-tools#comment-" in notice.body


def test_an_edit_that_sends_a_comment_back_to_review_tells_staff(user, staff_user, capture):
    comment = services.post_comment(user=user, target_type="tool", slug=TOOL, body="Fine")
    staff.review_comment(user=staff_user, comment_id=comment.pk, status="published")

    capture(services.edit_comment, user=user, comment_id=comment.pk, body="Buy pills")

    assert [message.subject for message in _to("staff@example.com")] == [
        "Comment to review on PDF Redaction"
    ]
