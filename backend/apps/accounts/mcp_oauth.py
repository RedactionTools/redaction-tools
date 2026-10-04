"""The MCP connector's authorize step, moved to the frontend.

django-mcpz stays the authorization server: client registration, the token and
revocation endpoints and the discovery documents are all its. What changes is
where the browser goes. The metadata names `/mcp/authorize` on the frontend,
which signs the visitor in like any other page and asks this module, over the
ordinary bearer, to check the request and issue the code. The Django session
and `/accounts/login/` play no part in it.
"""

import json
from dataclasses import dataclass
from urllib.parse import urlencode, urlsplit

from django.conf import settings
from django.contrib.auth.decorators import login_not_required
from django.http import HttpRequest, HttpResponse, HttpResponseRedirect, JsonResponse
from django.utils import timezone
from django_mcpz import tokens
from django_mcpz.oauth import discovery
from django_mcpz.oauth import views as mcpz_views
from django_mcpz.oauth.conf import LOCAL_HOSTS, oauth_settings
from django_mcpz.oauth.models import AuthorizationCode, Client


def consent_url() -> str:
    return f"{settings.FRONTEND_URL}/mcp/authorize"


@login_not_required
def authorization_server_metadata(request: HttpRequest, issuer_path: str = "") -> HttpResponse:
    """django-mcpz's RFC 8414 document, with the authorize step on the frontend."""
    response = mcpz_views.authorization_server_metadata(request, issuer_path)
    document = json.loads(response.content)
    document["authorization_endpoint"] = consent_url()
    return JsonResponse(document)


@login_not_required
def forward_to_consent(request: HttpRequest) -> HttpResponse:
    """The library's authorize URL, for a client that cached it before the move."""
    query = request.GET.urlencode()
    return HttpResponseRedirect(f"{consent_url()}?{query}" if query else consent_url())


class ConsentError(Exception):
    """The request cannot be sent back to its client, so the visitor is told instead."""


@dataclass
class Consent:
    """A checked authorization request: what the page shows, and where it answers."""

    client: Client
    redirect_uri: str
    resource: str
    scope: str
    code_challenge: str
    state: str | None
    server_title: str
    #: Set when the request is bad in a way the client must hear about: per OAuth 2.1
    #: section 4.1.2.1 that goes back to its redirect URI rather than to the visitor.
    redirect_url: str | None = None

    @property
    def redirect_host(self) -> str:
        return urlsplit(self.redirect_uri).hostname or ""

    @property
    def redirect_is_local(self) -> bool:
        return self.redirect_host in LOCAL_HOSTS

    def answer(self, **fields: str) -> str:
        """The client's redirect URI carrying `fields`, its state and our issuer."""
        query = {"state": self.state} if self.state is not None else {}
        query.update(fields)
        # Not issuer_url(request): the page may reach us over the compose network,
        # and `iss` has to match the issuer the metadata document published.
        query["iss"] = f"{settings.BACKEND_URL}{discovery.issuer_path()}"
        separator = "&" if urlsplit(self.redirect_uri).query else "?"
        return self.redirect_uri + separator + urlencode(query)


def _same_but_port(uri: str, registered: str) -> bool:
    """Whether two loopback URIs differ only by port.

    django-mcpz allows this on 127.0.0.1 and ::1, after OAuth 2.1 section 8.4.2,
    but not on `localhost` - which is what Claude Code registers. It listens on
    whatever port is free, so its second sign-in failed as an unregistered URI.
    """
    try:
        a, b = urlsplit(uri), urlsplit(registered)
    except ValueError:
        return False
    return (
        a.scheme == b.scheme == "http"
        and a.hostname in LOCAL_HOSTS
        and a.hostname == b.hostname
        and (a.path, a.query, a.fragment) == (b.path, b.query, b.fragment)
    )


def resolve_redirect_uri(client: Client, redirect_uri: str | None) -> str:
    if redirect_uri is not None and any(
        _same_but_port(redirect_uri, registered) for registered in client.redirect_uris
    ):
        if len(redirect_uri) > mcpz_views.URL_MAX_LENGTH:
            raise mcpz_views.AuthorizeError("invalid_request", "Unregistered redirect_uri.")
        return redirect_uri
    return mcpz_views.resolve_redirect_uri(client, redirect_uri)


def check(params: dict[str, str]) -> Consent:
    """Validate an authorization request the way django-mcpz's own view does."""
    try:
        client = mcpz_views.load_client(params.get("client_id", ""), fetch=True)
        redirect_uri = resolve_redirect_uri(client, params.get("redirect_uri"))
    except mcpz_views.AuthorizeError as exc:
        raise ConsentError(exc.description) from exc

    consent = Consent(
        client=client,
        redirect_uri=redirect_uri,
        resource=params.get("resource") or "",
        scope=params.get("scope") or "",
        code_challenge=params.get("code_challenge") or "",
        state=params.get("state"),
        server_title="",
    )
    try:
        if params.get("response_type") != "code":
            raise mcpz_views.AuthorizeError("unsupported_response_type", "Use response_type=code.")
        if not mcpz_views.CODE_CHALLENGE_RE.fullmatch(consent.code_challenge):
            raise mcpz_views.AuthorizeError(
                "invalid_request", "Missing or invalid code_challenge (PKCE)."
            )
        if params.get("code_challenge_method") != "S256":
            raise mcpz_views.AuthorizeError("invalid_request", "Use code_challenge_method=S256.")
        consent.resource = mcpz_views.resolve_resource(params.get("resource"))
        if len(consent.scope) > mcpz_views.SCOPE_MAX_LENGTH:
            raise mcpz_views.AuthorizeError("invalid_scope", "scope is too long.")
    except mcpz_views.AuthorizeError as exc:
        consent.redirect_url = consent.answer(error=exc.error, error_description=exc.description)
        return consent

    server = discovery.resolve_mcp_server(urlsplit(consent.resource).path)
    info = server.server_info
    consent.server_title = info.get("title", info["name"])
    return consent


def decide(params: dict[str, str], *, user, allow: bool) -> str:
    """Record the visitor's answer; return where to send the browser with it."""
    consent = check(params)
    if consent.redirect_url is not None:
        return consent.redirect_url
    if not allow:
        return consent.answer(error="access_denied", error_description="The user denied access.")
    value = tokens.generate()
    AuthorizationCode.objects.create(
        digest=tokens.sha256_hex(value),
        client=consent.client,
        user=user,
        redirect_uri=consent.redirect_uri,
        code_challenge=consent.code_challenge,
        resource=consent.resource,
        scope=consent.scope,
        expires_at=timezone.now() + oauth_settings.code_lifetime,
    )
    return consent.answer(code=value)
