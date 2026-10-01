"""A new account gets a welcome email - once, on signing up, and only then."""

import pytest
from allauth.account.signals import user_signed_up
from django.contrib.auth import get_user_model
from django.core import mail
from django.test import RequestFactory


def _sign_up(user, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        user_signed_up.send(sender=type(user), request=RequestFactory().get("/"), user=user)


@pytest.mark.django_db
def test_signing_up_sends_a_welcome_email(user, django_capture_on_commit_callbacks):
    _sign_up(user, django_capture_on_commit_callbacks)

    [message] = mail.outbox
    assert message.to == ["user@example.com"]
    assert message.subject == "Welcome to Redaction Tools"
    assert "Hi Test User," in message.body


@pytest.mark.django_db
def test_an_account_with_no_name_is_still_greeted(django_capture_on_commit_callbacks):
    user = get_user_model().objects.create_user(email="anon@example.com")

    _sign_up(user, django_capture_on_commit_callbacks)

    [message] = mail.outbox
    assert message.body.startswith("Hi,")


@pytest.mark.django_db
def test_an_account_made_any_other_way_gets_no_welcome(user):
    """Staff creating a user in the admin or a shell is not a signup."""
    assert mail.outbox == []


@pytest.mark.django_db
def test_nothing_is_sent_until_the_signup_commits(user, django_capture_on_commit_callbacks):
    """A signup that rolls back must not have welcomed anyone."""
    with django_capture_on_commit_callbacks(execute=False) as callbacks:
        user_signed_up.send(sender=type(user), request=RequestFactory().get("/"), user=user)

    assert mail.outbox == []
    assert len(callbacks) == 1
