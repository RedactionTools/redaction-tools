"""Mail about comments.

Staff hear when a comment is waiting for review. An author hears when a reply
to their comment is published - on posting, or on approval - but never about
their own reply to themselves.

Every email is its own task, queued once the comment commits: the request never
waits on the mail provider, and a retry resends one email, not its siblings.
"""

from django.conf import settings
from django.db import transaction

from apps.comments.models import Comment, CommentTarget
from apps.core.email import send_templated_email, staff_addresses

# Enough of a comment to decide from the inbox; the page has the rest.
EXCERPT_CHARS = 500


def queue_pending_notice(comment):
    _queue(comment, "send_pending_notice")


def queue_reply_notice(comment):
    if comment.parent_id is None or comment.parent.author_id == comment.author_id:
        return
    _queue(comment, "send_reply_notice")


def _queue(comment, task):
    from django_q.tasks import async_task

    transaction.on_commit(
        lambda: async_task(
            f"apps.comments.emails.{task}",
            comment.pk,
            task_name=f"comment {task} {comment.pk}"[:100],
        )
    )


def send_pending_notice(comment_pk):
    staff = staff_addresses()
    if not staff:
        return
    comment = _load(comment_pk)
    send_templated_email(
        "comment_staff_notice",
        {**_context(comment), "queue_url": f"{settings.FRONTEND_URL}/staff/comments"},
        to=staff,
    )


def send_reply_notice(comment_pk):
    comment = _load(comment_pk)
    send_templated_email(
        "comment_reply",
        {**_context(comment), "parent_excerpt": comment.parent.body[:EXCERPT_CHARS]},
        to=[comment.parent.author.email],
    )


def _load(comment_pk):
    return Comment.objects.select_related("author", "tool", "parent__author").get(pk=comment_pk)


def _context(comment):
    if comment.target_type == CommentTarget.TOOL:
        title, path = comment.tool.name, f"/tool/{comment.tool.slug}"
    else:
        title, path = _blog_title(comment.blog_slug), f"/blog/{comment.blog_slug}"
    return {
        "author_name": comment.author.name or "Member",
        "page_title": title,
        "comment_excerpt": comment.body[:EXCERPT_CHARS],
        "comment_url": f"{settings.FRONTEND_URL}{path}#comment-{comment.pk}",
    }


def _blog_title(slug):
    """The backend cannot read the MDX, so a post is titled from its slug."""
    return slug.replace("-", " ").capitalize()
