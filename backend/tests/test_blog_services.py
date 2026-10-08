"""The rules on a guest post, as functions: what is cleaned, and what is refused."""

import pytest

from apps.blog import services

pytestmark = pytest.mark.django_db

BODY = ("A walkthrough of redacting scanned PDFs. " * 20).strip()


def _submit(user, **overrides):
    data = {
        "title": "Redacting scanned PDFs",
        "description": "What OCR misses and how to check.",
        "body_md": BODY,
        "author_name": "Ada Writer",
    } | overrides
    return services.submit_post(user=user, data=data)


def test_tags_are_trimmed_and_deduplicated(user):
    submission = _submit(user, tags=[" OCR ", "ocr", "", "Guides"])

    assert submission.tags == ["OCR", "Guides"]


def test_more_than_eight_tags_is_refused(user):
    with pytest.raises(services.PostSubmissionError, match="at most 8 tags"):
        _submit(user, tags=[f"tag-{n}" for n in range(9)])


def test_more_than_three_author_links_is_refused(user):
    with pytest.raises(services.PostSubmissionError, match="at most 3 author links"):
        _submit(user, author_links=[f"https://example.com/{n}" for n in range(4)])
