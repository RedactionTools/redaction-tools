from datetime import datetime

from ninja import Field, Schema


class PostSubmissionIn(Schema):
    """Limits match the columns. The body's are settings, checked in `services`."""

    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=300)
    body_md: str
    author_name: str = Field(min_length=1, max_length=120)
    tags: list[str] = []
    author_role: str = Field("", max_length=120)
    author_bio: str = Field("", max_length=600)
    author_links: list[str] = []


class PostSubmissionOut(Schema):
    id: int
    title: str
    description: str
    tags: list[str]
    author_name: str
    status: str
    review_note: str
    created_at: datetime
    reviewed_at: datetime | None
