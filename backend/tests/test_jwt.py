from datetime import timedelta

import pytest
from django.test import override_settings

from apps.accounts import jwt


@pytest.mark.django_db
def test_access_token_round_trips_to_its_user(user):
    token = jwt.encode_access_token(user)

    assert jwt.authenticate_token(token) == user


@pytest.mark.django_db
def test_refresh_token_is_rejected_where_an_access_token_is_required(user):
    token = jwt.encode_refresh_token(user)

    with pytest.raises(jwt.TokenError, match="Expected a access token"):
        jwt.authenticate_token(token)


@pytest.mark.django_db
def test_expired_token_is_rejected(user):
    with override_settings(JWT_ACCESS_TOKEN_LIFETIME=timedelta(seconds=-1)):
        token = jwt.encode_access_token(user)

    with pytest.raises(jwt.TokenError, match="expired"):
        jwt.authenticate_token(token)


@pytest.mark.django_db
def test_tampered_token_is_rejected(user):
    token = jwt.encode_access_token(user)
    header, payload, signature = token.split(".")

    with pytest.raises(jwt.TokenError):
        jwt.authenticate_token(f"{header}.{payload}.{signature[:-2]}xx")


@pytest.mark.django_db
def test_inactive_user_cannot_authenticate(user):
    token = jwt.encode_access_token(user)
    user.is_active = False
    user.save(update_fields=["is_active"])

    with pytest.raises(jwt.TokenError, match="inactive"):
        jwt.authenticate_token(token)


@pytest.mark.django_db
def test_issue_token_pair_exposes_lifetime(user):
    pair = jwt.issue_token_pair(user)

    assert pair["token_type"] == "Bearer"
    assert pair["expires_in"] == 900
    assert jwt.authenticate_token(pair["access_token"]) == user
    assert jwt.authenticate_token(pair["refresh_token"], jwt.REFRESH_TOKEN_TYPE) == user
