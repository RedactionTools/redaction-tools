"""Issuing and verifying the JWTs the frontend sends to the API.

Two token types are minted, distinguished by the `typ` claim:

* `access`  - short lived, sent as `Authorization: Bearer <token>` on API calls.
* `refresh` - long lived, exchanged at `POST /_allauth/app/v1/tokens/refresh`
  for a new pair (served by allauth, see tokens.JWTTokenStrategy.refresh_token).

Tokens are stateless: there is no denylist, so a refresh token stays valid until
it expires. Deactivating a user blocks them at the next request because
`authenticate_token()` re-reads `is_active` from the database.
"""

import uuid
from datetime import datetime, timedelta

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"


def _signing_key() -> str:
    return settings.JWT_SIGNING_KEY or settings.SECRET_KEY


class TokenError(Exception):
    """Raised when a token is malformed, expired or not of the expected type."""


def _encode(user, token_type: str, lifetime: timedelta) -> str:
    now = timezone.now()
    payload = {
        "sub": str(user.pk),
        "typ": token_type,
        "jti": uuid.uuid4().hex,
        "iss": settings.JWT_ISSUER,
        "iat": now,
        "exp": now + lifetime,
    }
    return jwt.encode(payload, _signing_key(), algorithm=settings.JWT_ALGORITHM)


def encode_access_token(user) -> str:
    return _encode(user, ACCESS_TOKEN_TYPE, settings.JWT_ACCESS_TOKEN_LIFETIME)


def encode_refresh_token(user) -> str:
    return _encode(user, REFRESH_TOKEN_TYPE, settings.JWT_REFRESH_TOKEN_LIFETIME)


def issue_token_pair(user) -> dict:
    """The payload returned by every endpoint that authenticates a user."""
    return {
        "access_token": encode_access_token(user),
        "refresh_token": encode_refresh_token(user),
        "token_type": "Bearer",
        "expires_in": int(settings.JWT_ACCESS_TOKEN_LIFETIME.total_seconds()),
    }


def decode_token(token: str, expected_type: str) -> dict:
    """Return the claims of `token`, or raise `TokenError`."""
    try:
        claims = jwt.decode(
            token,
            _signing_key(),
            algorithms=[settings.JWT_ALGORITHM],
            issuer=settings.JWT_ISSUER,
            options={"require": ["exp", "iat", "sub", "typ"]},
        )
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc

    if claims.get("typ") != expected_type:
        raise TokenError(f"Expected a {expected_type} token, got {claims.get('typ')!r}")
    return claims


def authenticate_token(token: str, expected_type: str = ACCESS_TOKEN_TYPE):
    """Return the active user `token` belongs to, or raise `TokenError`."""
    claims = decode_token(token, expected_type)
    try:
        user = get_user_model().objects.get(pk=uuid.UUID(claims["sub"]))
    except (get_user_model().DoesNotExist, ValueError) as exc:
        raise TokenError("Token subject no longer exists") from exc

    if not user.is_active:
        raise TokenError("User is inactive")
    return user


def expires_at(claims: dict) -> datetime:
    return datetime.fromtimestamp(claims["exp"], tz=timezone.get_current_timezone())
