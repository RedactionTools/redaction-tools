"""The device-code sign-in behind `pdfredeval login`.

Transport-free, like `catalog/staff.py`: the routes in `api.py` call these and map
`CliLoginError` to HTTP. The key the flow ends with is an ordinary ninja_apikey key,
labelled with the machine it went to, so it is listed and revoked on /account like
any other.
"""

import hashlib
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from ninja_apikey.models import APIKey
from ninja_apikey.security import generate_key

from apps.accounts.models import CliLogin, CliLoginStatus

# Long enough to find the browser, sign in with Google and approve; short enough that
# an abandoned code is dead before anyone could find a use for it.
LIFETIME = timedelta(minutes=10)
POLL_INTERVAL_SECONDS = 5

# Consonants only, as RFC 8628 suggests: no vowels means no accidental words, and none
# of 0/O, 1/I/L to misread off a terminal.
USER_CODE_ALPHABET = "BCDFGHJKMNPQRSTVWXZ"


class CliLoginError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def start(client_name):
    """Open a login. Returns `(login, device_code)`; the device code is not stored."""
    device_code = secrets.token_urlsafe(32)
    login = CliLogin.objects.create(
        device_code_hash=_hash(device_code),
        user_code=_new_user_code(),
        client_name=client_name.strip()[:80] or "unnamed machine",
        expires_at=timezone.now() + LIFETIME,
    )
    return login, device_code


def verification_url():
    return f"{settings.FRONTEND_URL}/cli/login"


def find(user_code):
    """The pending login a person typed the code of, however they typed it."""
    login = CliLogin.objects.filter(user_code=normalize(user_code)).order_by("-created_at").first()
    if login is None:
        raise CliLoginError(404, "No sign-in with that code. Check it against your terminal.")
    return login


def decide(user_code, *, user, approve):
    """Approve or deny a pending login, as the signed-in `user`."""
    with transaction.atomic():
        login = CliLogin.objects.select_for_update().get(pk=find(user_code).pk)
        if login.expired:
            raise CliLoginError(410, "That code has expired. Run `pdfredeval login` again.")
        if login.status != CliLoginStatus.PENDING:
            raise CliLoginError(409, f"That sign-in was already {login.status}.")
        if approve:
            live = APIKey.objects.filter(user=user, revoked=False).count()
            if live >= settings.MAX_API_KEYS_PER_USER:
                raise CliLoginError(
                    409, f"You already hold {live} API keys. Revoke one on /account first."
                )
        login.user = user
        login.status = CliLoginStatus.APPROVED if approve else CliLoginStatus.DENIED
        login.save(update_fields=["user", "status"])
        return login


def redeem(device_code):
    """What a poll gets: a status, and on the first poll after approval, the key."""
    with transaction.atomic():
        login = (
            # `of=self`: the user join is nullable, and Postgres will not lock that side.
            CliLogin.objects.select_for_update(of=("self",))
            .filter(device_code_hash=_hash(device_code))
            .select_related("user")
            .first()
        )
        if login is None:
            raise CliLoginError(404, "Unknown sign-in. Run `pdfredeval login` again.")
        if login.status == CliLoginStatus.PENDING:
            return {"status": "expired" if login.expired else "pending"}
        if login.status != CliLoginStatus.APPROVED:
            return {"status": login.status}

        # Issued exactly once: the row moves to consumed in the same transaction, so a
        # second poll - or a replayed one - gets a status and no key.
        generated = generate_key()
        APIKey.objects.create(
            prefix=generated.prefix,
            hashed_key=generated.hashed_key,
            user=login.user,
            label=f"pdfredeval · {login.client_name}"[:40],
        )
        login.status = CliLoginStatus.CONSUMED
        login.save(update_fields=["status"])
        return {
            "status": "approved",
            "key": f"{generated.prefix}.{generated.key}",
            "user": {"name": login.user.name, "email": login.user.email},
        }


def normalize(user_code):
    letters = re.sub(r"[^A-Z]", "", user_code.upper())
    return f"{letters[:4]}-{letters[4:8]}"


def _new_user_code():
    letters = "".join(secrets.choice(USER_CODE_ALPHABET) for _ in range(8))
    return f"{letters[:4]}-{letters[4:]}"


def _hash(device_code):
    return hashlib.sha256(device_code.encode()).hexdigest()
