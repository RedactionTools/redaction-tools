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
