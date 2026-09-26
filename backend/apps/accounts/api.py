"""API-side authentication: the bearer token scheme and the `/auth` router.

Obtaining tokens is allauth's job (`/_allauth/app/v1/...`, including
`auth/tokens/refresh`); this module only consumes them.
"""

from django.conf import settings
from django.http import HttpRequest
from ninja import Router, Status
from ninja.errors import HttpError
from ninja.security import HttpBearer
from ninja.throttling import AnonRateThrottle
from ninja_apikey.models import APIKey
from ninja_apikey.security import APIKeyAuth, generate_key

from . import cli_login, jwt
from .schemas import (
    ApiKeyCreatedOut,
    ApiKeyIn,
    ApiKeyOut,
    CliLoginIn,
    CliLoginOut,
    CliLoginStartOut,
    CliLoginTokenIn,
    CliLoginTokenOut,
    UserSchema,
)

router = Router(tags=["auth"])


class JWTAuth(HttpBearer):
    """Resolves `Authorization: Bearer <access token>` to a user."""

    def authenticate(self, request: HttpRequest, token: str):
        try:
            user = jwt.authenticate_token(token, jwt.ACCESS_TOKEN_TYPE)
        except jwt.TokenError:
            return None
        request.user = user
        return user


class StaffJWTAuth(JWTAuth):
    """The same bearer, admitted only for staff.

    A good token on a non-staff account is refused with 403 rather than
    returned as `None`: ninja would turn that into a 401, and a 401 sends the
    frontend off to refresh a token that was never the problem.
    """

    def authenticate(self, request: HttpRequest, token: str):
        user = super().authenticate(request, token)
        if user is not None and not user.is_staff:
            raise HttpError(403, "Staff only.")
        return user


@router.get("/me", response=UserSchema, auth=JWTAuth(), summary="Current user")
def get_me(request: HttpRequest):
    """Echo back the user the bearer token belongs to."""
    return request.auth


# --- API keys ----------------------------------------------------------------------
# For machines acting as a user - today the pdfredeval CLI publishing benchmark
# results. Managed with the bearer token only: a key must not be able to mint more of
# itself, or one leaked from a CI log could multiply before anyone revoked it.


def _key_out(key):
    return {
        "prefix": key.prefix,
        "label": key.label,
        "created_at": key.created_at,
        "expires_at": key.expires_at,
        "revoked": key.revoked,
    }


@router.get("/api-keys", response=list[ApiKeyOut], auth=JWTAuth(), summary="Your API keys")
def list_my_api_keys(request: HttpRequest):
    return [_key_out(key) for key in APIKey.objects.filter(user=request.auth)]


@router.post(
    "/api-keys", response={201: ApiKeyCreatedOut}, auth=JWTAuth(), summary="Create an API key"
)
def create_api_key(request: HttpRequest, payload: ApiKeyIn):
    live = APIKey.objects.filter(user=request.auth, revoked=False).count()
    if live >= settings.MAX_API_KEYS_PER_USER:
        raise HttpError(409, f"You already hold {live} API keys. Revoke one to add another.")
    generated = generate_key()
    key = APIKey.objects.create(
        prefix=generated.prefix,
        hashed_key=generated.hashed_key,
        user=request.auth,
        label=payload.label.strip(),
    )
    return Status(201, {**_key_out(key), "key": f"{generated.prefix}.{generated.key}"})


@router.delete(
    "/api-keys/{prefix}", response={204: None}, auth=JWTAuth(), summary="Revoke an API key"
)
def revoke_api_key(request: HttpRequest, prefix: str):
    """Revoked rather than deleted, so the list still shows what was once issued."""
    updated = APIKey.objects.filter(user=request.auth, prefix=prefix).update(revoked=True)
    if not updated:
        raise HttpError(404, "No API key of yours with that prefix.")
    return Status(204, None)


@router.post(
    "/api-keys/current/revoke",
    response={204: None},
    auth=APIKeyAuth(),
    summary="Revoke the API key this request is made with",
)
def revoke_current_api_key(request: HttpRequest):
    """`pdfredeval logout`. A key may end itself - never mint or touch another."""
    prefix = request.headers.get("X-API-Key", "").split(".", 1)[0]
    APIKey.objects.filter(user=request.auth, prefix=prefix).update(revoked=True)
    return Status(204, None)


# --- pdfredeval login ------------------------------------------------------------
# A device-code sign-in: see apps/accounts/cli_login.py.


class CliLoginStartThrottle(AnonRateThrottle):
    """Per IP: opening a login needs no account, so this is its only limit."""

    scope = "cli_login_start"

    def __init__(self):
        super().__init__(settings.CLI_LOGIN_START_RATE)


def _cli_error(exc):
    return HttpError(exc.status, str(exc))


def _cli_login_out(login):
    return {
        "user_code": login.user_code,
        "client_name": login.client_name,
        "status": "expired" if login.expired and login.status == "pending" else login.status,
        "expires_at": login.expires_at,
    }


@router.post(
    "/cli-logins",
    response={201: CliLoginStartOut},
    throttle=[CliLoginStartThrottle()],
    summary="Start a pdfredeval sign-in",
)
def start_cli_login(request: HttpRequest, payload: CliLoginIn):
    login, device_code = cli_login.start(payload.client_name)
    url = cli_login.verification_url()
    return Status(
        201,
        {
            "device_code": device_code,
            "user_code": login.user_code,
            "verification_url": url,
            "verification_url_complete": f"{url}?code={login.user_code}",
            "expires_in": int(cli_login.LIFETIME.total_seconds()),
            "interval": cli_login.POLL_INTERVAL_SECONDS,
        },
    )


@router.post(
    "/cli-logins/token",
    response=CliLoginTokenOut,
    exclude_none=True,
    summary="Poll a pdfredeval sign-in",
)
def poll_cli_login(request: HttpRequest, payload: CliLoginTokenIn):
    try:
        return cli_login.redeem(payload.device_code)
    except cli_login.CliLoginError as exc:
        raise _cli_error(exc) from exc


@router.get(
    "/cli-logins/{user_code}",
    response=CliLoginOut,
    auth=JWTAuth(),
    summary="A pdfredeval sign-in awaiting your approval",
)
def get_cli_login(request: HttpRequest, user_code: str):
    try:
        return _cli_login_out(cli_login.find(user_code))
    except cli_login.CliLoginError as exc:
        raise _cli_error(exc) from exc


@router.post(
    "/cli-logins/{user_code}/approve",
    response=CliLoginOut,
    auth=JWTAuth(),
    summary="Approve a pdfredeval sign-in",
)
def approve_cli_login(request: HttpRequest, user_code: str):
    try:
        return _cli_login_out(cli_login.decide(user_code, user=request.auth, approve=True))
    except cli_login.CliLoginError as exc:
        raise _cli_error(exc) from exc


@router.post(
    "/cli-logins/{user_code}/deny",
    response=CliLoginOut,
    auth=JWTAuth(),
    summary="Deny a pdfredeval sign-in",
)
def deny_cli_login(request: HttpRequest, user_code: str):
    try:
        return _cli_login_out(cli_login.decide(user_code, user=request.auth, approve=False))
    except cli_login.CliLoginError as exc:
        raise _cli_error(exc) from exc
