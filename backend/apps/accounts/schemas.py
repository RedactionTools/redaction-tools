from datetime import datetime
from uuid import UUID

from ninja import Field, Schema


class UserSchema(Schema):
    id: UUID
    email: str
    name: str
    is_staff: bool


class ApiKeyIn(Schema):
    #: Where the key will live - "laptop", "CI" - so a list of keys can be told apart.
    label: str = Field(min_length=1, max_length=40)


class ApiKeyOut(Schema):
    prefix: str
    label: str
    created_at: datetime
    expires_at: datetime | None
    revoked: bool


class ApiKeyCreatedOut(ApiKeyOut):
    #: `<prefix>.<secret>`, sent as `X-API-Key`. Returned once, never again: only its
    #: hash is stored.
    key: str


class CliLoginIn(Schema):
    #: Shown to the person approving, and used to label the key: the machine's name.
    client_name: str = Field(min_length=1, max_length=80)


class CliLoginStartOut(Schema):
    device_code: str
    user_code: str
    verification_url: str
    verification_url_complete: str
    expires_in: int
    interval: int


class CliLoginOut(Schema):
    user_code: str
    client_name: str
    status: str
    expires_at: datetime


class CliLoginTokenIn(Schema):
    device_code: str


class CliLoginUserOut(Schema):
    name: str
    email: str


class CliLoginTokenOut(Schema):
    #: pending | approved | denied | expired | consumed
    status: str
    #: Only with `approved`, and only on that one response.
    key: str | None = None
    user: CliLoginUserOut | None = None
