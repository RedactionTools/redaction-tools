"""Verifying that a claimant controls the vendor's domain."""

import hashlib
import logging
import secrets
from urllib.parse import urlparse

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.catalog.models import ToolClaim, ToolClaimCode, ToolClaimInvite, ToolClaimStatus
from apps.core.email import send_templated_email

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
        send_templated_email(
            "claim_code",
            {
                "tool_name": claim.tool.name,
                "code": raw,
                "email": claim.work_email,
                "ttl_minutes": CODE_TTL_MINUTES,
            },
            to=[claim.work_email],
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


# --- Staff invites -----------------------------------------------------------


class InviteUnavailable(Exception):
    """The link is unknown, revoked, or already used by someone else."""


def issue_claim_invite(*, tool, email, user):
    """Mint a one-time claim link. Returns the row and the URL, which is never stored."""
    raw = secrets.token_urlsafe(32)
    invite = ToolClaimInvite.objects.create(
        tool=tool, email=email, token_hash=hash_code(raw), created_by=user
    )
    return invite, f"{settings.FRONTEND_URL}/claim/{raw}"


def find_claim_invite(raw):
    """The live invite behind a link, or None. A revoked one is as good as unknown."""
    return (
        ToolClaimInvite.objects.select_related("tool")
        .filter(token_hash=hash_code(raw or ""), revoked_at__isnull=True)
        .first()
    )


@transaction.atomic
def redeem_claim_invite(raw, user):
    """Grant the invite's listing to `user`, once. Returns the approved claim.

    The row is locked so two people opening the link at the same moment cannot
    both win. Reopening your own redeemed link returns the same claim rather than
    an error: owners click an email twice.
    """
    invite = (
        ToolClaimInvite.objects.select_for_update(of=("self",))
        .select_related("tool", "claim")
        .filter(token_hash=hash_code(raw or ""), revoked_at__isnull=True)
        .first()
    )
    if invite is None:
        raise InviteUnavailable("This claim link is not valid.")
    if invite.redeemed_at is not None:
        if invite.redeemed_by_id == user.pk and invite.claim is not None:
            return invite.claim
        raise InviteUnavailable("This claim link has already been used.")

    now = timezone.now()
    # A person who already filed a claim the ordinary way has it approved, not
    # duplicated: one claim per person per tool is a database constraint. Either
    # way the claim records the address staff vouched for, not the one typed in.
    claim, _ = ToolClaim.objects.update_or_create(
        tool=invite.tool,
        user=user,
        defaults={
            "work_email": invite.email,
            "email_domain": invite.email.rsplit("@", 1)[-1].lower(),
            "domain_matched": domain_matches(invite.email, invite.tool.website_url),
            "status": ToolClaimStatus.APPROVED,
            "email_verified_at": now,
            "reviewed_by": invite.created_by,
            "reviewed_at": now,
            "admin_comment": f"Approved by staff claim link #{invite.pk}.",
        },
    )

    invite.redeemed_at = now
    invite.redeemed_by = user
    invite.claim = claim
    invite.save(update_fields=["redeemed_at", "redeemed_by", "claim", "updated_at"])
    return claim
