"""Comment moderation, as plain functions.

The one module the staff HTTP routes and the MCP tools both call, so the rules
live in one place and every decision records who made it. Imports neither ninja
nor MCP; refusals are `StaffError`, which each surface turns into its own error.
"""

from django.db import transaction
from django.utils import timezone

from apps.catalog.staff import StaffError
from apps.comments import emails, services
from apps.comments.models import Comment, CommentSettings, CommentStatus

# A review decides; it never sends a comment back to waiting.
REVIEW_STATUSES = (CommentStatus.PUBLISHED, CommentStatus.REJECTED, CommentStatus.REMOVED)


def _row(comment):
    """A comment as a moderator sees it: the text and the page it is on, at any status."""
    return services.serialize(comment) | {
        "target_type": comment.target_type,
        "target_slug": comment.target_slug,
        "target_title": comment.tool.name if comment.tool_id else comment.blog_slug,
        "parent_body": comment.parent.body if comment.parent_id else None,
        "review_note": comment.review_note,
    }


def list_comments(*, status=None, target_type=None, slug=None, limit=50, offset=0):
    """Comments across the site, newest first. Filter to `pending` for the queue."""
    comments = Comment.objects.select_related("author", "tool", "parent").order_by(
        "-created_at", "-id"
    )
    if status is not None:
        if status not in CommentStatus.values:
            raise StaffError(f"status must be one of: {', '.join(CommentStatus.values)}.")
        comments = comments.filter(status=status)
    if target_type is not None and slug is not None:
        if target_type == "tool":
            comments = comments.filter(tool__slug=slug)
        else:
            comments = comments.filter(tool__isnull=True, blog_slug=slug)
    return {
        "count": comments.count(),
        "items": [_row(comment) for comment in comments[offset : offset + limit]],
    }


@transaction.atomic
def review_comment(*, user, comment_id, status, note=""):
    """Publish, reject or remove one comment, recording who decided."""
    if status not in REVIEW_STATUSES:
        raise StaffError(f"status must be one of: {', '.join(REVIEW_STATUSES)}.")
    comment = (
        Comment.objects.select_for_update(of=("self",))
        .select_related("author", "tool", "parent")
        .filter(pk=comment_id)
        .first()
    )
    if comment is None:
        raise StaffError(f"No comment with id {comment_id}.")
    # Only a first publication is news to the author it answers.
    if comment.status == CommentStatus.PENDING and status == CommentStatus.PUBLISHED:
        emails.queue_reply_notice(comment)
    comment.status = status
    comment.review_note = note
    comment.reviewed_by = user
    comment.reviewed_at = timezone.now()
    comment.save(
        update_fields=["status", "review_note", "reviewed_by", "reviewed_at", "updated_at"]
    )
    return _row(comment)


def _settings(config):
    return {"auto_approve": config.auto_approve, "trusted_after": config.trusted_after}


def get_settings():
    return _settings(CommentSettings.load())


def update_settings(*, user, auto_approve=None, trusted_after=None):
    """Switch auto-approve, or move the trust threshold. Unpassed fields stay."""
    config = CommentSettings.load()
    if auto_approve is not None:
        config.auto_approve = auto_approve
    if trusted_after is not None:
        if trusted_after < 0:
            raise StaffError("trusted_after must be 0 (off) or more.")
        config.trusted_after = trusted_after
    config.updated_by = user
    config.save()
    return _settings(config)
