"""Mail sent about the catalog: a receipt and a staff notice for each tool submission."""

from django.contrib.auth import get_user_model
from django.db import transaction

from apps.catalog.models import ToolSubmission
from apps.core.email import send_templated_email


def queue_submission_emails(submission, *, admin_url):
    """Queue both emails once the submission has committed.

    Queued, so the submitter's request never waits on or fails with the mail
    provider; two tasks, so a retried staff notice cannot resend the receipt.
    """
    from django_q.tasks import async_task

    def queue():
        async_task(
            "apps.catalog.emails.send_submission_receipt",
            submission.pk,
            task_name=f"submission receipt {submission.pk}",
        )
        async_task(
            "apps.catalog.emails.send_submission_notice",
            submission.pk,
            admin_url,
            task_name=f"submission notice {submission.pk}",
        )

    transaction.on_commit(queue)


def send_submission_receipt(submission_pk):
    submission = ToolSubmission.objects.select_related("submitted_by").get(pk=submission_pk)
    send_templated_email(
        "submission_received",
        {"name": submission.name, "homepage_url": submission.homepage_url},
        to=[submission.contact_email or submission.submitted_by.email],
    )


def send_submission_notice(submission_pk, admin_url):
    staff = list(
        get_user_model()
        .objects.filter(is_staff=True, is_active=True)
        .order_by("email")
        .values_list("email", flat=True)
    )
    if not staff:
        return

    submission = ToolSubmission.objects.select_related("submitted_by").get(pk=submission_pk)
    send_templated_email(
        "submission_staff_notice",
        {
            "name": submission.name,
            "vendor_name": submission.vendor_name,
            "homepage_url": submission.homepage_url,
            "pricing_url": submission.pricing_url,
            "description": submission.description,
            "notes": submission.notes,
            "submitter_email": submission.submitted_by.email,
            "contact_email": submission.contact_email,
            "submitter_is_owner": submission.submitter_is_owner,
            "admin_url": admin_url,
        },
        to=staff,
    )
