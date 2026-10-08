"""Transactional email rendered from templates in the repo.

Each message is a folder, `templates/email/<name>/`, holding `subject.txt`,
`body.txt`, `body.mjml` and `body.html`. The HTML is compiled from the MJML by
`make backend-emails` and committed; never edit it by hand. The text part is what a
plain-text client or a spam filter reads, so it is written, not derived.
`preview.json` holds sample data for `make backend-email`. Delivery is whatever
`MAILERS` selects (see config/mail.py).
"""

from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

EMAIL_TEMPLATE_DIR = Path(__file__).parent / "templates" / "email"


def email_names() -> list[str]:
    """Every email there is. Folders starting with `_` hold shared MJML partials."""
    return sorted(
        path.name
        for path in EMAIL_TEMPLATE_DIR.iterdir()
        if path.is_dir() and not path.name.startswith("_")
    )


def send_templated_email(
    name: str, context: dict, *, to: list[str], headers: dict[str, str] | None = None
) -> None:
    context = {"site_url": settings.FRONTEND_URL, **context}
    folder = f"email/{name}"

    # Headers cannot carry a newline, and a template's trailing one is easy to leave.
    subject = " ".join(render_to_string(f"{folder}/subject.txt", context).split())

    message = EmailMultiAlternatives(
        subject=subject,
        body=render_to_string(f"{folder}/body.txt", context),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=to,
        headers=headers,
    )
    message.attach_alternative(render_to_string(f"{folder}/body.html", context), "text/html")
    message.send()


def staff_addresses() -> list[str]:
    """Where staff notices go: every active staff account."""
    return list(
        get_user_model()
        .objects.filter(is_staff=True, is_active=True)
        .order_by("email")
        .values_list("email", flat=True)
    )
