"""`pdfredeval login`: a device-code sign-in that ends with the CLI holding an API key.

The CLI opens a login with nothing but a name for the machine, gets a short code to
show and a secret device code to poll with; the user approves the code in the browser,
signed in as themselves; the next poll hands the CLI a fresh API key, once.
"""

from datetime import timedelta

import pytest
from django.utils import timezone
from ninja_apikey.models import APIKey

from apps.accounts.models import CliLogin

pytestmark = pytest.mark.django_db

BASE = "/api/v1/auth/cli-logins"


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    from django.core.cache import cache

    cache.clear()


def _start(client, name="mykola-laptop"):
    return client.post(BASE, {"client_name": name}, content_type="application/json")


def _poll(client, device_code):
    return client.post(
        f"{BASE}/token", {"device_code": device_code}, content_type="application/json"
    )


def test_starting_a_login_needs_no_account_and_returns_a_code_to_show(client, settings):
    settings.FRONTEND_URL = "https://redaction-tools.com"

    response = _start(client)

    assert response.status_code == 201
    body = response.json()
    assert len(body["device_code"]) >= 32
    assert len(body["user_code"]) == 9 and body["user_code"][4] == "-"
    assert body["verification_url"] == "https://redaction-tools.com/cli/login"
    assert body["verification_url_complete"].endswith(f"?code={body['user_code']}")
    assert body["interval"] >= 1 and body["expires_in"] > 60


def test_the_device_code_is_stored_only_as_a_hash(client):
    device_code = _start(client).json()["device_code"]

    assert not CliLogin.objects.filter(device_code_hash=device_code).exists()


def test_polling_before_approval_says_pending(client):
    device_code = _start(client).json()["device_code"]

    assert _poll(client, device_code).json() == {"status": "pending"}


def test_the_signed_in_user_sees_what_they_are_approving(client, bearer):
    user_code = _start(client).json()["user_code"]

    body = client.get(f"{BASE}/{user_code}", **bearer).json()

    assert body["client_name"] == "mykola-laptop"
    assert body["status"] == "pending"


def test_a_code_is_found_however_it_was_typed(client, bearer):
    user_code = _start(client).json()["user_code"]
    typed = user_code.replace("-", "").lower()

    assert client.get(f"{BASE}/{typed}", **bearer).status_code == 200


def test_looking_a_code_up_needs_a_signed_in_user(client):
    user_code = _start(client).json()["user_code"]

    assert client.get(f"{BASE}/{user_code}").status_code == 401


def test_approval_hands_the_cli_an_api_key_once(client, bearer, user):
    started = _start(client).json()

    assert client.post(f"{BASE}/{started['user_code']}/approve", **bearer).status_code == 200
    first = _poll(client, started["device_code"]).json()
    second = _poll(client, started["device_code"]).json()

    assert first["status"] == "approved"
    prefix, _ = first["key"].split(".")
    assert first["user"] == {"name": "Test User", "email": "user@example.com"}
    key = APIKey.objects.get(prefix=prefix)
    assert key.user == user
    assert key.label == "pdfredeval · mykola-laptop"
    assert second == {"status": "consumed"}


def test_the_issued_key_works_against_the_api(client, bearer, benchmark_case):
    started = _start(client).json()
    client.post(f"{BASE}/{started['user_code']}/approve", **bearer)
    key = _poll(client, started["device_code"]).json()["key"]

    response = client.get("/api/v1/benchmarks/submissions/mine", headers={"X-API-Key": key})

    assert response.status_code == 200


def test_a_denied_login_issues_nothing(client, bearer):
    started = _start(client).json()

    client.post(f"{BASE}/{started['user_code']}/deny", **bearer)

    assert _poll(client, started["device_code"]).json() == {"status": "denied"}
    assert not APIKey.objects.exists()


def test_an_expired_login_cannot_be_approved_or_redeemed(client, bearer):
    started = _start(client).json()
    CliLogin.objects.update(expires_at=timezone.now() - timedelta(seconds=1))

    response = client.post(f"{BASE}/{started['user_code']}/approve", **bearer)

    assert response.status_code == 410
    assert _poll(client, started["device_code"]).json() == {"status": "expired"}


def test_an_unknown_device_code_is_a_404(client):
    assert _poll(client, "not-a-real-device-code").status_code == 404


def test_approval_respects_the_key_limit(client, bearer, settings):
    settings.MAX_API_KEYS_PER_USER = 0
    started = _start(client).json()

    response = client.post(f"{BASE}/{started['user_code']}/approve", **bearer)

    assert response.status_code == 409
    assert "Revoke" in response.json()["detail"]


def test_a_key_revokes_itself_on_logout(client, api_key):
    response = client.post("/api/v1/auth/api-keys/current/revoke", **api_key)

    assert response.status_code == 204
    assert client.get("/api/v1/benchmarks/submissions/mine", **api_key).status_code == 401
