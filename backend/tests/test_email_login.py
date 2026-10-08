"""Signing in by email: one message carries both a six-digit code and a link.

Either one signs the reader in, on any device - the link is not bound to the browser
that asked for it. A first sign-in creates the account. Requesting answers 204 for
every address, so the form never says who has an account.
"""

import re
from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone

from apps.accounts.models import EmailLogin

pytestmark = pytest.mark.django_db

BASE = "/api/v1/auth/email-login"


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    from django.core.cache import cache

    cache.clear()


def _request(client, email="reader@example.com", **extra):
    return client.post(BASE, {"email": email, **extra}, content_type="application/json")


def _sent_code(message):
    return re.search(r"\b(\d{6})\b", message.body).group(1)


def _sent_token(message):
    return re.search(r"/auth/email/verify\?token=([\w-]+)", message.body).group(1)


def test_requesting_mails_both_a_code_and_a_link(client, settings):
    settings.FRONTEND_URL = "https://redaction-tools.com"

    response = _request(client)

    assert response.status_code == 204
    assert len(mail.outbox) == 1
    message = mail.outbox[0]
    assert message.to == ["reader@example.com"]
    assert _sent_code(message)
    assert "https://redaction-tools.com/auth/email/verify?token=" in message.body


def test_the_code_and_link_are_stored_only_as_hashes(client):
    _request(client)
    message = mail.outbox[0]

    login = EmailLogin.objects.get()
    assert _sent_code(message) not in (login.code_hash, login.link_hash)
    assert _sent_token(message) not in (login.code_hash, login.link_hash)


def _confirm(client, **payload):
    return client.post(f"{BASE}/confirm", payload, content_type="application/json")


def test_the_code_signs_a_new_reader_in_and_creates_their_account(client):
    _request(client, "New.Reader@Example.com")
    code = _sent_code(mail.outbox[0])

    response = _confirm(client, email="new.reader@example.com", code=code)

    assert response.status_code == 200
    body = response.json()
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.json()["email"] == "new.reader@example.com"
    assert body["refresh_token"]
    # For the session's own name and email: the frontend has no id_token to read them from.
    assert body["user"]["email"] == "new.reader@example.com"


def test_the_link_signs_in_and_spends_the_code_with_it(client):
    _request(client)
    message = mail.outbox[0]

    first = _confirm(client, token=_sent_token(message))
    again = _confirm(client, email="reader@example.com", code=_sent_code(message))

    assert first.status_code == 200
    assert again.status_code == 400


def test_an_expired_code_and_link_are_refused(client):
    _request(client)
    message = mail.outbox[0]
    EmailLogin.objects.update(expires_at=timezone.now() - timedelta(seconds=1))

    assert _confirm(client, email="reader@example.com", code=_sent_code(message)).status_code == 400
    assert _confirm(client, token=_sent_token(message)).status_code == 400


def test_five_wrong_codes_spend_the_sign_in(client):
    _request(client)
    code = _sent_code(mail.outbox[0])
    wrong = f"{(int(code) + 1) % 1_000_000:06d}"

    for _ in range(5):
        assert _confirm(client, email="reader@example.com", code=wrong).status_code == 400

    assert _confirm(client, email="reader@example.com", code=code).status_code == 400


def test_a_new_request_spends_the_earlier_link(client):
    _request(client)
    EmailLogin.objects.update(created_at=timezone.now() - timedelta(minutes=5))
    _request(client)

    first, second = mail.outbox
    assert _confirm(client, token=_sent_token(first)).status_code == 400
    assert _confirm(client, token=_sent_token(second)).status_code == 200


def test_a_repeat_within_the_cooldown_sends_nothing_and_still_answers_204(client):
    _request(client)

    response = _request(client)

    assert response.status_code == 204
    assert len(mail.outbox) == 1
    assert _confirm(client, token=_sent_token(mail.outbox[0])).status_code == 200


def test_an_inactive_account_gets_no_mail_and_the_same_204(client, user):
    user.is_active = False
    user.save()

    response = _request(client, user.email)

    assert response.status_code == 204
    assert mail.outbox == []


def test_an_existing_account_is_signed_in_whatever_the_case_of_its_address(client):
    from apps.accounts.models import User

    existing = User.objects.create_user("Jane.Doe@example.com", name="Jane")
    _request(client, "jane.doe@example.com")

    response = _confirm(client, token=_sent_token(mail.outbox[0]))

    me = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {response.json()['access_token']}"}
    )
    assert me.json()["id"] == str(existing.pk)
    assert User.objects.filter(email__iexact="jane.doe@example.com").count() == 1


def test_an_account_deactivated_after_the_mail_cannot_use_it(client, user):
    _request(client, user.email)
    user.is_active = False
    user.save()

    assert _confirm(client, token=_sent_token(mail.outbox[0])).status_code == 400


def test_a_first_sign_in_is_welcomed_and_a_returning_one_is_not(
    client, user, django_capture_on_commit_callbacks
):
    _request(client, "new@example.com")
    _request(client, user.email)
    new_mail, returning_mail = mail.outbox

    with django_capture_on_commit_callbacks(execute=True):
        _confirm(client, token=_sent_token(new_mail))
        _confirm(client, token=_sent_token(returning_mail))

    welcomes = [m for m in mail.outbox if m.subject == "Welcome to Redaction Tools"]
    assert [m.to for m in welcomes] == [["new@example.com"]]


def test_signing_in_marks_the_address_verified_for_a_later_google_sign_in(client):
    """allauth connects a Google login to an account only through a verified address."""
    from allauth.account.models import EmailAddress

    _request(client, "new@example.com")
    _confirm(client, token=_sent_token(mail.outbox[0]))

    address = EmailAddress.objects.get(email="new@example.com")
    assert address.verified and address.primary
    assert address.user.email == "new@example.com"


@pytest.mark.parametrize(
    ("asked", "landed"),
    [
        ("/tools/acme?tab=pricing", "/tools/acme?tab=pricing"),
        ("", "/account"),
        ("https://evil.example/", "/account"),
        ("//evil.example/", "/account"),
        ("/\\evil.example/", "/account"),
    ],
)
def test_the_link_lands_back_where_it_was_asked_from_but_only_on_this_site(client, asked, landed):
    """Carried in the link, so the verify page knows where to go before it signs in."""
    from urllib.parse import parse_qs, urlparse

    _request(client, next=asked)

    link = re.search(r"https?://\S+/auth/email/verify\S+", mail.outbox[0].body).group(0)
    assert parse_qs(urlparse(link).query)["next"] == [landed]


def test_requesting_is_throttled_per_ip(client):
    """At the default 10/hour: the throttle reads its rate once, at import."""
    for n in range(10):
        assert _request(client, f"r{n}@example.com").status_code == 204

    assert _request(client, "one-more@example.com").status_code == 429


def test_guessing_is_throttled_per_ip_across_addresses(client):
    """At the default 30/hour: the per-row limit alone would let one IP spread guesses."""
    for n in range(30):
        assert _confirm(client, email=f"r{n}@example.com", code="000000").status_code == 400

    assert _confirm(client, email="r0@example.com", code="000000").status_code == 429


def test_an_address_that_is_not_one_is_refused(client):
    response = _request(client, "not-an-address")

    assert response.status_code == 422
    assert mail.outbox == []


def test_a_mail_that_fails_to_send_leaves_nothing_to_wait_out(monkeypatch):
    from apps.accounts import email_login

    def fail(*args, **kwargs):
        raise ConnectionError("mail provider down")

    monkeypatch.setattr(email_login, "send_templated_email", fail)

    with pytest.raises(ConnectionError):
        email_login.request_login("reader@example.com")

    assert not EmailLogin.objects.exists()
