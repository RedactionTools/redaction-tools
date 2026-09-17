"""Verifying that a claimant controls the vendor's domain."""

import hashlib
import logging
import secrets
from urllib.parse import urlparse

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from apps.catalog.models import ToolClaimCode

logger = logging.getLogger(__name__)

CODE_TTL_MINUTES = 30

# A claim from one of these is never auto-matched: anyone can hold one, so it
# says nothing about employment.
FREEMAIL_DOMAINS = frozenset(
    {
        "gmail.com",
        "googlemail.com",
        "outlook.com",
        "hotmail.com",
        "live.com",
        "yahoo.com",
        "ymail.com",
        "proton.me",
        "protonmail.com",
        "icloud.com",
        "me.com",
        "aol.com",
        "gmx.com",
        "gmx.net",
        "mail.com",
        "zoho.com",
        "yandex.ru",
        "qq.com",
    }
)


def normalize_host(url_or_email: str) -> str:
    value = (url_or_email or "").strip().lower()
    if "@" in value and "://" not in value:
        return value.rsplit("@", 1)[-1]
    return (urlparse(value).hostname or "").removeprefix("www.")


def domain_matches(work_email: str, homepage_url: str) -> bool:
    """Whether the address is on the tool's own domain.

    Exact-host comparison rather than public-suffix parsing: it avoids a
    dependency, and the false negatives - vendor mail on a different domain from
    the marketing site, which is common - land in manual review with the evidence
    field, which is where a human belongs anyway.
    """
    host = normalize_host(homepage_url)
    domain = (work_email or "").rsplit("@", 1)[-1].lower()
    if not host or not domain or domain in FREEMAIL_DOMAINS:
        return False
    return domain == host or host.endswith(f".{domain}")


def hash_code(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def issue_claim_code(claim) -> str:
    """Mint a code, store only its hash, and email the claimant. Returns the raw code."""
    raw = f"{secrets.randbelow(1_000_000):06d}"
    ToolClaimCode.objects.create(
        claim=claim,
        code_hash=hash_code(raw),
        expires_at=timezone.now() + timezone.timedelta(minutes=CODE_TTL_MINUTES),
    )

    try:
        send_mail(
            subject=f"Your code to claim {claim.tool.name}",
            message=(
                f"Your verification code is {raw}.\n\n"
                f"It confirms you can receive mail at {claim.work_email} and expires in "
                f"{CODE_TTL_MINUTES} minutes. It is not a sign-in code and cannot be used "
                "to access an account.\n\n"
                "A member of our team reviews every claim before any listing changes hands."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[claim.work_email],
        )
    except Exception:
        logger.exception("Could not email a claim code for claim %s", claim.pk)

    return raw


def verify_claim_code(claim, raw: str) -> bool:
    """Check a submitted code against this claim, consuming it on success.

    Scoped to the claim rather than the address: a code issued for one claim must
    never unlock another that the same person filed.
    """
    code = claim.codes.order_by("-created_at").first()
    if code is None or not code.is_usable():
        return False

    if not secrets.compare_digest(code.code_hash, hash_code(raw or "")):
        ToolClaimCode.objects.filter(pk=code.pk).update(attempts=code.attempts + 1)
        return False

    ToolClaimCode.objects.filter(pk=code.pk).update(used_at=timezone.now())
    return True
