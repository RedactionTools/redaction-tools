"""API keys: the credential the pdfredeval CLI publishes benchmark results with."""

import pytest

pytestmark = pytest.mark.django_db

URL = "/api/v1/auth/api-keys"


def _create(client, bearer, label="laptop"):
    return client.post(URL, {"label": label}, content_type="application/json", **bearer)


def test_a_key_is_shown_once_when_it_is_created(client, bearer):
    response = _create(client, bearer)

    assert response.status_code == 201
    body = response.json()
    prefix, secret = body["key"].split(".")
    assert prefix == body["prefix"] and len(secret) >= 32
    assert body["label"] == "laptop"

    [listed] = client.get(URL, **bearer).json()
    assert listed["prefix"] == prefix
    assert "key" not in listed


def test_a_new_key_authenticates_its_owner(client, bearer, benchmark_case):
    key = _create(client, bearer).json()["key"]

    response = client.get("/api/v1/benchmarks/submissions/mine", headers={"X-API-Key": key})

    assert response.status_code == 200


def test_a_revoked_key_stops_working(client, bearer):
    created = _create(client, bearer).json()

    assert client.delete(f"{URL}/{created['prefix']}", **bearer).status_code == 204
    response = client.get(
        "/api/v1/benchmarks/submissions/mine", headers={"X-API-Key": created["key"]}
    )
    assert response.status_code == 401
    assert client.get(URL, **bearer).json()[0]["revoked"] is True


def test_nobody_revokes_someone_elses_key(client, bearer, owner):
    from apps.accounts import jwt

    created = _create(client, bearer).json()
    other = {"headers": {"Authorization": f"Bearer {jwt.encode_access_token(owner)}"}}

    assert client.delete(f"{URL}/{created['prefix']}", **other).status_code == 404


def test_a_key_cannot_mint_another_key(client, api_key):
    """Keys live on a laptop or in CI; a leaked one must not be able to multiply."""
    assert _create(client, api_key).status_code == 401


def test_an_account_holds_a_bounded_number_of_live_keys(client, bearer, settings):
    settings.MAX_API_KEYS_PER_USER = 2
    _create(client, bearer)
    _create(client, bearer)

    response = _create(client, bearer)

    assert response.status_code == 409
    assert "Revoke" in response.json()["detail"]
