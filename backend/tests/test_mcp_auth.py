"""Who may reach the staff MCP server at `/mcp`.

Two credentials, one gate. OAuth is what claude.ai's connector flow mints; a
static bearer token is what a terminal and the MCP Inspector use. Both land on
the same question, which is not "which credential" but "is this a member of
staff".
"""

from datetime import timedelta

import pytest
from django.test import Client

pytestmark = pytest.mark.django_db

URL = "/mcp"


def test_an_anonymous_request_is_refused_with_a_discovery_hint(client):
    response = client.post(URL, {}, content_type="application/json")

    assert response.status_code == 401
    # The challenge is the whole mechanism by which an unconfigured connector
    # finds out where to authorise. A bare 401 is a dead end.
    assert "resource_metadata=" in response.headers["WWW-Authenticate"]


def test_a_non_staff_token_is_forbidden_rather_than_unauthorized(mcp, user_token):
    response = mcp("tools/list", token=user_token)

    # 403: the credential is valid. A 401 would send a connector round the
    # authorisation loop forever, being told to sign in as the user it is.
    assert response.status_code == 403
    assert response.json()["error"] == "forbidden"


def test_a_staff_token_reaches_the_server(mcp):
    response = mcp("tools/list")

    assert response.status_code == 200
    assert "error" not in response.json()


def test_a_revoked_token_no_longer_works(mcp, staff_user):
    from django_mcpz.bearer_tokens.models import Token

    token = Token.create(name="revoked", user=staff_user)
    token[0].revoke()

    assert mcp("tools/list", token=token[1]).status_code == 401


def test_the_protected_resource_metadata_is_discoverable(client):
    response = client.get("/.well-known/oauth-protected-resource/mcp")

    assert response.status_code == 200
    assert response.json()["resource"].endswith("/mcp")


def test_the_authorization_server_metadata_is_discoverable(client):
    response = client.get("/.well-known/oauth-authorization-server/oauth")

    assert response.status_code == 200
    body = response.json()
    assert body["authorization_endpoint"].endswith("/oauth/authorize")
    assert body["token_endpoint"].endswith("/oauth/token")
    # Claude registers itself rather than being configured by hand.
    assert body["registration_endpoint"].endswith("/oauth/register")


def test_the_endpoint_does_not_require_a_csrf_token(mcp_token):
    # MCP clients are not browsers and carry no cookie, so the view is exempt.
    # Asserted rather than assumed: a regression here breaks every connector.
    strict = Client(enforce_csrf_checks=True)

    response = strict.post(
        URL,
        {"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        content_type="application/json",
        headers={"Authorization": f"Bearer {mcp_token}"},
    )

    assert response.status_code == 200


def test_a_client_can_register_itself(client):
    """Claude registers rather than being configured by hand."""
    response = client.post(
        "/oauth/register",
        {
            "client_name": "Claude",
            "redirect_uris": ["https://claude.ai/api/mcp/auth_callback"],
            "application_type": "web",
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    assert response.json()["client_id"]


def test_the_consent_page_sends_an_anonymous_visitor_to_sign_in(client):
    """And back again afterwards.

    LOGIN_REDIRECT_URL is "/admin/", so without the `next` the visitor would
    land in the admin and the connector would hang waiting for a code.
    """
    response = client.get("/oauth/authorize", {"client_id": "whatever"})

    assert response.status_code == 302
    assert response.url.startswith("/accounts/login/")
    assert "next=/oauth/authorize" in response.url


def test_an_oauth_token_for_a_non_staff_user_is_still_refused(client, user):
    """The gate is staff, not "held a valid credential at some point"."""
    from django_mcpz.oauth.models import AccessToken, Client

    oauth_client = Client.objects.create(
        client_id="probe", name="Probe", redirect_uris=["https://example.com/cb"]
    )
    _, token = AccessToken.create(
        client=oauth_client,
        user=user,
        resource="http://testserver/mcp",
        scope="",
        lifetime=timedelta(hours=1),
    )

    response = client.post(
        URL,
        {"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        content_type="application/json",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403
