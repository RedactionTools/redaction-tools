"""The staff HTTP surface for comments: the moderation queue and the page's inline controls.

Every route is a thin wrapper over `apps.comments.staff`, the module the MCP
server also calls. Nothing here writes to the ORM.
"""

from django.http import HttpRequest
from ninja import Router

from apps.accounts.api import StaffJWTAuth
from apps.comments import staff
from apps.comments.schemas import (
    CommentSettingsIn,
    CommentSettingsOut,
    StaffCommentOut,
    StaffCommentPageOut,
    StaffCommentReviewIn,
)

router = Router(tags=["comments-staff"], auth=StaffJWTAuth())


@router.get("/", response=StaffCommentPageOut, summary="Comments across the site, newest first")
def staff_list_comments(
    request: HttpRequest,
    status: str | None = None,
    target_type: str | None = None,
    slug: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    return staff.list_comments(
        status=status,
        target_type=target_type,
        slug=slug,
        limit=max(1, min(limit, 100)),
        offset=max(0, offset),
    )


@router.post("/{comment_id}/review", response=StaffCommentOut, summary="Publish, reject or remove")
def staff_review_comment(request: HttpRequest, comment_id: int, payload: StaffCommentReviewIn):
    return staff.review_comment(
        user=request.auth, comment_id=comment_id, status=payload.status, note=payload.note
    )


@router.get("/settings", response=CommentSettingsOut, summary="How new comments are moderated")
def staff_get_comment_settings(request: HttpRequest):
    return staff.get_settings()


@router.patch("/settings", response=CommentSettingsOut, summary="Switch auto-approve")
def staff_update_comment_settings(request: HttpRequest, payload: CommentSettingsIn):
    return staff.update_settings(
        user=request.auth,
        auto_approve=payload.auto_approve,
        trusted_after=payload.trusted_after,
    )
