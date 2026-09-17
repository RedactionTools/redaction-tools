import pytest
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory

from apps.accounts import jwt
from apps.accounts.tokens import JWTTokenStrategy


@pytest.fixture
def strategy():
    return JWTTokenStrategy()


@pytest.mark.django_db
def test_payload_carries_a_usable_token_pair(strategy, user):
    request = RequestFactory().post("/_allauth/app/v1/auth/provider/token")
    request.user = user

    payload = strategy.create_access_token_payload(request)

    assert jwt.authenticate_token(payload["access_token"]) == user
    assert jwt.authenticate_token(payload["refresh_token"], jwt.REFRESH_TOKEN_TYPE) == user


@pytest.mark.django_db
def test_no_payload_for_anonymous_requests(strategy):
    request = RequestFactory().get("/")
    request.user = AnonymousUser()

    assert strategy.create_access_token_payload(request) is None


@pytest.mark.django_db
def test_refresh_rotates_the_pair(strategy, user):
    refresh_token = jwt.encode_refresh_token(user)

    access, new_refresh = strategy.refresh_token(refresh_token)

    assert jwt.authenticate_token(access) == user
    assert new_refresh != refresh_token
    assert jwt.authenticate_token(new_refresh, jwt.REFRESH_TOKEN_TYPE) == user


@pytest.mark.django_db
def test_refresh_rejects_an_access_token(strategy, user):
    assert strategy.refresh_token(jwt.encode_access_token(user)) is None
