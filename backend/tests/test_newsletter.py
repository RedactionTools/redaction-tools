"""The newsletter list: double opt-in from the footer, a welcome on confirming, and a way out."""

import re
import time
from datetime import timedelta

import pytest
from django.core import mail

pytestmark = pytest.mark.django_db

SUBSCRIBE = "/api/v1/newsletter/subscriptions"
CONFIRM = "/api/v1/newsletter/confirmations"
UNSUBSCRIBE = "/api/v1/newsletter/unsubscriptions"
ALL_TOPICS = {"reviews": True, "new_tools": True, "benchmarks": True}


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    from django.core.cache import cache

    cache.clear()


def _subscribe(client, capture, email="reader@example.com", **topics):
    with capture(execute=True):
        return client.post(
            SUBSCRIBE,
            {"email": email, **(topics or ALL_TOPICS)},
            content_type="application/json",
        )


def test_subscribing_stores_a_pending_address(client, django_capture_on_commit_callbacks):
    from apps.newsletter.models import Subscriber

    response = _subscribe(client, django_capture_on_commit_callbacks)

    assert response.status_code == 204
    subscriber = Subscriber.objects.get()
    assert subscriber.email == "reader@example.com"
    assert subscriber.status == Subscriber.Status.PENDING


def test_subscribing_emails_a_link_that_confirms_the_address(
    client, settings, django_capture_on_commit_callbacks
):
    settings.FRONTEND_URL = "https://redaction-tools.com"

    _subscribe(client, django_capture_on_commit_callbacks)

    [message] = mail.outbox
    assert message.to == ["reader@example.com"]
    assert message.subject == "Confirm your Redaction Tools subscription"
    match = re.search(r"https://redaction-tools\.com/newsletter/confirm\?token=(\S+)", message.body)
    assert match, message.body


def _confirm_token(message):
    from urllib.parse import unquote

    return unquote(re.search(r"/newsletter/confirm\?token=(\S+)", message.body).group(1))


def _confirm(client, capture, token):
    with capture(execute=True):
        return client.post(CONFIRM, {"token": token}, content_type="application/json")


def test_confirming_activates_the_address_and_sends_a_welcome(
    client, django_capture_on_commit_callbacks
):
    from apps.newsletter.models import Subscriber

    _subscribe(client, django_capture_on_commit_callbacks, reviews=True, benchmarks=True)
    token = _confirm_token(mail.outbox[0])

    response = _confirm(client, django_capture_on_commit_callbacks, token)

    assert response.status_code == 200
    assert response.json() == {"email": "reader@example.com", "topics": ["reviews", "benchmarks"]}
    subscriber = Subscriber.objects.get()
    assert subscriber.status == Subscriber.Status.ACTIVE
    assert subscriber.confirmed_at is not None
    welcome = mail.outbox[1]
    assert welcome.to == ["reader@example.com"]
    assert welcome.subject == "You're subscribed to Redaction Tools updates"
    assert "- Reviews\n- Benchmarks\n" in welcome.body
    assert "New tools" not in welcome.body


def test_clicking_the_link_again_sends_no_second_welcome(
    client, django_capture_on_commit_callbacks
):
    _subscribe(client, django_capture_on_commit_callbacks)
    token = _confirm_token(mail.outbox[0])
    _confirm(client, django_capture_on_commit_callbacks, token)

    response = _confirm(client, django_capture_on_commit_callbacks, token)

    assert response.status_code == 200
    assert len(mail.outbox) == 2


@pytest.mark.parametrize("token", ["", "not-a-token", "eyJpZCI6MX0:forged:signature"])
def test_a_bad_confirmation_link_is_refused(client, django_capture_on_commit_callbacks, token):
    response = _confirm(client, django_capture_on_commit_callbacks, token)

    assert response.status_code == 400
    assert "link" in response.json()["detail"]


def test_an_expired_confirmation_link_is_refused(
    client, django_capture_on_commit_callbacks, monkeypatch
):
    _subscribe(client, django_capture_on_commit_callbacks)
    token = _confirm_token(mail.outbox[0])

    eight_days_on = time.time() + timedelta(days=8).total_seconds()
    monkeypatch.setattr("django.core.signing.time.time", lambda: eight_days_on)

    assert _confirm(client, django_capture_on_commit_callbacks, token).status_code == 400


def test_an_address_is_stored_once_however_it_is_typed(client, django_capture_on_commit_callbacks):
    from apps.newsletter.models import Subscriber

    _subscribe(client, django_capture_on_commit_callbacks, email="  Reader@Example.COM ")
    response = _subscribe(client, django_capture_on_commit_callbacks, email="reader@example.com")

    assert response.status_code == 204
    assert list(Subscriber.objects.values_list("email", flat=True)) == ["reader@example.com"]


@pytest.mark.parametrize(
    ("email", "topics"),
    [
        ("reader@example.com", {"reviews": False, "new_tools": False, "benchmarks": False}),
        ("not an address", ALL_TOPICS),
    ],
)
def test_a_subscription_needs_an_address_and_a_topic(
    client, django_capture_on_commit_callbacks, email, topics
):
    from apps.newsletter.models import Subscriber

    response = _subscribe(client, django_capture_on_commit_callbacks, email=email, **topics)

    assert response.status_code == 422
    assert isinstance(response.json()["detail"], str)
    assert not Subscriber.objects.exists()
    assert mail.outbox == []


def test_resubscribing_an_active_address_changes_nothing_until_confirmed(
    client, django_capture_on_commit_callbacks
):
    """Otherwise anyone could rewrite a stranger's topics from the footer."""
    from apps.newsletter.models import Subscriber

    _subscribe(client, django_capture_on_commit_callbacks)
    _confirm(client, django_capture_on_commit_callbacks, _confirm_token(mail.outbox[0]))

    response = _subscribe(client, django_capture_on_commit_callbacks, new_tools=True)

    assert response.status_code == 204
    subscriber = Subscriber.objects.get()
    assert subscriber.status == Subscriber.Status.ACTIVE
    assert subscriber.topics == ["reviews", "new_tools", "benchmarks"]

    _confirm(client, django_capture_on_commit_callbacks, _confirm_token(mail.outbox[2]))

    subscriber.refresh_from_db()
    assert subscriber.topics == ["new_tools"]
    assert len(mail.outbox) == 3  # the second confirmation, but no second welcome


def _unsubscribe_token(message):
    from urllib.parse import unquote

    return unquote(re.search(r"/newsletter/unsubscribe\?token=(\S+)", message.body).group(1))


def test_the_welcome_carries_a_link_that_unsubscribes(client, django_capture_on_commit_callbacks):
    from apps.newsletter.models import Subscriber

    _subscribe(client, django_capture_on_commit_callbacks)
    _confirm(client, django_capture_on_commit_callbacks, _confirm_token(mail.outbox[0]))
    welcome = mail.outbox[1]
    token = _unsubscribe_token(welcome)
    assert "/newsletter/unsubscribe?token=" in welcome.extra_headers["List-Unsubscribe"]

    for _ in range(2):  # a second click is harmless
        response = client.post(UNSUBSCRIBE, {"token": token}, content_type="application/json")
        assert response.status_code == 204

    subscriber = Subscriber.objects.get()
    assert subscriber.status == Subscriber.Status.UNSUBSCRIBED
    assert subscriber.unsubscribed_at is not None


def test_a_bad_unsubscribe_link_is_refused(client):
    response = client.post(UNSUBSCRIBE, {"token": "forged"}, content_type="application/json")

    assert response.status_code == 400


def test_subscribing_is_throttled_per_ip(client, django_capture_on_commit_callbacks):
    """At the default 10/hour: the throttle reads its rate once, at import."""
    for n in range(10):
        response = _subscribe(client, django_capture_on_commit_callbacks, email=f"r{n}@example.com")
        assert response.status_code == 204

    assert _subscribe(client, django_capture_on_commit_callbacks).status_code == 429
