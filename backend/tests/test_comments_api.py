"""The comment HTTP surface: public reads, signed-in writes and the staff routes.

The rules themselves are tested as functions in `test_comments_services.py` and
`test_comments_staff.py`. What is proven here is the wiring: who may call, how a
refusal reaches the browser, and that each route reaches the right service.
"""

import pytest
from django.core.cache import cache

from apps.catalog.models import Tool, ToolStatus
from apps.comments.models import Comment, CommentStatus

pytestmark = pytest.mark.django_db

TOOL = "pdf-redaction"
POST = "introducing-redaction-tools"
BASE = "/api/v1/comments"
STAFF = "/api/v1/comments/staff"


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    """Throttle counters live in the cache and would leak between tests."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def staff_bearer(staff_user):
    from apps.accounts import jwt

    return {"headers": {"Authorization": f"Bearer {jwt.encode_access_token(staff_user)}"}}


def _post(client, auth, **body):
    return client.post(
        f"{BASE}/",
        {"target_type": "tool", "slug": TOOL} | body,
        content_type="application/json",
        **auth,
    )


# --- Public reads --------------------------------------------------------------


def test_anyone_can_read_a_tool_pages_comments(client, staff_user):
    Comment.objects.create(
        tool=Tool.objects.get(slug=TOOL),
        author=staff_user,
        body="Hi",
        status=CommentStatus.PUBLISHED,
    )

    response = client.get(f"{BASE}/tool/{TOOL}")

    assert response.status_code == 200
    assert [row["body"] for row in response.json()] == ["Hi"]
    assert "staff@example.com" not in response.content.decode()


def test_anyone_can_read_a_blog_posts_comments(client):
    response = client.get(f"{BASE}/blog/{POST}")

    assert (response.status_code, response.json()) == (200, [])


def test_the_comments_of_an_unlisted_tool_are_not_found(client):
    Tool.objects.filter(slug=TOOL).update(status=ToolStatus.DRAFT)

    assert client.get(f"{BASE}/tool/{TOOL}").status_code == 404


# --- Writing -------------------------------------------------------------------


def test_posting_needs_an_account(client):
    assert _post(client, {}, body="Hi").status_code == 401


def test_a_signed_in_reader_can_post(client, bearer):
    response = _post(client, bearer, body="Does it OCR?")

    assert response.status_code == 201
    assert (response.json()["body"], response.json()["status"]) == ("Does it OCR?", "pending")


def test_a_refusal_reaches_the_reader_as_detail(client, bearer):
    response = _post(client, bearer, body="  ")

    assert response.status_code == 422
    assert "empty" in response.json()["detail"]


def test_posting_on_an_unlisted_tool_is_not_found(client, bearer):
    Tool.objects.filter(slug=TOOL).update(status=ToolStatus.DRAFT)

    assert _post(client, bearer, body="Hi").status_code == 404


def test_posting_is_throttled_per_account(client, bearer, settings):
    """At the default 10/hour: the throttle reads its rate once, at import."""
    settings.COMMENTS_MAX_PENDING = 20
    for n in range(10):
        assert _post(client, bearer, body=f"#{n}").status_code == 201

    assert _post(client, bearer, body="One too many").status_code == 429


def test_an_author_reads_their_pending_comments(client, bearer):
    _post(client, bearer, body="Mine")

    response = client.get(f"{BASE}/mine", {"target_type": "tool", "slug": TOOL}, **bearer)

    assert [row["body"] for row in response.json()] == ["Mine"]


def test_an_author_can_edit(client, bearer):
    comment_id = _post(client, bearer, body="Typo").json()["id"]

    response = client.patch(
        f"{BASE}/{comment_id}", {"body": "Fixed"}, content_type="application/json", **bearer
    )

    assert (response.status_code, response.json()["body"]) == (200, "Fixed")


def test_editing_someone_elses_comment_is_not_found(client, bearer, staff_bearer):
    comment_id = _post(client, staff_bearer, body="Mine").json()["id"]

    response = client.patch(
        f"{BASE}/{comment_id}", {"body": "Yours"}, content_type="application/json", **bearer
    )

    assert response.status_code == 404


def test_an_author_can_delete(client, bearer):
    comment_id = _post(client, bearer, body="Oops").json()["id"]

    response = client.delete(f"{BASE}/{comment_id}", **bearer)

    assert response.status_code == 204
    assert Comment.objects.get(pk=comment_id).status == CommentStatus.REMOVED


# --- Staff ---------------------------------------------------------------------


def test_the_staff_queue_refuses_a_reader_with_403(client, bearer):
    assert client.get(f"{STAFF}/", **bearer).status_code == 403


def test_staff_read_the_queue(client, bearer, staff_bearer):
    _post(client, bearer, body="Waiting")

    response = client.get(f"{STAFF}/", {"status": "pending"}, **staff_bearer)

    assert response.json()["count"] == 1
    assert response.json()["items"][0]["target_title"] == "PDF Redaction"


def test_staff_review_a_comment(client, bearer, staff_bearer):
    comment_id = _post(client, bearer, body="Waiting").json()["id"]

    response = client.post(
        f"{STAFF}/{comment_id}/review",
        {"status": "published"},
        content_type="application/json",
        **staff_bearer,
    )

    assert (response.status_code, response.json()["status"]) == (200, "published")
    assert client.get(f"{BASE}/tool/{TOOL}").json()[0]["body"] == "Waiting"


def test_a_bad_review_reaches_staff_as_detail(client, staff_bearer):
    response = client.post(
        f"{STAFF}/999999/review",
        {"status": "published"},
        content_type="application/json",
        **staff_bearer,
    )

    assert response.status_code == 422


def test_staff_switch_auto_approve(client, bearer, staff_bearer):
    response = client.patch(
        f"{STAFF}/settings",
        {"auto_approve": True},
        content_type="application/json",
        **staff_bearer,
    )

    assert response.json() == {"auto_approve": True, "trusted_after": 3}
    assert client.get(f"{STAFF}/settings", **staff_bearer).json()["auto_approve"] is True
    assert _post(client, bearer, body="Instant").json()["status"] == "published"
