"""Exchange rates, so plans priced in different currencies can be compared.

The rates are the ECB's daily euro reference rates. Everything a reader sees in
another currency is converted with them and marked as such; the published price
itself is never rewritten.
"""

import datetime
from decimal import Decimal

import pytest

from apps.catalog import exchange_rates
from apps.catalog.exchange_rates import parse_ecb_daily, refresh_exchange_rates
from apps.catalog.models import ExchangeRate

ECB_DAILY = b"""<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01"
    xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <gesmes:subject>Reference rates</gesmes:subject>
  <gesmes:Sender><gesmes:name>European Central Bank</gesmes:name></gesmes:Sender>
  <Cube>
    <Cube time="2026-09-25">
      <Cube currency="USD" rate="1.0850"/>
      <Cube currency="GBP" rate="0.86045"/>
    </Cube>
  </Cube>
</gesmes:Envelope>
"""


def test_parses_the_ecb_daily_feed_with_the_euro_as_one():
    as_of, rates = parse_ecb_daily(ECB_DAILY)

    assert as_of == datetime.date(2026, 9, 25)
    assert rates == {"EUR": Decimal("1"), "USD": Decimal("1.0850"), "GBP": Decimal("0.86045")}


@pytest.mark.django_db
def test_refresh_stores_the_feed_and_replaces_yesterdays_rates(monkeypatch):
    ExchangeRate.objects.create(currency="JPY", per_eur="160", as_of=datetime.date(2026, 9, 24))
    ExchangeRate.objects.create(currency="USD", per_eur="1.07", as_of=datetime.date(2026, 9, 24))
    monkeypatch.setattr(exchange_rates, "fetch_ecb_daily", lambda: ECB_DAILY)

    refresh_exchange_rates()

    stored = {rate.currency: (rate.per_eur, rate.as_of) for rate in ExchangeRate.objects.all()}
    day = datetime.date(2026, 9, 25)
    assert stored == {
        "EUR": (Decimal("1"), day),
        "USD": (Decimal("1.0850"), day),
        # Five decimals, as the ECB quotes it: none may be rounded away.
        "GBP": (Decimal("0.86045"), day),
    }


@pytest.mark.django_db
def test_refresh_is_scheduled_daily_on_the_qcluster():
    from django_q.models import Schedule

    schedule = Schedule.objects.get(name="catalog-exchange-rates")

    assert schedule.func == "apps.catalog.exchange_rates.refresh_exchange_rates"
    assert schedule.schedule_type == Schedule.DAILY


RATES_URL = "/api/v1/catalog/exchange-rates"


@pytest.mark.django_db
def test_the_api_serves_the_rates_per_euro_with_their_date(client):
    day = datetime.date(2026, 9, 25)
    ExchangeRate.objects.create(currency="EUR", per_eur="1", as_of=day)
    ExchangeRate.objects.create(currency="USD", per_eur="1.0850", as_of=day)

    response = client.get(RATES_URL)

    assert response.status_code == 200
    assert response.json() == {
        "base": "EUR",
        "as_of": "2026-09-25",
        "rates": {"EUR": "1.000000", "USD": "1.085000"},
    }


@pytest.mark.django_db
def test_the_api_says_so_before_the_first_refresh(client):
    assert client.get(RATES_URL).json() == {"base": "EUR", "as_of": None, "rates": {}}
