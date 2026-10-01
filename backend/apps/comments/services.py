"""What a reader may do with comments, as plain functions.

Imports neither ninja nor MCP and takes `user` explicitly, like
`apps.catalog.staff`, so the HTTP routes only translate. `initial_status` is the
single place that decides whether a comment skips review.
"""

import re

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.catalog.models import Tool, ToolClaimStatus
from apps.catalog.staff import StaffError
from apps.comments import emails
from apps.comments.models import Comment, CommentSettings, CommentStatus, CommentTarget

# The shape of a blog filename. The backend cannot see the MDX, so the format is
# all it checks; a comment on a slug with no post simply never renders.
BLOG_SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


class CommentError(StaffError):
    """A write refused for a reason the commenter can act on: a 422 `detail`."""


class CommentNotFound(CommentError):
    """No such comment or page - or none this account may touch. A 404."""


def initial_status(user):
    """Published or pending: whether this account's next comment skips review."""
    if user.is_staff:
        return CommentStatus.PUBLISHED
    config = CommentSettings.load()
    if config.auto_approve:
        return CommentStatus.PUBLISHED
    if config.trusted_after and (
        Comment.objects.filter(author=user, status=CommentStatus.PUBLISHED).count()
        >= config.trusted_after
    ):
        return CommentStatus.PUBLISHED
    return CommentStatus.PENDING


def resolve_target(target_type, slug):
    """`{"tool": ...}` or `{"blog_slug": ...}`, the fields that pin a comment to its page.

    A tool must pass `is_listable()`, the same gate as its public page: a draft
    is a row, not a page, and has nowhere to show a comment.
    """
    if target_type == CommentTarget.TOOL:
        tool = Tool.objects.filter(slug=slug).first()
        if tool is None or not tool.is_listable():
            raise CommentNotFound(f"No tool page {slug!r}.")
        return {"tool": tool}
    if target_type == CommentTarget.BLOG:
        if len(slug) > 120 or not BLOG_SLUG.fullmatch(slug):
            raise CommentError(f"{slug!r} is not a blog post slug.")
        return {"blog_slug": slug}
    raise CommentError(f"target_type must be one of: {', '.join(CommentTarget.values)}.")


def _clean_body(body):
    body = body.strip()
    if not body:
        raise CommentError("A comment cannot be empty.")
    if len(body) > settings.COMMENTS_MAX_LENGTH:
        raise CommentError(f"A comment can be at most {settings.COMMENTS_MAX_LENGTH} characters.")
    return body


def _parent(parent_id, target):
    parent = Comment.objects.filter(pk=parent_id, status=CommentStatus.PUBLISHED).first()
    if parent is None:
        raise CommentError("You can only reply to a published comment.")
    if (parent.tool, parent.blog_slug) != (target.get("tool"), target.get("blog_slug", "")):
        raise CommentError("A reply must be on the same page as the comment it answers.")
    if parent.depth >= settings.COMMENTS_MAX_DEPTH:
        raise CommentError("This thread is as deep as it goes. Reply further up instead.")
    return parent


@transaction.atomic
def post_comment(*, user, target_type, slug, body, parent_id=None):
    target = resolve_target(target_type, slug)
    body = _clean_body(body)
    parent = _parent(parent_id, target) if parent_id is not None else None
    status = initial_status(user)
    if status == CommentStatus.PENDING and (
        Comment.objects.filter(author=user, status=CommentStatus.PENDING).count()
        >= settings.COMMENTS_MAX_PENDING
    ):
        raise CommentError(
            "You have several comments waiting for review. "
            "Please wait until they are looked at before posting more."
        )
    comment = Comment.objects.create(
        **target,
        parent=parent,
        depth=parent.depth + 1 if parent else 0,
        author=user,
        body=body,
        status=status,
    )
    if status == CommentStatus.PENDING:
        emails.queue_pending_notice(comment)
    else:
        emails.queue_reply_notice(comment)
    return comment


def _own(user, comment_id):
    comment = Comment.objects.filter(pk=comment_id, author=user).first()
    if comment is None:
        raise CommentNotFound(f"No comment {comment_id} of yours.")
    return comment


@transaction.atomic
def edit_comment(*, user, comment_id, body):
    """Change the text and decide again whether it needs review.

    Re-running `initial_status` is what stops a comment being approved for one
    text and then edited into another.
    """
    comment = _own(user, comment_id)
    if comment.status in (CommentStatus.REJECTED, CommentStatus.REMOVED):
        raise CommentError(f"A {comment.status} comment cannot be edited.")
    was = comment.status
    comment.body = _clean_body(body)
    comment.status = initial_status(user)
    comment.edited_at = timezone.now()
    comment.save(update_fields=["body", "status", "edited_at", "updated_at"])
    if was == CommentStatus.PUBLISHED and comment.status == CommentStatus.PENDING:
        emails.queue_pending_notice(comment)
    return comment


def delete_own_comment(*, user, comment_id):
    """Blank the comment. The row stays so the replies under it keep their place."""
    comment = _own(user, comment_id)
    comment.status = CommentStatus.REMOVED
    comment.body = ""
    comment.save(update_fields=["status", "body", "updated_at"])
    return comment


# --- Reading -------------------------------------------------------------------


def _author(user, vendor_ids):
    """The public face of an account: a name, never the email `str(user)` would give."""
    return {
        "id": user.pk,
        "name": user.name or "Member",
        "is_staff": user.is_staff,
        "is_vendor": user.pk in vendor_ids,
    }


def _vendor_ids(target):
    """Accounts holding an approved claim on the tool: its vendor, speaking for it."""
    if "tool" not in target:
        return set()
    return set(
        target["tool"]
        .claims.filter(status=ToolClaimStatus.APPROVED)
        .values_list("user_id", flat=True)
    )


def serialize(comment, vendor_ids=frozenset()):
    return {
        "id": comment.pk,
        "parent_id": comment.parent_id,
        "depth": comment.depth,
        "status": comment.status,
        "body": comment.body,
        "author": _author(comment.author, vendor_ids),
        "created_at": comment.created_at,
        "edited_at": comment.edited_at,
    }


def _placeholder(comment):
    """A comment that is no longer shown but still has a published reply under it."""
    return serialize(comment) | {"body": None, "author": None, "edited_at": None}


def public_thread(*, target_type, slug):
    """Every published comment on a page, flat and oldest first, for the client to nest.

    A comment that has left the page (removed, rejected, or edited back into
    review) but still has a published reply below it stays as a blank
    placeholder, so the replies are not orphaned.
    """
    target = resolve_target(target_type, slug)
    comments = list(Comment.objects.filter(**target).select_related("author"))
    by_id = {comment.pk: comment for comment in comments}
    shown = set()
    for comment in comments:
        if comment.status != CommentStatus.PUBLISHED:
            continue
        node = comment
        while node is not None and node.pk not in shown:
            shown.add(node.pk)
            node = by_id.get(node.parent_id)
    vendor_ids = _vendor_ids(target)
    return [
        serialize(comment, vendor_ids)
        if comment.status == CommentStatus.PUBLISHED
        else _placeholder(comment)
        for comment in comments
        if comment.pk in shown
    ]


def my_pending(*, user, target_type, slug):
    """This account's comments on a page that are still waiting for review."""
    target = resolve_target(target_type, slug)
    vendor_ids = _vendor_ids(target)
    return [
        serialize(comment, vendor_ids)
        for comment in Comment.objects.filter(
            **target, author=user, status=CommentStatus.PENDING
        ).select_related("author")
    ]
