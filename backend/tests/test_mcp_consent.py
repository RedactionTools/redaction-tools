"""The MCP connector's consent step, which lives on the frontend.

django-mcpz is still the authorization server - registration, tokens and the
discovery documents are its. Only the authorize step moves: the browser signs in
on the site the way every visitor does, the consent page there calls
`/api/v1/auth/mcp-authorizations` with the ordinary bearer, and the backend
issues the code. The Django session and `/accounts/login/` play no part.
"""

import base64
import hashlib
from urllib.parse import parse_qs, urlsplit

import pytest

pytestmark = pytest.mark.django_db

URL = "/api/v1/auth/mcp-authorizations"
VERIFIER = "v" * 64
CHALLENGE = (
    base64.urlsafe_b64encode(hashlib.sha256(VERIFIER.encode()).digest()).rstrip(b"=").decode()
)
# What Claude Code registers: `localhost`, on whatever port was free that time.
REDIRECT = "http://localhost:51234/callback"


@pytest.fixture
def oauth_client(db):
    from django_mcpz.oauth.models import Client

    return Client.objects.create(client_id="cc", name="Claude Code", redirect_uris=[REDIRECT])


@pytest.fixture
def staff_bearer(staff_user):
    from apps.accounts import jwt

    return {"headers": {"Authorization": f"Bearer {jwt.encode_access_token(staff_user)}"}}


def _params(**overrides):
    params = {
        "client_id": "cc",
        "redirect_uri": REDIRECT,
        "response_type": "code",
        "code_challenge": CHALLENGE,
        "code_challenge_method": "S256",
        "resource": "http://testserver/mcp",
        "state": "xyz",
    }
    params.update(overrides)
    return {key: value for key, value in params.items() if value is not None}


def test_the_metadata_sends_clients_to_the_frontend_to_authorise(client, settings):
    settings.FRONTEND_URL = "https://redaction-tools.com"

    body = client.get("/.well-known/oauth-authorization-server/oauth").json()

    assert body["authorization_endpoint"] == "https://redaction-tools.com/mcp/authorize"
    # Everything a client calls without a browser stays on the backend.
    assert body["token_endpoint"].endswith("/oauth/token")
    assert body["registration_endpoint"].endswith("/oauth/register")


def test_the_old_authorize_url_forwards_to_the_consent_page(client, settings):
    """A client holding the backend URL from before still lands somewhere useful."""
    settings.FRONTEND_URL = "https://redaction-tools.com"

    response = client.get("/oauth/authorize", {"client_id": "abc", "state": "s 1"})

    assert response.status_code == 302
    assert response.url == "https://redaction-tools.com/mcp/authorize?client_id=abc&state=s+1"


def test_staff_see_who_is_asking(client, oauth_client, staff_bearer):
    response = client.get(URL, _params(), **staff_bearer)

    assert response.status_code == 200
    body = response.json()
    assert body["client_name"] == "Claude Code"
    assert body["redirect_host"] == "localhost"
    assert body["redirect_is_local"] is True
    assert body["resource"] == "http://testserver/mcp"
    assert body["redirect_url"] is None


def test_a_non_staff_account_is_refused_before_any_consent(client, oauth_client, bearer):
    # Its token would be refused at /mcp anyway; better to say so on the page.
    assert client.get(URL, _params(), **bearer).status_code == 403


def test_an_anonymous_visitor_is_unauthorised(client, oauth_client):
    assert client.get(URL, _params()).status_code == 401


def test_a_localhost_redirect_may_come_back_on_another_port(client, oauth_client, staff_bearer):
    """Claude Code registers once and listens on whatever port is free next time.

    django-mcpz only lets the port vary on 127.0.0.1 and ::1, which is exactly the
    "Unregistered redirect_uri" a second `/mcp` Authenticate ran into.
    """
    response = client.get(
        URL, _params(redirect_uri="http://localhost:60001/callback"), **staff_bearer
    )

    assert response.status_code == 200
    assert response.json()["redirect_uri"] == "http://localhost:60001/callback"


def test_an_unknown_client_is_explained_to_the_visitor(client, staff_bearer):
    """Not redirected: until the client checks out there is nowhere safe to send it."""
    response = client.get(URL, _params(client_id="nobody"), **staff_bearer)

    assert response.status_code == 400
    assert response.json()["detail"] == "Unknown client_id."


def test_a_malformed_request_goes_back_to_its_client(client, oauth_client, staff_bearer):
    response = client.get(URL, _params(code_challenge_method="plain"), **staff_bearer)

    redirect_url = response.json()["redirect_url"]
    assert redirect_url.startswith(f"{REDIRECT}?state=xyz&error=invalid_request")


def test_allowing_issues_a_code_the_token_endpoint_accepts(
    client, oauth_client, staff_bearer, staff_user, settings
):
    settings.BACKEND_URL = "http://testserver"
    response = client.post(
        URL,
        {"params": _params(), "decision": "allow"},
        content_type="application/json",
        **staff_bearer,
    )

    assert response.status_code == 200
    answer = parse_qs(urlsplit(response.json()["redirect_url"]).query)
    assert answer["state"] == ["xyz"]
    assert answer["iss"] == ["http://testserver/oauth"]
    token = client.post(
        "/oauth/token",
        {
            "grant_type": "authorization_code",
            "code": answer["code"][0],
            "redirect_uri": REDIRECT,
            "client_id": "cc",
            "code_verifier": VERIFIER,
            "resource": "http://testserver/mcp",
        },
    )
    assert token.status_code == 200, token.content
    # And the token it hands out opens the MCP server, as the staff member.
    mcp = client.post(
        "/mcp",
        {"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        content_type="application/json",
        headers={"Authorization": f"Bearer {token.json()['access_token']}"},
    )
    assert mcp.status_code == 200


def test_denying_tells_the_client_so(client, oauth_client, staff_bearer):
    from django_mcpz.oauth.models import AuthorizationCode

    response = client.post(
        URL,
        {"params": _params(), "decision": "deny"},
        content_type="application/json",
        **staff_bearer,
    )

    answer = parse_qs(urlsplit(response.json()["redirect_url"]).query)
    assert answer["error"] == ["access_denied"]
    assert not AuthorizationCode.objects.exists()


def test_the_decision_checks_the_request_again(client, oauth_client, staff_bearer):
    """The page could be handed anything; what it showed proves nothing."""
    response = client.post(
        URL,
        {"params": _params(redirect_uri="https://evil.example/cb"), "decision": "allow"},
        content_type="application/json",
        **staff_bearer,
    )

    assert response.status_code == 400
