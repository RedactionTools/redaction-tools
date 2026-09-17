"""Submitting a tool.

Hard rule: nothing user-supplied reaches a public page without staff approval.
A submission is a queue row, never a listing.
"""

import pytest
from django.core.cache import cache

from apps.catalog.models import Tool, ToolSubmission, ToolSubmissionStatus

URL = "/api/v1/catalog/submissions"


def payload(**overrides):
    return {
        "name": "Acme Redact",
        "vendor_name": "Acme",
        "homepage_url": "https://93.184.216.34/",
        "description": "Redacts things.",
        **overrides,
    }


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    """Throttle counters live in the cache and would leak between tests."""
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
def test_submitting_requires_an_account(client):
    """Login is the primary anti-spam control - it removes anonymous abuse entirely."""
    response = client.post(URL, payload(), content_type="application/json")

    assert response.status_code == 401


@pytest.mark.django_db
def test_a_submission_lands_in_the_queue_and_not_on_the_site(client, user, bearer):
    response = client.post(URL, payload(), content_type="application/json", **bearer)

    assert response.status_code == 201
    submission = ToolSubmission.objects.get()
    assert submission.status == ToolSubmissionStatus.SUBMITTED
    assert submission.submitted_by == user
    assert not Tool.objects.filter(name="Acme Redact").exists()


@pytest.mark.django_db
def test_the_submitters_address_and_agent_are_recorded(client, bearer):
    client.post(
        URL,
        payload(),
        content_type="application/json",
        HTTP_USER_AGENT="Mozilla/5.0 (test)",
        **bearer,
    )

    submission = ToolSubmission.objects.get()
    assert submission.user_agent == "Mozilla/5.0 (test)"
    assert submission.source_ip


@pytest.mark.django_db
@pytest.mark.parametrize(
    "url",
    [
        "http://169.254.169.254/latest/meta-data/",
        "http://127.0.0.1:8007/admin/",
        "http://10.0.0.1/",
        "file:///etc/passwd",
    ],
)
def test_a_url_pointing_inward_is_refused(client, bearer, url):
    """An approved pricing_url becomes a URL the worker fetches, so this is the
    first of three places the SSRF guard runs."""
    response = client.post(
        URL, payload(homepage_url=url), content_type="application/json", **bearer
    )

    assert response.status_code == 422
    assert not ToolSubmission.objects.exists()


@pytest.mark.django_db
def test_an_account_cannot_flood_the_queue(client, user, bearer, settings):
    settings.CATALOG_MAX_OPEN_SUBMISSIONS = 2
    for index in range(2):
        ToolSubmission.objects.create(
            name=f"Open {index}",
            homepage_url=f"https://93.184.216.34/{index}",
            description="x",
            submitted_by=user,
        )

    response = client.post(URL, payload(), content_type="application/json", **bearer)

    assert response.status_code == 409
    assert "already have" in response.json()["detail"]


@pytest.mark.django_db
def test_a_tool_we_already_list_points_the_submitter_at_the_claim_flow(client, bearer):
    response = client.post(
        URL,
        payload(homepage_url="https://www.adobe.com/acrobat.html"),
        content_type="application/json",
        **bearer,
    )

    assert response.status_code == 409
    assert "adobe-acrobat" in response.json()["detail"]


@pytest.mark.django_db
def test_the_duplicate_check_ignores_www_and_path(client, bearer):
    """adobe.com and www.adobe.com/x are the same vendor site."""
    response = client.post(
        URL,
        payload(homepage_url="https://adobe.com/anything"),
        content_type="application/json",
        **bearer,
    )

    assert response.status_code == 409


@pytest.mark.django_db
def test_a_submitter_sees_only_their_own_submissions(client, user, bearer, django_user_model):
    someone_else = django_user_model.objects.create_user(email="other@example.com", name="Other")
    ToolSubmission.objects.create(
        name="Mine", homepage_url="https://93.184.216.34/a", description="x", submitted_by=user
    )
    ToolSubmission.objects.create(
        name="Theirs",
        homepage_url="https://93.184.216.34/b",
        description="x",
        submitted_by=someone_else,
    )

    response = client.get(URL, **bearer)

    assert [row["name"] for row in response.json()] == ["Mine"]


@pytest.mark.django_db
def test_submissions_are_rate_limited_per_account(client, bearer):
    """Exercises the shipped rate rather than an injected one: the throttle is
    constructed when the route is declared, so a settings override at test time
    would never reach it - and a limit that only holds in tests is not a limit.
    """
    for index in range(5):
        response = client.post(
            URL,
            payload(name=f"Tool {index}", homepage_url=f"https://93.184.216.{index}/"),
            content_type="application/json",
            **bearer,
        )
        assert response.status_code == 201, response.content

    response = client.post(
        URL,
        payload(name="Sixth", homepage_url="https://93.184.216.99/"),
        content_type="application/json",
        **bearer,
    )

    assert response.status_code == 429
