"""Submitting a tool mails the submitter a receipt and every active staff account a notice."""

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache

from apps.catalog.models import ToolSubmission

URL = "/api/v1/catalog/submissions"


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    cache.clear()
    yield
    cache.clear()


def _submit(client, bearer, capture, **overrides):
    body = {
        "name": "Acme Redact",
        "vendor_name": "Acme",
        "homepage_url": "https://93.184.216.34/",
        "description": "Redacts <things>.",
        **overrides,
    }
    with capture(execute=True):
        return client.post(URL, body, content_type="application/json", **bearer)


def _sent_to(address):
    return [message for message in mail.outbox if address in message.to]


@pytest.mark.django_db
def test_the_submitter_gets_a_receipt(client, bearer, django_capture_on_commit_callbacks):
    _submit(client, bearer, django_capture_on_commit_callbacks)

    [receipt] = _sent_to("user@example.com")
    assert receipt.subject == "We received your submission: Acme Redact"
    assert "reviewed by a person" in receipt.body


@pytest.mark.django_db
def test_the_receipt_goes_to_the_contact_address_when_one_is_given(
    client, bearer, django_capture_on_commit_callbacks
):
    _submit(client, bearer, django_capture_on_commit_callbacks, contact_email="press@acme.example")

    assert len(_sent_to("press@acme.example")) == 1
    assert _sent_to("user@example.com") == []


@pytest.mark.django_db
def test_every_active_staff_account_is_told(
    client, bearer, staff_user, django_capture_on_commit_callbacks
):
    User = get_user_model()
    User.objects.create_user(email="second@example.com", is_staff=True)
    User.objects.create_user(email="gone@example.com", is_staff=True, is_active=False)

    _submit(client, bearer, django_capture_on_commit_callbacks)

    [notice] = [message for message in mail.outbox if "staff@example.com" in message.to]
    assert sorted(notice.to) == ["second@example.com", "staff@example.com"]
    assert notice.subject == "New tool submission: Acme Redact"
    assert "user@example.com" in notice.body
    submission = ToolSubmission.objects.get()
    admin_path = f"/admin/catalog/toolsubmission/{submission.pk}/change/"
    assert f"http://testserver{admin_path}" in notice.body


@pytest.mark.django_db
def test_submitted_text_is_escaped_in_the_staff_notice(
    client, bearer, staff_user, django_capture_on_commit_callbacks
):
    _submit(client, bearer, django_capture_on_commit_callbacks)

    [notice] = _sent_to("staff@example.com")
    [(html, _)] = notice.alternatives
    assert "Redacts &lt;things&gt;." in html
    assert "<things>" not in html


@pytest.mark.django_db
def test_with_no_staff_only_the_receipt_goes_out(
    client, bearer, django_capture_on_commit_callbacks
):
    _submit(client, bearer, django_capture_on_commit_callbacks)

    assert [message.to for message in mail.outbox] == [["user@example.com"]]


@pytest.mark.django_db
def test_a_refused_submission_sends_nothing(
    client, bearer, staff_user, django_capture_on_commit_callbacks
):
    """A duplicate is turned away with a 409; nobody should hear about it."""
    _submit(client, bearer, django_capture_on_commit_callbacks)
    mail.outbox.clear()

    response = _submit(client, bearer, django_capture_on_commit_callbacks)

    assert response.status_code == 409
    assert mail.outbox == []
