"""Hands allauth's headless API our JWTs instead of bare session tokens.

Wired in through `HEADLESS_TOKEN_STRATEGY`. Session tokens are still produced by
the inherited `SessionTokenStrategy` - allauth needs them to carry multi-step
flows (signup continuation, e-mail verification, future MFA) - but any response
that completes authentication also carries an `access_token`/`refresh_token`
pair under `meta`, which is what the Next.js frontend sends to `/api/`.
"""

from allauth.headless.tokens.strategies.sessions import SessionTokenStrategy
from django.http import HttpRequest

from . import jwt


class JWTTokenStrategy(SessionTokenStrategy):
    def create_access_token(self, request: HttpRequest) -> str | None:
        if not request.user.is_authenticated:
            return None
        return jwt.encode_access_token(request.user)

    def create_access_token_payload(self, request: HttpRequest) -> dict | None:
        if not request.user.is_authenticated:
            return None
        return jwt.issue_token_pair(request.user)

    def refresh_token(self, refresh_token: str) -> tuple[str, str] | None:
        """Back `POST /_allauth/app/v1/tokens/refresh`.

        Refresh tokens are rotated: the caller always gets a fresh pair.
        """
        try:
            user = jwt.authenticate_token(refresh_token, jwt.REFRESH_TOKEN_TYPE)
        except jwt.TokenError:
            return None
        return jwt.encode_access_token(user), jwt.encode_refresh_token(user)
