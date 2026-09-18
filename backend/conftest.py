import pytest
from django.contrib.auth import get_user_model
from django.test import Client


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(email="user@example.com", name="Test User")


@pytest.fixture
def client():
    return Client()


@pytest.fixture
def bearer(user):
    """Headers that authenticate `user` against the API."""
    from apps.accounts import jwt

    return {"headers": {"Authorization": f"Bearer {jwt.encode_access_token(user)}"}}


@pytest.fixture
def staff_user(db):
    return get_user_model().objects.create_user(
        email="staff@example.com", name="Staff", is_staff=True, is_superuser=True
    )


@pytest.fixture
def admin_client(client, staff_user):
    """A client signed into the Django admin as staff."""
    client.force_login(staff_user)
    return client


@pytest.fixture
def mcp_token(staff_user):
    """A static bearer token for `staff_user` - what curl and the Inspector use."""
    from django_mcpz.bearer_tokens.models import Token

    return Token.create(name="tests", user=staff_user)[1]


@pytest.fixture
def user_token(user):
    """The same for a non-staff account: the 403 case."""
    from django_mcpz.bearer_tokens.models import Token

    return Token.create(name="tests", user=user)[1]


@pytest.fixture
def mcp(client, mcp_token):
    """POST a JSON-RPC request to the staff MCP endpoint."""

    def call(method, params=None, *, token=mcp_token):
        body = {"jsonrpc": "2.0", "id": 1, "method": method}
        if params is not None:
            body["params"] = params
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return client.post("/mcp", body, content_type="application/json", headers=headers)

    return call


@pytest.fixture
def call_tool(mcp):
    """Call one MCP tool and return the JSON-RPC `result` object."""

    def call(name, arguments=None):
        response = mcp("tools/call", {"name": name, "arguments": arguments or {}})
        assert response.status_code == 200, response.content
        return response.json()["result"]

    return call
