"""Fixtures shared by the backend suite.

Also the one place that tells tdd-guard's pytest reporter where to write: see
`pytest_configure` below.
"""

import pathlib

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

# The repo root, which is where `.claude/tdd-guard/data/` lives - not this
# directory. Derived from this file's location so it is right in any checkout.
PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent


@pytest.hookimpl(tryfirst=True)
def pytest_configure(config):
    """Point tdd-guard's pytest reporter at the repo root.

    Without this the reporter writes `backend/.claude/tdd-guard/data/test.json`
    and the hook reads the repo root's, so it sees no test output at all and
    refuses every implementation edit as unproven - which is worse than no
    guard, because the discipline it enforces becomes impossible to satisfy.

    It only reads the absolute path from the `tdd_guard_project_root` ini
    option, so setting that in pyproject.toml would commit one machine's paths.
    `tryfirst` because the reporter resolves the directory once, in its own
    `pytest_configure`, and conftest hooks run before entry-point plugins.
    """
    config.inicfg["tdd_guard_project_root"] = str(PROJECT_ROOT)


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


# --- Benchmarks --------------------------------------------------------------
# One real case and one real scored run, copied out of pdf-redaction-benchmarks
# (`benchmarks/v0.1.1`). The run is pdf-redaction:web, a seeded catalog tool.

BENCHMARK_FIXTURES = PROJECT_ROOT / "backend" / "tests" / "fixtures" / "benchmarks"
BENCHMARK_CASE_ID = "extraction-conditions-1"


@pytest.fixture
def case_files():
    """`(pdf bytes, ground truth dict)` for the fixture case."""
    import json

    case = BENCHMARK_FIXTURES / "case"
    return (
        (case / f"{BENCHMARK_CASE_ID}.pdf").read_bytes(),
        json.loads((case / "ground_truth.json").read_text()),
    )


@pytest.fixture
def run_files():
    """What `pdfredeval publish` sends for the fixture run."""
    import json

    run = BENCHMARK_FIXTURES / "run"
    return {
        "manifest": json.loads((run / "manifest.json").read_text()),
        "report": json.loads((run / "report.json").read_text()),
        "overlay": (run / "overlay.png").read_bytes(),
        "pdf": (run / f"redacted-{BENCHMARK_CASE_ID}.pdf").read_bytes(),
    }


@pytest.fixture
def benchmark_case(staff_user, case_files):
    """The fixture case, published into the seeded `pdf` suite as revision v0.1.1."""
    from apps.benchmarks import services

    pdf, truth = case_files
    return services.publish_case(user=staff_user, suite="pdf", pdf=pdf, ground_truth=truth)


@pytest.fixture
def owner(db):
    """An account with an approved claim on pdf-redaction."""
    from apps.catalog.models import Tool, ToolClaim

    account = get_user_model().objects.create_user(email="owner@example.com", name="Tool Owner")
    ToolClaim.objects.create(
        tool=Tool.objects.get(slug="pdf-redaction"),
        user=account,
        work_email="owner@pdf-redaction.example",
        email_domain="pdf-redaction.example",
        status="approved",
    )
    return account


def _api_key_headers(account):
    from ninja_apikey.models import APIKey
    from ninja_apikey.security import generate_key

    key = generate_key()
    APIKey.objects.create(prefix=key.prefix, hashed_key=key.hashed_key, user=account, label="t")
    return {"headers": {"X-API-Key": f"{key.prefix}.{key.key}"}}


@pytest.fixture
def api_key(user):
    """Headers that authenticate `user` with an API key, as the pdfredeval CLI does."""
    return _api_key_headers(user)


@pytest.fixture
def staff_api_key(staff_user):
    return _api_key_headers(staff_user)
