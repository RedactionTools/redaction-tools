"""Plans, prices and where a price came from."""

import pytest
from django.db.utils import IntegrityError

from apps.catalog.models import (
    BillingPeriod,
    Plan,
    PlanLimit,
    PlanPrice,
    PriceSource,
    PriceUnit,
    Tool,
    Vendor,
)


@pytest.fixture
def tool(db):
    vendor = Vendor.objects.create(name="Acme", slug="acme", website_url="https://93.184.216.34/")
    return Tool.objects.create(
        vendor=vendor,
        name="Acme Redact",
        slug="acme-redact",
        website_url="https://93.184.216.34/",
    )


def test_pricing_meta_and_str():
    plan = Plan(name="Pro", code="pro")

    assert Plan._meta.db_table == "catalog_plan"
    assert PlanPrice._meta.db_table == "catalog_plan_price"
    assert PlanLimit._meta.db_table == "catalog_plan_limit"
    assert Plan._meta.ordering == ["tool", "tier_order"]
    assert str(plan) == "Pro"


def test_video_and_audio_pricing_has_a_unit():
    """Per-minute pricing is how footage redaction is sold; folding it into
    `credit` would make the entry-price comparison meaningless."""
    assert PriceUnit.MINUTE in PriceUnit.values


@pytest.mark.django_db
def test_only_one_current_price_per_plan_currency_and_period(tool):
    plan = Plan.objects.create(tool=tool, name="Pro", code="pro")
    PlanPrice.objects.create(
        plan=plan,
        amount="15.00",
        currency="USD",
        unit=PriceUnit.MONTH,
        billing_period=BillingPeriod.MONTHLY,
    )

    with pytest.raises(IntegrityError):
        PlanPrice.objects.create(
            plan=plan,
            amount="19.00",
            currency="USD",
            unit=PriceUnit.MONTH,
            billing_period=BillingPeriod.MONTHLY,
        )


@pytest.mark.django_db
def test_a_non_crawler_price_pins_itself(tool):
    """A staff or vendor figure is authoritative by default; forgetting the
    checkbox must not silently hand the row back to the crawler."""
    plan = Plan.objects.create(tool=tool, name="Pro", code="pro")

    price = PlanPrice.objects.create(
        plan=plan,
        amount="15.00",
        unit=PriceUnit.MONTH,
        billing_period=BillingPeriod.MONTHLY,
        source=PriceSource.MANUAL,
    )

    assert price.is_pinned is True


@pytest.mark.django_db
def test_a_crawled_price_does_not_pin_itself(tool):
    plan = Plan.objects.create(tool=tool, name="Pro", code="pro")

    price = PlanPrice.objects.create(
        plan=plan,
        amount="15.00",
        unit=PriceUnit.MONTH,
        billing_period=BillingPeriod.MONTHLY,
        source=PriceSource.CRAWLER,
    )

    assert price.is_pinned is False
