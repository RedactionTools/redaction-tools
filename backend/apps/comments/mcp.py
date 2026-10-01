"""The staff comment-moderation MCP tools.

Thin, like `apps.catalog.mcp`: each tool is a typed signature over a function
in `apps.comments.staff`, which holds the rules and knows nothing about MCP.
"""

import contextlib
from datetime import datetime
from typing import Annotated
from uuid import UUID

import msgspec
from django_mcpz.server import ToolError
from msgspec import UNSET, Meta, Struct, UnsetType

from apps.accounts.mcp_auth import is_staff
from apps.comments import staff


@contextlib.contextmanager
def _as_tool_error():
    try:
        yield
    except staff.StaffError as exc:
        raise ToolError(str(exc)) from exc


class ListCommentsParams(Struct):
    status: Annotated[
        str | UnsetType,
        Meta(description="pending, published, rejected or removed. Pending is the queue."),
    ] = UNSET
    target_type: Annotated[
        str | UnsetType, Meta(description="'tool' or 'blog', together with slug.")
    ] = UNSET
    slug: Annotated[
        str | UnsetType, Meta(description="The tool's catalog slug or the blog post's slug.")
    ] = UNSET
    limit: Annotated[int, Meta(ge=1, le=100)] = 20
    offset: Annotated[int, Meta(ge=0)] = 0


class CommentAuthor(Struct):
    id: UUID
    name: str
    is_staff: bool
    is_vendor: bool


class CommentRow(Struct):
    id: int
    parent_id: int | None
    depth: int
    status: str
    body: str | None
    author: CommentAuthor | None
    created_at: datetime
    edited_at: datetime | None
    target_type: str
    target_slug: str
    target_title: str
    parent_body: Annotated[str | None, Meta(description="What a reply answers.")]
    review_note: str


class CommentPage(Struct):
    count: Annotated[int, Meta(description="The whole filtered set, not this page.")]
    items: list[CommentRow]


class ReviewCommentParams(Struct):
    comment_id: Annotated[int, Meta(description="From comments_list.")]
    status: Annotated[str, Meta(description="published, rejected or removed.")]
    note: Annotated[str, Meta(description="Why, for the record. Not shown to the author.")] = ""


class NoParams(Struct):
    pass


class CommentSettings(Struct):
    auto_approve: Annotated[bool, Meta(description="Every new comment publishes unreviewed.")]
    trusted_after: Annotated[
        int, Meta(description="Published comments after which an account skips review; 0 is off.")
    ]


class SetCommentSettingsParams(Struct):
    auto_approve: bool | UnsetType = UNSET
    trusted_after: Annotated[int, Meta(ge=0)] | UnsetType = UNSET


def _passed(value):
    return None if value is UNSET else value


def register(server):
    """Attach the staff comment tools to `server`."""

    @server.tool(
        description=(
            "List reader comments across tool pages and blog posts, newest first. "
            "Pass status='pending' for the moderation queue. Each row carries the "
            "page it is on and, for a reply, the text it answers."
        ),
        read_only=True,
        idempotent=True,
        open_world=False,
        permission=is_staff,
    )
    def comments_list(request, params: ListCommentsParams) -> CommentPage:
        with _as_tool_error():
            return msgspec.convert(
                staff.list_comments(
                    status=_passed(params.status),
                    target_type=_passed(params.target_type),
                    slug=_passed(params.slug),
                    limit=params.limit,
                    offset=params.offset,
                ),
                CommentPage,
            )

    @server.tool(
        description=(
            "Publish, reject or remove one comment. Publishing a reply emails the "
            "author of the comment it answers. Removing keeps the text for the "
            "record but takes it off the page."
        ),
        read_only=False,
        destructive=True,
        idempotent=True,
        open_world=False,
        permission=is_staff,
    )
    def comments_review(request, params: ReviewCommentParams) -> CommentRow:
        with _as_tool_error():
            return msgspec.convert(
                staff.review_comment(
                    user=request.user,
                    comment_id=params.comment_id,
                    status=params.status,
                    note=params.note,
                ),
                CommentRow,
            )

    @server.tool(
        description="Read how new comments are moderated: auto-approve and the trust threshold.",
        read_only=True,
        idempotent=True,
        open_world=False,
        permission=is_staff,
    )
    def comments_get_settings(request, params: NoParams) -> CommentSettings:
        return msgspec.convert(staff.get_settings(), CommentSettings)

    @server.tool(
        description=(
            "Switch auto-approve, or change how many published comments make an "
            "account trusted (0 turns trust off). Fields not passed are unchanged."
        ),
        read_only=False,
        idempotent=True,
        open_world=False,
        permission=is_staff,
    )
    def comments_set_settings(request, params: SetCommentSettingsParams) -> CommentSettings:
        with _as_tool_error():
            return msgspec.convert(
                staff.update_settings(
                    user=request.user,
                    auto_approve=_passed(params.auto_approve),
                    trusted_after=_passed(params.trusted_after),
                ),
                CommentSettings,
            )
