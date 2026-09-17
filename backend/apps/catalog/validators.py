"""Reject URLs that point back into our own infrastructure.

An approved `pricing_url` eventually becomes a `CrawlSource` the worker fetches
server-side from inside the compose network, so a URL that gets past review is a
server-side request forgery primitive. Staff approval cannot be the only control:
a reviewer is deciding whether a tool belongs in the catalog, not parsing an IP
literal.

DNS is resolved rather than pattern-matched, because `internal.example.com`
pointing at 10.0.0.5 is exactly the case a string check misses.
"""

import ipaddress
import socket
from urllib.parse import urlparse

from django.conf import settings
from django.core.exceptions import ValidationError

BLOCKED_NETWORKS = [
    ipaddress.ip_network(network)
    for network in (
        "0.0.0.0/8",
        "10.0.0.0/8",
        "100.64.0.0/10",
        "127.0.0.0/8",
        "169.254.0.0/16",
        "172.16.0.0/12",
        "192.0.0.0/24",
        "192.168.0.0/16",
        "198.18.0.0/15",
        "224.0.0.0/4",
        "240.0.0.0/4",
        "::1/128",
        "fc00::/7",
        "fe80::/10",
        "::ffff:0:0/96",
    )
]


def _is_blocked(address: str) -> bool:
    try:
        ip = ipaddress.ip_address(address)
    except ValueError:
        return True
    return any(ip in network for network in BLOCKED_NETWORKS)


def validate_external_url(value: str) -> None:
    """Reject anything that is not a publicly routable http(s) URL."""
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https"):
        raise ValidationError("Only http and https URLs are accepted.")

    host = (parsed.hostname or "").lower()
    if not host:
        raise ValidationError("That URL has no host.")
    if host in {blocked.lower() for blocked in settings.CATALOG_BLOCKED_HOSTS}:
        raise ValidationError("That host is not allowed.")

    try:
        resolved = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise ValidationError("That host could not be resolved.") from exc

    # Every A/AAAA record has to be public: one private answer is enough to reach
    # an internal service, and which record wins at connect time is not ours.
    if any(_is_blocked(info[4][0]) for info in resolved):
        raise ValidationError("That URL resolves to a non-public address.")


def validate_logo_url(value: str) -> None:
    """A logo is either re-hosted here or fetched from a public origin.

    Vendor logos are copied into `public/images/tools/` rather than hotlinked, so
    a site-relative path is the normal case; an absolute URL still has to clear
    the SSRF guard, because logos are fetched server-side when they are imported.
    """
    if value.startswith("/") and not value.startswith("//"):
        return
    validate_external_url(value)
