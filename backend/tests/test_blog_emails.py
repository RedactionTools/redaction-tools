"""Staff hear about every guest post, once it has committed."""

import pytest
from django.core import mail

from apps.blog import services

pytestmark = pytest.mark.django_db

BODY = ("A walkthrough of redacting scanned PDFs. " * 20).strip()


def _submit(user):
    return services.submit_post(
        user=user,
        data={
            "title": "Redacting scanned PDFs",
            "description": "What OCR misses and how to check.",
            "body_md": BODY,
            "author_name": "Ada Writer",
        },
    )


def test_staff_are_told_about_a_new_post(
    user, staff_user, settings, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=True):
        submission = _submit(user)

    (notice,) = [m for m in mail.outbox if staff_user.email in m.to]
    assert "Redacting scanned PDFs" in notice.subject
    assert f"{settings.BACKEND_URL}/admin/blog/postsubmission/{submission.pk}/change/" in (
        notice.body
    )
    assert user.email in notice.body


def test_nothing_is_sent_before_the_submission_commits(
    user, staff_user, django_capture_on_commit_callbacks
):
    with django_capture_on_commit_callbacks(execute=False):
        _submit(user)

    assert mail.outbox == []
