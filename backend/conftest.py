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
