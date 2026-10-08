"""Mail sent about the catalog: a receipt and a staff notice for each tool submission, and
the badge suggestion staff send a listing's maintainers."""

from django.db import transaction

from apps.catalog.models import Tool, ToolSubmission
from apps.core.email import send_templated_email, staff_addresses


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
    staff = staff_addresses()
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


def queue_badge_suggestions(tool, addresses):
    """Queue one badge suggestion per maintainer once the request commits.

    One task each, so a retry cannot resend to someone already mailed and no
    maintainer sees another's address.
    """
    from django_q.tasks import async_task

    def queue():
        for address in addresses:
            async_task(
                "apps.catalog.emails.send_badge_suggestion",
                tool.pk,
                address,
                task_name=f"badge suggestion {tool.slug} {address}",
            )

    transaction.on_commit(queue)


def send_badge_suggestion(tool_pk, address):
    tool = Tool.objects.get(pk=tool_pk)
    send_templated_email("badge_suggestion", {"tool_name": tool.name}, to=[address])
