"""API-side authentication: the bearer token scheme and the `/auth` router.

Obtaining tokens is allauth's job (`/_allauth/app/v1/...`, including
`auth/tokens/refresh`); this module only consumes them.
"""

from django.http import HttpRequest
from ninja import Router
from ninja.security import HttpBearer

from . import jwt
from .schemas import UserSchema

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


@router.get("/me", response=UserSchema, auth=JWTAuth(), summary="Current user")
def get_me(request: HttpRequest):
    """Echo back the user the bearer token belongs to."""
    return request.auth
