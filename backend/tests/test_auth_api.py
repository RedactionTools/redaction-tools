import pytest

from apps.accounts import jwt


@pytest.mark.django_db
def test_me_requires_a_bearer_token(client):
    assert client.get("/api/v1/auth/me").status_code == 401


@pytest.mark.django_db
def test_me_rejects_a_refresh_token(client, user):
    token = jwt.encode_refresh_token(user)

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


@pytest.mark.django_db
def test_me_returns_the_authenticated_user(client, user, bearer):
    response = client.get("/api/v1/auth/me", **bearer)

    assert response.status_code == 200
    assert response.json() == {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "is_staff": False,
    }
