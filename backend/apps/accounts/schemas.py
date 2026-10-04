from datetime import datetime
from typing import Literal
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


class McpAuthorizationParams(Schema):
    """An OAuth authorization request, passed through from the consent page's URL.

    All optional: checking them is the service's job, so a missing one is reported
    the way OAuth says rather than as a 422.
    """

    client_id: str = ""
    redirect_uri: str | None = None
    response_type: str | None = None
    code_challenge: str | None = None
    code_challenge_method: str | None = None
    resource: str | None = None
    scope: str | None = None
    state: str | None = None


class McpAuthorizationOut(Schema):
    client_name: str
    redirect_uri: str
    redirect_host: str
    #: The redirect stays on the asker's own machine - a terminal client like Claude Code.
    redirect_is_local: bool
    server_title: str
    resource: str
    scope: str
    #: When set, the request was malformed: send the browser straight here, no consent.
    redirect_url: str | None


class McpAuthorizationDecisionIn(Schema):
    params: McpAuthorizationParams
    decision: Literal["allow", "deny"]


class McpAuthorizationDecisionOut(Schema):
    #: The client's redirect URI with the code or the refusal on it. Send the browser there.
    redirect_url: str
