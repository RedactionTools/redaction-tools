"""The staff notice for each guest post. Queued, so the writer's request never waits
on or fails with the mail provider."""

from django.conf import settings
from django.db import transaction
from django.urls import reverse
from django.utils.text import Truncator

from apps.blog.models import PostSubmission
from apps.core.email import send_templated_email, staff_addresses

EXCERPT_CHARS = 600


def queue_staff_notice(submission):
    from django_q.tasks import async_task

    # The pk, never the row: django-q keeps task arguments in the database.
    transaction.on_commit(
        lambda: async_task(
            "apps.blog.emails.send_staff_notice",
            submission.pk,
            task_name=f"post submission notice {submission.pk}",
        )
    )


def send_staff_notice(submission_pk):
    staff = staff_addresses()
    if not staff:
        return

    submission = PostSubmission.objects.select_related("submitted_by").get(pk=submission_pk)
    send_templated_email(
        "post_submission_staff_notice",
        {
            "title": submission.title,
            "description": submission.description,
            "author_name": submission.author_name,
            "author_role": submission.author_role,
            "tags": ", ".join(submission.tags),
            "excerpt": Truncator(submission.body_md).chars(EXCERPT_CHARS),
            "submitter_email": submission.submitted_by.email,
            "admin_url": settings.BACKEND_URL
            + reverse("admin:blog_postsubmission_change", args=[submission.pk]),
        },
        to=staff,
    )
