"""The contract the Next.js frontend depends on: allauth headless returns our JWTs."""

import json

import pytest

from apps.accounts import jwt

REFRESH_URL = "/_allauth/app/v1/tokens/refresh"


@pytest.mark.django_db
def test_google_is_advertised_with_the_token_flow(client):
    response = client.get("/_allauth/app/v1/config")

    providers = response.json()["data"]["socialaccount"]["providers"]
    google = next(p for p in providers if p["id"] == "google")
    assert "provider_token" in google["flows"]


@pytest.mark.django_db
def test_refresh_endpoint_rotates_the_token_pair(client, user):
    refresh_token = jwt.encode_refresh_token(user)

    response = client.post(
        REFRESH_URL,
        data=json.dumps({"refresh_token": refresh_token}),
        content_type="application/json",
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert jwt.authenticate_token(data["access_token"]) == user
    assert data["refresh_token"] != refresh_token
    assert jwt.authenticate_token(data["refresh_token"], jwt.REFRESH_TOKEN_TYPE) == user


@pytest.mark.django_db
def test_refresh_endpoint_rejects_an_invalid_token(client):
    response = client.post(
        REFRESH_URL,
        data=json.dumps({"refresh_token": "not-a-jwt"}),
        content_type="application/json",
    )

    assert response.status_code == 400
