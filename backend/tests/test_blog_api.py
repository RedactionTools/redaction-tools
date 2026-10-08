"""The post-submission HTTP surface: who may send a guest post, and what comes back.

Blog posts are MDX in the frontend, so a submission is a queue row for staff,
never a page. The rules live in `apps.blog.services`; this proves the wiring.
"""

import pytest
from django.core.cache import cache

pytestmark = pytest.mark.django_db

BASE = "/api/v1/blog/submissions"
BODY = ("A walkthrough of redacting scanned PDFs. " * 20).strip()


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    """Throttle counters live in the cache and would leak between tests."""
    cache.clear()
    yield
    cache.clear()


def _payload(**overrides):
    return {
        "title": "Redacting scanned PDFs",
        "description": "What OCR misses and how to check.",
        "tags": ["OCR", "Guides"],
        "body_md": BODY,
        "author_name": "Ada Writer",
    } | overrides


def _post(client, auth=None, **overrides):
    return client.post(BASE, _payload(**overrides), content_type="application/json", **(auth or {}))


def test_submitting_needs_a_signed_in_account(client):
    assert _post(client).status_code == 401


def test_a_signed_in_submission_is_queued_as_pending(client, user, bearer):
    from apps.blog.models import PostSubmission

    response = _post(client, bearer)

    assert response.status_code == 201
    assert response.json()["status"] == "pending"
    submission = PostSubmission.objects.get()
    assert (submission.submitted_by, submission.title, submission.body_md) == (
        user,
        "Redacting scanned PDFs",
        BODY,
    )


def test_a_post_too_short_to_review_is_refused(client, bearer):
    response = _post(client, bearer, body_md="Too short.")

    assert response.status_code == 422
    assert "at least" in response.json()["detail"]


def test_a_post_over_the_length_cap_is_refused(client, bearer, settings):
    settings.BLOG_SUBMISSION_MAX_LENGTH = len(BODY) - 1

    response = _post(client, bearer)

    assert response.status_code == 422
    assert "at most" in response.json()["detail"]


def test_author_links_must_be_public_web_addresses(client, bearer):
    response = _post(client, bearer, author_links=["javascript:alert(1)"])

    assert response.status_code == 422
    assert "http" in response.json()["detail"]


def test_an_account_can_leave_only_so_many_posts_awaiting_review(client, bearer, settings):
    settings.BLOG_SUBMISSION_MAX_OPEN = 1
    assert _post(client, bearer).status_code == 201

    response = _post(client, bearer, title="A second post")

    assert response.status_code == 422
    assert "awaiting review" in response.json()["detail"]


def test_submitting_is_rate_limited_per_account(client, bearer, settings):
    """At the default 5/day: the throttle reads its rate once, at import."""
    settings.BLOG_SUBMISSION_MAX_OPEN = 100
    for _ in range(5):
        assert _post(client, bearer).status_code == 201

    assert _post(client, bearer).status_code == 429


def test_an_account_lists_only_its_own_submissions(client, bearer, staff_user):
    from apps.blog.models import PostSubmission

    PostSubmission.objects.create(
        title="Someone else's",
        description="-",
        body_md="-",
        author_name="-",
        submitted_by=staff_user,
    )
    _post(client, bearer)

    response = client.get(BASE, **bearer)

    assert response.status_code == 200
    assert [row["title"] for row in response.json()] == ["Redacting scanned PDFs"]


def test_an_overlong_title_is_a_validation_error_not_a_crash(client, bearer):
    response = _post(client, bearer, title="T" * 201)

    assert response.status_code == 422
