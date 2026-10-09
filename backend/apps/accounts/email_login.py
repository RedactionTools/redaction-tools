"""Signing in by email: one message with a six-digit code and a link.

Transport-free, like `cli_login.py`: the routes in `api.py` call these and map
`EmailLoginError` to HTTP. A successful sign-in ends in the same JWT pair Google's
does (`jwt.issue_token_pair`), so the frontend refreshes both the same way.

The mail is sent in the request, never queued: django-q keeps task arguments in the
database, which would store the raw code and link.
"""

import hashlib
import secrets
from datetime import timedelta
from urllib.parse import urlencode

from allauth.account.models import EmailAddress
from allauth.account.signals import user_signed_up
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import EmailLogin
from apps.core.email import send_templated_email

LIFETIME = timedelta(minutes=15)
# Wrong codes before the row is dead. Six digits against five guesses is 1 in 200,000.
MAX_ATTEMPTS = 5
# Per address, between mails: what stops the form being used to flood one inbox.
COOLDOWN = timedelta(seconds=60)
DEFAULT_NEXT = "/account"


class InvalidAddress(Exception):
    """The address is malformed - the one refusal requesting may give."""


class EmailLoginError(Exception):
    """Any failure to sign in. One message for all of them, so none leaks which."""

    def __init__(self):
        super().__init__("That code or link is wrong or has expired. Request a new one.")


def request_login(email, next_path=""):
    """Mail a code and a link to `email`. Says nothing about whether it has an account."""
    email = email.strip().lower()
    try:
        validate_email(email)
    except ValidationError as exc:
        raise InvalidAddress("Enter a valid email address.") from exc
    recent = timezone.now() - COOLDOWN
    if EmailLogin.objects.filter(email=email, created_at__gt=recent).exists():
        return
    if get_user_model().objects.filter(email__iexact=email, is_active=False).exists():
        return
    code = f"{secrets.randbelow(1_000_000):06d}"
    link = secrets.token_urlsafe(32)
    # One transaction with the send: a mail that never left must not start the cooldown.
    with transaction.atomic():
        # Only the newest mail works: an older one left in an inbox is one more to steal.
        EmailLogin.objects.filter(email=email, used_at__isnull=True).update(used_at=timezone.now())
        EmailLogin.objects.create(
            email=email,
            code_hash=_hash(code),
            link_hash=_hash(link),
            expires_at=timezone.now() + LIFETIME,
        )
        send_templated_email(
            "login_link",
            {
                "code": code,
                "link": _link_url(link, next_path),
                "ttl_minutes": int(LIFETIME.total_seconds() // 60),
            },
            to=[email],
        )


def confirm_with_code(email, code):
    """Sign in with the code. Returns the user or raises `EmailLoginError`."""
    with transaction.atomic():
        login = _open().filter(email=email.strip().lower(), attempts__lt=MAX_ATTEMPTS).first()
        if login is not None and secrets.compare_digest(login.code_hash, _hash(code.strip())):
            return _sign_in(login)
        if login is not None:
            # Committed, not raised inside the transaction: a rollback would undo the count.
            login.attempts += 1
            login.save(update_fields=["attempts"])
    raise EmailLoginError()


def confirm_with_link(token):
    """Sign in with the link's token, on any device. Same return as `confirm_with_code`."""
    with transaction.atomic():
        login = _open().filter(link_hash=_hash(token.strip())).first()
        if login is None:
            raise EmailLoginError()
        return _sign_in(login)


def _open():
    """Rows that can still sign someone in, locked for the rest of the transaction."""
    return EmailLogin.objects.select_for_update().filter(
        used_at__isnull=True, expires_at__gt=timezone.now()
    )


def _sign_in(login):
    user = get_user_model().objects.filter(email__iexact=login.email).first()
    if user is not None and not user.is_active:
        raise EmailLoginError()
    login.used_at = timezone.now()
    login.save(update_fields=["used_at"])
    if user is None:
        user = get_user_model().objects.create_user(login.email)
        # The signal a Google sign-up sends, so the welcome mail goes out the same way.
        user_signed_up.send(sender=type(user), request=None, user=user)
    _mark_verified(user)
    return user


def _mark_verified(user):
    """Record what the mail just proved. allauth connects a later Google sign-in with the
    same address to this account only through a verified `EmailAddress`."""
    address = EmailAddress.objects.filter(user=user, email__iexact=user.email).first()
    if address is None:
        address = EmailAddress(user=user, email=user.email)
    address.verified = True
    if not EmailAddress.objects.filter(user=user, primary=True).exclude(pk=address.pk).exists():
        address.primary = True
    address.save()


def _link_url(link, next_path):
    query = urlencode({"token": link, "next": _safe_next(next_path)})
    return f"{settings.FRONTEND_URL}/auth/email/verify?{query}"


def _safe_next(path):
    """A path on this site, or the account page: the link must not bounce anyone elsewhere."""
    path = (path or "").strip()
    if not path.startswith("/") or path.startswith(("//", "/\\")):
        return DEFAULT_NEXT
    return path


def _hash(secret):
    return hashlib.sha256(secret.encode()).hexdigest()
