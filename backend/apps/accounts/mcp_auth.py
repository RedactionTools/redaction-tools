"""Who may reach the MCP server.

Two credentials, one gate. OAuth is what claude.ai's connector flow mints; a
static bearer token is what a terminal, the MCP Inspector and CI use. Both land
on the same check, because the authorisation rule is not "which credential" but
"is this a member of staff".
"""

from http import HTTPStatus

from django.http import HttpRequest, HttpResponse, JsonResponse
from django_mcpz.bearer_tokens.auth import token_auth
from django_mcpz.oauth.auth import oauth_auth


def staff_auth(request: HttpRequest) -> HttpResponse | None:
    """Accept with `None`, reject with a response. Sets `request.user`."""
    rejection = oauth_auth(request)
    if rejection is not None and token_auth(request) is not None:
        # OAuth's rejection rather than the token backend's: its
        # WWW-Authenticate header carries the resource-metadata URL, which is
        # how an unconfigured connector discovers where to authorise.
        return rejection

    if not request.user.is_staff:
        # 403, not 401: the credential is valid and presenting it again will not
        # help. A 401 here would send a connector round the authorisation loop
        # forever, being told each time to sign in as the user it already is.
        return JsonResponse(
            {"error": "forbidden", "error_description": "This MCP server is staff only."},
            status=HTTPStatus.FORBIDDEN,
        )
    return None


def is_staff(request: HttpRequest) -> bool:
    """Per-tool permission, and deliberately a second check.

    `staff_auth` already refuses everyone else, so this is redundant today. It
    stops being redundant the moment that gate is loosened to let some read-only
    surface through, which is exactly when a forgotten write tool would leak.
    """
    return bool(getattr(request.user, "is_staff", False))
