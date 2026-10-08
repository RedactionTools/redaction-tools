"""Staff decide on guest posts in the admin. Accepting publishes nothing - posts are
MDX in the frontend - so the admin also hands the editor a file to start from."""

import pytest

from apps.blog.models import PostSubmission, PostSubmissionStatus

pytestmark = pytest.mark.django_db

CHANGELIST = "/admin/blog/postsubmission/"


@pytest.fixture
def submission(user):
    return PostSubmission.objects.create(
        title="Redacting scanned PDFs",
        description="What OCR misses and how to check.",
        tags=["OCR", "Guides"],
        body_md="## The OCR layer\n\nA scan carries two copies of every word.",
        author_name="Ada Writer",
        submitted_by=user,
    )


def _act(admin_client, action, submission):
    return admin_client.post(
        CHANGELIST, {"action": action, "_selected_action": [str(submission.pk)]}, follow=True
    )


def test_accepting_records_who_decided_and_when(admin_client, staff_user, submission):
    _act(admin_client, "accept_submissions", submission)

    submission.refresh_from_db()
    assert submission.status == PostSubmissionStatus.ACCEPTED
    assert submission.reviewed_by == staff_user
    assert submission.reviewed_at is not None


def test_rejecting_keeps_the_row_so_the_writer_sees_the_outcome(admin_client, submission):
    _act(admin_client, "reject_submissions", submission)

    submission.refresh_from_db()
    assert submission.status == PostSubmissionStatus.REJECTED


def test_the_mdx_export_carries_frontmatter_the_blog_accepts(admin_client, submission):
    response = admin_client.get(f"{CHANGELIST}{submission.pk}/mdx/")

    assert response.status_code == 200
    assert 'filename="redacting-scanned-pdfs.mdx"' in response["Content-Disposition"]
    text = response.content.decode()
    assert text.startswith('---\ntitle: "Redacting scanned PDFs"\n')
    assert 'description: "What OCR misses and how to check."\n' in text
    assert 'tags: ["OCR", "Guides"]\n' in text
    assert "draft: true\n" in text
    assert text.endswith("---\n\n## The OCR layer\n\nA scan carries two copies of every word.\n")


def test_the_change_page_shows_the_body_and_links_the_export(admin_client, submission):
    response = admin_client.get(f"{CHANGELIST}{submission.pk}/change/")

    assert response.status_code == 200
    page = response.content.decode()
    assert "A scan carries two copies of every word." in page
    assert f"{CHANGELIST}{submission.pk}/mdx/" in page
