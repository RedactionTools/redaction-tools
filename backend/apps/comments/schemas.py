"""Request and response schemas for the comment API.

Declared rather than left as dicts because `openapi.json` is what Orval turns
into the typed frontend client.
"""

from datetime import datetime
from uuid import UUID

from ninja import Field, Schema


class CommentAuthorOut(Schema):
    id: UUID
    name: str
    is_staff: bool
    is_vendor: bool


class CommentOut(Schema):
    id: int
    parent_id: int | None
    depth: int
    status: str
    body: str | None = Field(description="Null on a placeholder for a comment that has gone.")
    author: CommentAuthorOut | None
    created_at: datetime
    edited_at: datetime | None


class CommentIn(Schema):
    target_type: str = Field(description="'tool' or 'blog'.")
    slug: str
    body: str
    parent_id: int | None = None


class CommentEditIn(Schema):
    body: str


class StaffCommentOut(CommentOut):
    target_type: str
    target_slug: str
    target_title: str
    parent_body: str | None
    review_note: str


class StaffCommentPageOut(Schema):
    count: int = Field(description="The whole filtered set, not this page.")
    items: list[StaffCommentOut]


class StaffCommentReviewIn(Schema):
    status: str = Field(description="'published', 'rejected' or 'removed'.")
    note: str = ""


class CommentSettingsOut(Schema):
    auto_approve: bool
    trusted_after: int


class CommentSettingsIn(Schema):
    auto_approve: bool | None = None
    trusted_after: int | None = None
