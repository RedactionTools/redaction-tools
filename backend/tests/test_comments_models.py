"""The comment table and the moderation settings row."""

import pytest
from django.db import IntegrityError

from apps.catalog.models import Tool
from apps.comments.models import Comment, CommentSettings, CommentStatus

pytestmark = pytest.mark.django_db


def test_a_comment_starts_pending(user):
    comment = Comment.objects.create(
        tool=Tool.objects.get(slug="pdf-redaction"), author=user, body="Useful."
    )

    assert comment.status == CommentStatus.PENDING


def test_a_comment_needs_a_target(user):
    with pytest.raises(IntegrityError):
        Comment.objects.create(author=user, body="On nothing.")


def test_a_comment_cannot_have_two_targets(user):
    with pytest.raises(IntegrityError):
        Comment.objects.create(
            tool=Tool.objects.get(slug="pdf-redaction"),
            blog_slug="introducing-redaction-tools",
            author=user,
            body="On both.",
        )


def test_the_settings_row_exists_from_the_migration():
    settings = CommentSettings.load()

    assert (settings.pk, settings.auto_approve, settings.trusted_after) == (1, False, 3)
    assert CommentSettings.objects.count() == 1
