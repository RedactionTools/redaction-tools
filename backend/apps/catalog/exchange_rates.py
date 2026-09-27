"""The ECB's daily euro reference rates, so plans in different currencies compare.

A vendor's published price is never rewritten: these rates only let a reader see
a figure in their own currency, marked as converted and dated.
"""

import datetime
import urllib.request
from decimal import Decimal
from xml.etree import ElementTree

from django.db import transaction

from apps.catalog.models import ExchangeRate

ECB_DAILY_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
NAMESPACE = "{http://www.ecb.int/vocabulary/2002-08-01/eurofxref}"


def parse_ecb_daily(body: bytes) -> tuple[datetime.date, dict[str, Decimal]]:
    """The feed's date and its rates per euro, with the euro itself as one."""
    # A fixed, trusted source over TLS; the stdlib parser resolves no external entities.
    root = ElementTree.fromstring(body)  # noqa: S314
    day = root.find(f"{NAMESPACE}Cube/{NAMESPACE}Cube[@time]")
    if day is None:
        raise ValueError("The ECB feed carries no dated rates.")

    rates = {"EUR": Decimal("1")}
    for cube in day.findall(f"{NAMESPACE}Cube"):
        rates[cube.attrib["currency"]] = Decimal(cube.attrib["rate"])
    return datetime.date.fromisoformat(day.attrib["time"]), rates


def fetch_ecb_daily() -> bytes:
    with urllib.request.urlopen(ECB_DAILY_URL, timeout=30) as response:
        return response.read()


@transaction.atomic
def refresh_exchange_rates() -> None:
    """Replace the stored rates with today's feed. Scheduled daily on the qcluster.

    A currency the ECB stops quoting is dropped rather than left at a stale rate.
    """
    as_of, rates = parse_ecb_daily(fetch_ecb_daily())
    ExchangeRate.objects.exclude(currency__in=rates).delete()
    for currency, per_eur in rates.items():
        ExchangeRate.objects.update_or_create(
            currency=currency, defaults={"per_eur": per_eur, "as_of": as_of}
        )
