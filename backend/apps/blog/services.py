"""What a reader may do with a guest post, as plain functions.

Imports no ninja and takes `user` explicitly, like `apps.comments.services`, so the
route only translates. Refusals are `PostSubmissionError`: a 422 `detail`.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.blog import emails
from apps.blog.models import PostSubmission, PostSubmissionStatus
from apps.catalog.staff import StaffError
from apps.catalog.validators import validate_external_url

MAX_LINKS = 3
MAX_TAGS = 8


class PostSubmissionError(StaffError):
    """A submission refused for a reason the writer can act on."""


def _clean_body(body):
    body = body.strip()
    if len(body) < settings.BLOG_SUBMISSION_MIN_LENGTH:
        raise PostSubmissionError(
            f"A post needs at least {settings.BLOG_SUBMISSION_MIN_LENGTH} characters."
        )
    if len(body) > settings.BLOG_SUBMISSION_MAX_LENGTH:
        raise PostSubmissionError(
            f"A post can be at most {settings.BLOG_SUBMISSION_MAX_LENGTH} characters."
        )
    return body


def _clean_tags(tags):
    """Trimmed, with case-insensitive repeats dropped. The first spelling wins."""
    cleaned = {}
    for tag in tags:
        tag = tag.strip()
        if tag:
            cleaned.setdefault(tag.lower(), tag)
    if len(cleaned) > MAX_TAGS:
        raise PostSubmissionError(f"Give at most {MAX_TAGS} tags.")
    return list(cleaned.values())


def _clean_links(links):
    links = [link.strip() for link in links if link.strip()]
    if len(links) > MAX_LINKS:
        raise PostSubmissionError(f"Give at most {MAX_LINKS} author links.")
    for link in links:
        try:
            validate_external_url(link)
        except ValidationError as exc:
            raise PostSubmissionError(f"{link}: {exc.messages[0]}") from exc
    return links


@transaction.atomic
def submit_post(*, user, data, source_ip=None, user_agent=""):
    open_count = PostSubmission.objects.filter(
        submitted_by=user, status=PostSubmissionStatus.PENDING
    ).count()
    if open_count >= settings.BLOG_SUBMISSION_MAX_OPEN:
        raise PostSubmissionError(
            f"You already have {open_count} posts awaiting review. "
            "We will get to them before you send more."
        )
    data = {
        **data,
        "body_md": _clean_body(data["body_md"]),
        "tags": _clean_tags(data.get("tags", [])),
        "author_links": _clean_links(data.get("author_links", [])),
    }
    submission = PostSubmission.objects.create(
        **data, submitted_by=user, source_ip=source_ip, user_agent=user_agent[:512]
    )
    emails.queue_staff_notice(submission)
    return submission


def review(submission, *, user, status):
    """Accept or reject. Either way nothing is published: an editor turns an accepted
    post into MDX by hand."""
    submission.status = status
    submission.reviewed_by = user
    submission.reviewed_at = timezone.now()
    submission.save(update_fields=["status", "reviewed_by", "reviewed_at", "updated_at"])
