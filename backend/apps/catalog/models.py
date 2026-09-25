"""Catalog domain models.

Conventions this app introduces to the repo, applied to every model here:
explicit `db_table` prefixed `catalog_`, explicit `Meta.ordering`, an explicit
`__str__`, and `TimeStampedModel` for the created/updated pair.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.catalog.slugs import validate_catalog_slug
from apps.catalog.validators import validate_external_url, validate_logo_url
from apps.core.models import TimeStampedModel


class Vendor(TimeStampedModel):
    """The company behind one or more tools."""

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=80, unique=True)
    website_url = models.URLField(validators=[validate_external_url])
    hq_country = models.CharField(max_length=2, blank=True, help_text="ISO 3166-1 alpha-2.")
    founded_year = models.PositiveSmallIntegerField(null=True, blank=True)
    logo_url = models.CharField(max_length=300, blank=True, validators=[validate_logo_url])
    privacy_policy_url = models.URLField(blank=True, validators=[validate_external_url])
    terms_url = models.URLField(blank=True, validators=[validate_external_url])
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "catalog_vendor"
        ordering = ["name"]

    def __str__(self):
        return self.name


MIN_EDITORIAL_CHARS = 400
REQUIRED_FACET_DIMENSIONS = frozenset({"media", "deployment", "method"})


def listability_blockers(tool):
    """Every reason `tool` is a row rather than a page, cheapest check first.

    A generator on purpose. `is_listable()` takes only the first item, so a
    draft still costs no query - and the public list runs the bar over every
    published tool on every request. Staff tooling drains the whole thing to
    show what is missing. One statement of the bar, two ways of asking it.
    """
    if tool.status != ToolStatus.PUBLISHED:
        yield f"Status is {tool.status}, not published."
    if missing := [f for f in ("name", "website_url", "logo_url") if not getattr(tool, f)]:
        yield f"Missing: {', '.join(missing)}."
    # Vendor copy never counts: a claimed listing must not clear the bar on
    # marketing prose alone.
    if (shortfall := MIN_EDITORIAL_CHARS - len(tool.description_md or "")) > 0:
        yield (
            f"description_md is {shortfall} characters short of "
            f"{MIN_EDITORIAL_CHARS}. Vendor copy does not count toward it."
        )
    dimensions = {facet.value.dimension.code for facet in tool.facets.all()}
    if absent := REQUIRED_FACET_DIMENSIONS - dimensions:
        yield f"No facet on: {', '.join(sorted(absent))}."
    if not tool.has_pricing_position():
        yield (
            "No pricing position: no public plan has a current price, a "
            "free-tier flag or the enterprise-quote flag."
        )


class ToolQuerySet(models.QuerySet):
    def published(self):
        return self.filter(status=ToolStatus.PUBLISHED)

    def owned_by(self, user):
        """Tools this user has an approved, non-revoked claim on."""
        if not user or not user.is_authenticated:
            return self.none()
        return self.filter(claims__user=user, claims__status="approved").distinct()

    def listable(self):
        """Published tools that clear the indexability bar.

        Returns a list, not a queryset: `is_listable()` reads related rows, and
        expressing the whole bar in SQL would duplicate it in two places that
        then drift.
        """
        queryset = self.published().prefetch_related("facets__value__dimension", "plans__prices")
        return [tool for tool in queryset if tool.is_listable()]


class ToolStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"
    ARCHIVED = "archived", "Archived"


class Tool(TimeStampedModel):
    """One redaction tool. `/tool/<slug>/` is its canonical identity site-wide."""

    vendor = models.ForeignKey(Vendor, on_delete=models.PROTECT, related_name="tools")
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=80, unique=True, validators=[validate_catalog_slug])
    status = models.CharField(
        max_length=16, choices=ToolStatus.choices, default=ToolStatus.DRAFT, db_index=True
    )

    website_url = models.URLField(validators=[validate_external_url])
    pricing_url = models.URLField(blank=True, validators=[validate_external_url])
    docs_url = models.URLField(blank=True, validators=[validate_external_url])
    logo_url = models.CharField(
        max_length=300,
        blank=True,
        validators=[validate_logo_url],
        help_text="Site-relative path (preferred) or absolute URL.",
    )
    is_first_party = models.BooleanField(
        default=False, help_text="Our own product - triggers the disclosure banner."
    )

    # Editorial. Held inline rather than in a translation table: this site is
    # English-only and has no i18n anywhere, so a row-per-locale table would be
    # one join and one model for a locale set of exactly one.
    tagline = models.CharField(max_length=255, blank=True)
    summary = models.TextField(blank=True, help_text="40-60 words; the liftable paragraph.")
    description_md = models.TextField(
        blank=True, help_text="Original editorial. Vendor copy never counts toward this."
    )
    vendor_copy_md = models.TextField(blank=True, help_text='Fenced "From the vendor" block.')
    pros = models.JSONField(default=list, blank=True)
    cons = models.JSONField(default=list, blank=True)
    faq = models.JSONField(default=list, blank=True, help_text="[{question, answer}]")

    editor_verdict = models.TextField(blank=True, help_text="Staff only; never owner-editable.")
    editor_notes = models.TextField(blank=True)

    first_seen_at = models.DateField(null=True, blank=True)
    last_verified_at = models.DateTimeField(
        null=True, blank=True, db_index=True, help_text="Last time prices were CHECKED."
    )
    prices_changed_at = models.DateTimeField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Last time a price actually MOVED - drives sitemap lastmod.",
    )
    price_is_stale = models.BooleanField(default=False, db_index=True)
    owner_verified_pricing_at = models.DateTimeField(null=True, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    objects = ToolQuerySet.as_manager()

    class Meta:
        db_table = "catalog_tool"
        ordering = ["sort_order", "name"]
        indexes = [models.Index(fields=["status", "last_verified_at"])]

    def __str__(self):
        return self.name

    @property
    def facet_slugs(self) -> list[str]:
        """The tool's facets, as the slugs the public API and the filters speak.

        A property rather than a serializer helper because `ToolRevision`
        snapshots, diffs and applies a proposal through `getattr`: without it a
        proposed facet list could never be compared against the listing, and
        would read as a conflict every time.
        """
        return sorted(facet.value.slug for facet in self.facets.all())

    def set_facet_slugs(self, slugs) -> None:
        """Replace this tool's facets with exactly `slugs`.

        Rows rather than a column, so it is applied by name rather than by
        `setattr` - a silent no-op there would tell an editor a proposal landed
        when nothing had moved.
        """
        self.facets.exclude(value__slug__in=slugs).delete()
        values = {value.slug: value for value in FacetValue.objects.filter(slug__in=slugs)}
        existing = {facet.value.slug for facet in self.facets.all()}
        ToolFacet.objects.bulk_create(
            [ToolFacet(tool=self, value=values[slug]) for slug in slugs if slug not in existing]
        )

    def is_listable(self):
        """Whether this tool is a page rather than a database row.

        A tool that cannot clear this is excluded from the public API, the
        sitemap and every ItemList. The editorial minimum counts our own
        writing only - vendor copy never satisfies it.
        """
        return next(listability_blockers(self), None) is None

    def has_pricing_position(self):
        """A current price from any source, or an explicit free / quote-only stance.

        Manual entry has to count, or the bar would silently exclude exactly the
        enterprise tools a buyer most wants compared.
        """
        return (
            Plan.objects.filter(tool=self, is_public=True)
            .filter(
                models.Q(prices__is_current=True)
                | models.Q(is_free_tier=True)
                | models.Q(is_enterprise_quote=True)
            )
            .exists()
        )


class FacetDimension(TimeStampedModel):
    """An axis tools are compared on: media, deployment, method, compliance..."""

    code = models.SlugField(unique=True, help_text="media | deployment | method | ...")
    label = models.CharField(max_length=100)
    is_landing_dimension = models.BooleanField(
        default=False, help_text="Whether values here may ever become landing pages."
    )
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "catalog_facet_dimension"
        ordering = ["sort_order", "code"]

    def __str__(self):
        return self.label


class FacetValue(TimeStampedModel):
    dimension = models.ForeignKey(FacetDimension, on_delete=models.CASCADE, related_name="values")
    code = models.SlugField(help_text="pdf | online | ai | hipaa")
    slug = models.SlugField(max_length=80, unique=True, validators=[validate_catalog_slug])
    label = models.CharField(max_length=100)
    is_landing_page = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Phase-3 switch: promotes this facet to /tools/<slug>/. Data, not code.",
    )
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "catalog_facet_value"
        ordering = ["dimension", "sort_order", "code"]
        constraints = [
            models.UniqueConstraint(fields=["dimension", "code"], name="uniq_dimension_code")
        ]

    def __str__(self):
        return f"{self.dimension.label}: {self.label}"


class ToolFacet(TimeStampedModel):
    tool = models.ForeignKey(Tool, on_delete=models.CASCADE, related_name="facets")
    value = models.ForeignKey(FacetValue, on_delete=models.CASCADE, related_name="tools")
    evidence_url = models.URLField(
        blank=True, validators=[validate_external_url], help_text="Where this claim was verified."
    )
    verified_at = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "catalog_tool_facet"
        ordering = ["tool", "value"]
        constraints = [models.UniqueConstraint(fields=["tool", "value"], name="uniq_tool_facet")]
        indexes = [models.Index(fields=["value", "tool"])]

    def __str__(self):
        return f"{self.tool.name} -> {self.value.slug}"


# --- Screenshots -----------------------------------------------------------
# A listing's own pictures, uploaded rather than hotlinked, and rendered into a
# fixed set of widths by `apps.catalog.screenshots`. The rules about pixels live
# in `images.py`, the rules about storage in `screenshots.py`, and this holds
# what the row says about the picture: who supplied it, whether it is published,
# and which renditions were actually written.


# The rendition a bare `src` points at. Not the widest one: that is for a
# desktop figure, and a browser that ignored the srcset would download it on a
# phone.
DISPLAY_WIDTH = 960


class ToolScreenshotStatus(models.TextChoices):
    PENDING = "pending", "Pending review"
    PUBLISHED = "published", "Published"
    REJECTED = "rejected", "Rejected"


class ToolScreenshotSource(models.TextChoices):
    STAFF = "staff", "Our editors"
    VENDOR = "vendor", "The vendor"


class ToolScreenshotQuerySet(models.QuerySet):
    def published(self):
        return self.filter(status=ToolScreenshotStatus.PUBLISHED)


class ToolScreenshot(TimeStampedModel):
    """One picture of a tool, plus the renditions the site serves.

    Content-addressed: `digest` is the SHA-256 of the normalized source, and
    every file for this row sits under a directory named after it. That makes
    the rendition URLs immutable - they can be cached forever, because the bytes
    behind a path can never change - and makes re-uploading the same capture
    idempotent rather than a second copy.
    """

    tool = models.ForeignKey(Tool, on_delete=models.CASCADE, related_name="screenshots")
    image = models.ImageField(
        upload_to="screenshots", help_text="The normalized source. Renditions sit beside it."
    )
    digest = models.CharField(max_length=64, db_index=True, help_text="SHA-256 of the source.")
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    rendition_widths = models.JSONField(
        default=list,
        blank=True,
        help_text="The widths actually written, so a srcset never offers a file that is absent.",
    )

    # Required, not optional: a screenshot with no alt text is an image a screen
    # reader announces as nothing at all, and the caption is not a substitute -
    # it is read as well, and says something different.
    alt_text = models.CharField(max_length=200, help_text="What the picture shows.")
    caption = models.CharField(max_length=300, blank=True, help_text="Shown under the figure.")

    source = models.CharField(max_length=16, choices=ToolScreenshotSource.choices)
    status = models.CharField(
        max_length=16,
        choices=ToolScreenshotStatus.choices,
        default=ToolScreenshotStatus.PENDING,
        db_index=True,
    )
    source_url = models.URLField(
        blank=True,
        validators=[validate_external_url],
        help_text="Where the capture came from, when it was fetched rather than taken.",
    )
    captured_at = models.DateField(
        null=True,
        blank=True,
        help_text="When the interface looked like this. A UI shot goes stale silently.",
    )

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="screenshot_uploads",
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="screenshot_reviews",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.CharField(
        max_length=300, blank=True, help_text="Why it was rejected. The uploader is shown this."
    )
    sort_order = models.PositiveIntegerField(default=0)

    objects = ToolScreenshotQuerySet.as_manager()

    class Meta:
        db_table = "catalog_tool_screenshot"
        ordering = ["tool", "sort_order", "id"]
        constraints = [
            # The same capture twice on one listing is a mistake, not a gallery.
            # Across listings it is legitimate - two tools can be shown side by
            # side in one picture - which is why the digest alone is not unique.
            models.UniqueConstraint(fields=["tool", "digest"], name="uniq_tool_screenshot_digest")
        ]
        indexes = [models.Index(fields=["tool", "status"])]

    def __str__(self):
        return f"{self.tool.name}: {self.alt_text[:60]}"

    @property
    def base_path(self):
        """The directory every file for this screenshot lives in."""
        return f"screenshots/{self.digest}"

    def rendition_path(self, width):
        return f"{self.base_path}/w{width}.webp"

    def rendition_url(self, width):
        return f"{settings.PUBLIC_MEDIA_URL}{self.rendition_path(width)}"

    @property
    def srcset(self):
        """Every rendition that exists, as the attribute an `<img>` takes.

        Built from `rendition_widths` rather than from the declared set, so a
        screenshot narrower than a declared width never advertises a file that
        was not written.
        """
        return ", ".join(f"{self.rendition_url(width)} {width}w" for width in self.rendition_widths)

    @property
    def display_url(self):
        """The one URL to use where a single `src` is all there is.

        The largest rendition that is not a full-width one: a reader whose
        browser ignores `srcset` should get a usable picture, not the 1920.
        """
        widths = self.rendition_widths or [self.width]
        return self.rendition_url(
            max((w for w in widths if w <= DISPLAY_WIDTH), default=min(widths))
        )


class PriceUnit(models.TextChoices):
    MONTH = "month", "Per month"
    YEAR = "year", "Per year"
    SEAT_MONTH = "seat_month", "Per seat per month"
    SEAT_YEAR = "seat_year", "Per seat per year"
    PAGE = "page", "Per page"
    DOCUMENT = "document", "Per document"
    MINUTE = "minute", "Per minute"
    CREDIT = "credit", "Per credit"
    ONE_TIME = "one_time", "One-time"


class BillingPeriod(models.TextChoices):
    MONTHLY = "monthly", "Monthly"
    ANNUAL = "annual", "Annual"
    ONE_TIME = "one_time", "One-time"
    USAGE = "usage", "Usage-based"
    NONE = "none", "None"


class PriceSource(models.TextChoices):
    CRAWLER = "crawler", "Read automatically"
    MANUAL = "manual", "Entered by our editors"
    VENDOR = "vendor", "Supplied by the vendor"


class Plan(TimeStampedModel):
    """One purchasable tier. The free / trial / quote distinction is load-bearing:
    it drives the highest-volume facet, and a 14-day trial is not a free tier."""

    tool = models.ForeignKey(Tool, on_delete=models.CASCADE, related_name="plans")
    name = models.CharField(max_length=120)
    code = models.SlugField(help_text="Stable key; the crawler matches plans on it.")
    tier_order = models.PositiveSmallIntegerField(default=0)

    is_free_tier = models.BooleanField(default=False)
    is_trial = models.BooleanField(default=False, help_text="A trial is NOT a free tier.")
    trial_days = models.PositiveSmallIntegerField(null=True, blank=True)
    is_enterprise_quote = models.BooleanField(
        default=False, help_text='"Contact us" - no published amount.'
    )
    is_public = models.BooleanField(default=True, db_index=True)

    min_seats = models.PositiveSmallIntegerField(default=1)
    # An allowance is a PlanLimit row, not a field here: a plan can cap several
    # things at once, a cap can be unlimited, and each one carries the label the
    # vendor publishes it under.
    highlights = models.JSONField(default=list, blank=True)
    source_url = models.URLField(blank=True, validators=[validate_external_url])

    verified_at = models.DateTimeField(
        null=True, blank=True, help_text="Last time this plan was CHECKED."
    )
    last_changed_at = models.DateTimeField(
        null=True, blank=True, help_text="Last time its price actually MOVED."
    )
    consecutive_absences = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "catalog_plan"
        ordering = ["tool", "tier_order"]
        constraints = [models.UniqueConstraint(fields=["tool", "code"], name="uniq_tool_plan_code")]

    def __str__(self):
        return self.name


class PlanPrice(TimeStampedModel):
    """Current and historical published prices - one current row per
    (plan, currency, billing period, overage). Superseding opens a new row rather
    than editing this one, so the profile can show a price history.

    A metered plan holds two current rows: what it costs, and what it charges
    per unit once its allowance runs out. The overage rate is a published price
    like any other, so it lives here and inherits the whole provenance
    apparatus - source, pinning, evidence, history - rather than becoming a
    bare number hung off the plan."""

    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name="prices")
    currency = models.CharField(max_length=3, default="USD")
    amount = models.DecimalField(max_digits=12, decimal_places=4)
    unit = models.CharField(max_length=16, choices=PriceUnit.choices)
    billing_period = models.CharField(max_length=16, choices=BillingPeriod.choices)

    is_current = models.BooleanField(default=True)
    is_overage = models.BooleanField(
        default=False,
        help_text="The rate charged BEYOND the plan's allowance, not the plan's own price.",
    )
    effective_from = models.DateTimeField(default=timezone.now)
    effective_to = models.DateTimeField(null=True, blank=True)

    source = models.CharField(
        max_length=16, choices=PriceSource.choices, default=PriceSource.MANUAL
    )
    is_pinned = models.BooleanField(
        default=False, db_index=True, help_text="The crawler may not overwrite a pinned row."
    )
    entered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    source_note = models.CharField(max_length=255, blank=True)
    source_evidence_url = models.URLField(blank=True, validators=[validate_external_url])
    confidence = models.DecimalField(max_digits=4, decimal_places=3, default=1)
    snapshot = models.ForeignKey(
        "PriceSnapshot",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        help_text="The observation this published figure came from, when one exists.",
    )

    class Meta:
        db_table = "catalog_plan_price"
        ordering = ["-effective_from"]
        constraints = [
            models.UniqueConstraint(
                fields=["plan", "currency", "billing_period", "is_overage"],
                condition=models.Q(is_current=True),
                name="uniq_current_plan_price",
            )
        ]

    def __str__(self):
        suffix = " over plan" if self.is_overage else ""
        return f"{self.amount} {self.currency}/{self.unit}{suffix}"

    def save(self, *args, **kwargs):
        # A staff or vendor figure is authoritative by default. Forgetting to
        # tick the box should not silently hand the row back to the crawler.
        if self.source != PriceSource.CRAWLER and not self.is_pinned:
            self.is_pinned = True
        super().save(*args, **kwargs)


class PlanLimitKind(models.TextChoices):
    PAGES_PER_DOCUMENT = "pages_per_document", "Pages per document"
    PAGES_PER_MONTH = "pages_per_month", "Pages per month"
    DOCUMENTS_PER_MONTH = "documents_per_month", "Documents per month"
    MINUTES_PER_MONTH = "minutes_per_month", "Minutes per month"
    FILE_SIZE_MB = "file_size_mb", "Maximum file size"
    SEATS = "seats", "Seats"
    RETENTION_DAYS = "retention_days", "File retention"
    API_CALLS_PER_MONTH = "api_calls_per_month", "API calls per month"
    OTHER = "other", "Other"


# What each kind counts. The unit is a property of the kind, not of the row:
# `pages_per_month` counts pages wherever it appears, and a row free to say
# otherwise is a row free to be wrong. `other` counts nothing nameable, which is
# what makes it `other`.
LIMIT_UNITS = {
    PlanLimitKind.PAGES_PER_DOCUMENT: "pages",
    PlanLimitKind.PAGES_PER_MONTH: "pages",
    PlanLimitKind.DOCUMENTS_PER_MONTH: "documents",
    PlanLimitKind.MINUTES_PER_MONTH: "minutes",
    PlanLimitKind.FILE_SIZE_MB: "MB",
    PlanLimitKind.SEATS: "seats",
    PlanLimitKind.RETENTION_DAYS: "days",
    PlanLimitKind.API_CALLS_PER_MONTH: "calls",
    PlanLimitKind.OTHER: "",
}


class PlanLimit(TimeStampedModel):
    """A published cap on a plan. Absent rather than guessed: a made-up number
    is not a fact, so an unpublished cap is recorded as a note, not a value."""

    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name="limits")
    kind = models.CharField(max_length=32, choices=PlanLimitKind.choices)
    value = models.PositiveIntegerField(null=True, blank=True)
    is_unlimited = models.BooleanField(default=False)
    note = models.CharField(max_length=160, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "catalog_plan_limit"
        ordering = ["plan", "sort_order", "kind"]
        # One row per kind: two caps of the same kind on one plan never said
        # which was the plan's, they said the table had not decided.
        constraints = [models.UniqueConstraint(fields=["plan", "kind"], name="uniq_plan_limit")]

    def __str__(self):
        return f"{self.label}: {self.display_value}"

    @property
    def label(self):
        """How the cap is worded, which is what its kind is for."""
        return self.get_kind_display()

    @property
    def unit(self):
        return LIMIT_UNITS.get(self.kind, "")

    @property
    def display_value(self):
        if self.is_unlimited:
            return "Unlimited"
        if self.value is None:
            return self.note or "Not published"
        return f"{self.value} {self.unit}".strip()


# --- Crawl -----------------------------------------------------------------
# Schema only in phase 1. The fetcher, extractors, normalizer and guards arrive
# in phase 2 against tables that already fit them.


class ExtractionStrategy(models.TextChoices):
    JSONLD = "jsonld", "JSON-LD"
    MICRODATA = "microdata", "Microdata"
    JSON_API = "json_api", "JSON API"
    CSS = "css", "CSS selector"
    REGEX = "regex", "Regex over text"
    MANUAL = "manual", "Manual only"


class CrawlSource(TimeStampedModel):
    tool = models.ForeignKey(Tool, on_delete=models.CASCADE, related_name="crawl_sources")
    url = models.URLField(validators=[validate_external_url])
    strategy = models.CharField(
        max_length=16, choices=ExtractionStrategy.choices, default=ExtractionStrategy.JSONLD
    )
    selector_config = models.JSONField(default=dict, blank=True)
    currency_hint = models.CharField(max_length=3, blank=True)
    locale_hint = models.CharField(max_length=5, blank=True)
    requires_js = models.BooleanField(default=False)
    is_enabled = models.BooleanField(default=True, db_index=True)
    robots_allowed = models.BooleanField(default=True)
    robots_checked_at = models.DateTimeField(null=True, blank=True)
    crawl_interval_hours = models.PositiveSmallIntegerField(default=24)
    last_run_at = models.DateTimeField(null=True, blank=True, db_index=True)
    consecutive_failures = models.PositiveSmallIntegerField(default=0)
    etag = models.CharField(max_length=255, blank=True)
    last_modified = models.CharField(max_length=128, blank=True)
    content_hash = models.CharField(max_length=64, blank=True)

    class Meta:
        db_table = "catalog_crawl_source"
        ordering = ["tool", "url"]

    def __str__(self):
        return self.url


class CrawlRunStatus(models.TextChoices):
    RUNNING = "running", "Running"
    SUCCESS = "success", "Success"
    PARTIAL = "partial", "Partial"
    FAILED = "failed", "Failed"


class CrawlRun(TimeStampedModel):
    status = models.CharField(
        max_length=16, choices=CrawlRunStatus.choices, default=CrawlRunStatus.RUNNING
    )
    trigger = models.CharField(max_length=32, default="schedule")
    started_at = models.DateTimeField(default=timezone.now, db_index=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    sources_total = models.PositiveIntegerField(default=0)
    sources_ok = models.PositiveIntegerField(default=0)
    sources_failed = models.PositiveIntegerField(default=0)
    prices_changed = models.PositiveIntegerField(default=0)
    prices_rejected = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "catalog_crawl_run"
        ordering = ["-started_at"]

    def __str__(self):
        return f"Crawl {self.pk} ({self.status})"


class CrawlResultStatus(models.TextChoices):
    OK = "ok", "OK"
    UNCHANGED = "unchanged", "Unchanged"
    HTTP_ERROR = "http_error", "HTTP error"
    PARSE_ERROR = "parse_error", "Parse error"
    BLOCKED = "blocked", "Blocked"
    REJECTED = "rejected", "Rejected"


class CrawlResult(TimeStampedModel):
    run = models.ForeignKey(CrawlRun, on_delete=models.CASCADE, related_name="results")
    source = models.ForeignKey(CrawlSource, on_delete=models.CASCADE, related_name="results")
    status = models.CharField(max_length=16, choices=CrawlResultStatus.choices)
    http_status = models.PositiveSmallIntegerField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    content_hash = models.CharField(max_length=64, blank=True)
    raw_excerpt = models.TextField(
        blank=True, help_text="First 4KB. Admin only - never exposed through the API."
    )
    extracted = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True)

    class Meta:
        db_table = "catalog_crawl_result"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.source} ({self.status})"


class PriceSnapshot(TimeStampedModel):
    """Immutable observation log - one row per extraction attempt, accepted or not."""

    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name="snapshots")
    crawl_result = models.ForeignKey(
        CrawlResult, on_delete=models.SET_NULL, null=True, blank=True, related_name="snapshots"
    )
    currency = models.CharField(max_length=3, blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    unit = models.CharField(max_length=16, choices=PriceUnit.choices, blank=True)
    billing_period = models.CharField(max_length=16, choices=BillingPeriod.choices, blank=True)
    raw_value = models.CharField(max_length=255, blank=True)
    extraction_strategy = models.CharField(max_length=16, blank=True)
    confidence = models.DecimalField(max_digits=4, decimal_places=3, default=0)
    is_accepted = models.BooleanField(default=False, db_index=True)
    rejection_reason = models.CharField(max_length=32, blank=True)
    observed_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = "catalog_price_snapshot"
        ordering = ["-observed_at"]

    def __str__(self):
        return f"{self.plan} @ {self.observed_at:%Y-%m-%d}"


class PriceReviewReason(models.TextChoices):
    LOW_CONFIDENCE = "low_confidence", "Low confidence"
    PCT_CAP = "pct_cap", "Change exceeded the cap"
    CURRENCY_CHANGE = "currency_change", "Currency changed"
    UNIT_CHANGE = "unit_change", "Unit changed"
    NEW_PLAN = "new_plan", "New plan appeared"
    PLAN_DISAPPEARED = "plan_disappeared", "Plan disappeared"
    ZERO_PRICE = "zero_price", "Price became zero"
    FLAP = "flap", "Changed again too soon"
    PARSE_AMBIGUOUS = "parse_ambiguous", "Ambiguous parse"
    PINNED_DISAGREEMENT = "pinned_disagreement", "Disagrees with a pinned price"


class PriceReviewStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class PriceReviewItem(TimeStampedModel):
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name="review_items")
    crawl_result = models.ForeignKey(
        CrawlResult, on_delete=models.SET_NULL, null=True, blank=True, related_name="review_items"
    )
    reason = models.CharField(max_length=32, choices=PriceReviewReason.choices)
    proposed_amount = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    proposed_currency = models.CharField(max_length=3, blank=True)
    proposed_unit = models.CharField(max_length=16, blank=True)
    proposed_billing_period = models.CharField(max_length=16, blank=True)
    previous_amount = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    previous_currency = models.CharField(max_length=3, blank=True)
    previous_unit = models.CharField(max_length=16, blank=True)
    status = models.CharField(
        max_length=16,
        choices=PriceReviewStatus.choices,
        default=PriceReviewStatus.PENDING,
        db_index=True,
    )
    admin_comment = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "catalog_price_review_item"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self):
        return f"{self.plan} ({self.reason})"


# --- Submission ------------------------------------------------------------


class ToolSubmissionStatus(models.TextChoices):
    SUBMITTED = "submitted", "Submitted"
    UNDER_REVIEW = "under_review", "Under review"
    PUBLISHED = "published", "Published"
    REJECTED = "rejected", "Rejected"
    DUPLICATE = "duplicate", "Duplicate"


class ToolSubmission(TimeStampedModel):
    """A proposed listing awaiting review. Approving it creates a DRAFT tool,
    never a published one - publishing needs original editorial that a queue row
    does not carry."""

    name = models.CharField(max_length=200)
    vendor_name = models.CharField(max_length=200, blank=True)
    homepage_url = models.URLField(validators=[validate_external_url])
    pricing_url = models.URLField(blank=True, validators=[validate_external_url])
    docs_url = models.URLField(blank=True, validators=[validate_external_url])
    logo_url = models.CharField(max_length=300, blank=True, validators=[validate_logo_url])
    description = models.TextField(help_text="Never published verbatim - editors rewrite.")
    proposed_media = models.SlugField(blank=True)
    proposed_deployment = models.SlugField(blank=True)
    proposed_method = models.SlugField(blank=True)
    notes = models.TextField(blank=True)

    # Login is required, so identity is the account rather than a typed address.
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tool_submissions"
    )
    contact_email = models.EmailField(blank=True, help_text="Optional; defaults to the account.")
    submitter_is_owner = models.BooleanField(
        default=False, help_text="Routes to the claim flow on approval."
    )

    source_ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True)

    status = models.CharField(
        max_length=16,
        choices=ToolSubmissionStatus.choices,
        default=ToolSubmissionStatus.SUBMITTED,
        db_index=True,
    )
    admin_comment = models.TextField(blank=True)
    created_tool = models.ForeignKey(
        Tool, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    duplicate_of = models.ForeignKey(
        Tool, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    OPEN_STATUSES = (ToolSubmissionStatus.SUBMITTED, ToolSubmissionStatus.UNDER_REVIEW)

    class Meta:
        db_table = "catalog_tool_submission"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self):
        return self.name


# --- Claim -----------------------------------------------------------------


class ToolClaimStatus(models.TextChoices):
    PENDING_VERIFICATION = "pending_verification", "Pending email verification"
    PENDING_REVIEW = "pending_review", "Pending staff review"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    REVOKED = "revoked", "Revoked"


class ToolClaim(TimeStampedModel):
    """A request to maintain a listing.

    Several approved claims per tool are allowed on purpose: vendors have more
    than one employee.
    """

    tool = models.ForeignKey(Tool, on_delete=models.CASCADE, related_name="claims")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tool_claims"
    )
    work_email = models.EmailField(help_text="Should be on the tool's own domain.")
    email_domain = models.CharField(max_length=253, db_index=True)
    role = models.CharField(max_length=120, blank=True)
    evidence = models.TextField(blank=True, help_text="LinkedIn, press page - for review.")
    domain_matched = models.BooleanField(
        default=False, help_text="A routing signal for review, never an approval."
    )
    email_verified_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=24,
        choices=ToolClaimStatus.choices,
        default=ToolClaimStatus.PENDING_VERIFICATION,
        db_index=True,
    )
    admin_comment = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "catalog_tool_claim"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["tool", "user"], name="uniq_tool_claim_per_user")
        ]

    def __str__(self):
        return f"{self.tool.name} <- {self.work_email}"


class ToolClaimCode(TimeStampedModel):
    """A one-time code proving control of a work address. It authenticates nothing.

    Deliberately its own table with no relationship to the auth path: a shared
    code model needs a purpose field, and a purpose field is something a future
    change can get wrong. Here there is nothing to get wrong.
    """

    MAX_ATTEMPTS = 5

    claim = models.ForeignKey(ToolClaim, on_delete=models.CASCADE, related_name="codes")
    code_hash = models.CharField(max_length=64, help_text="sha256; the code itself is never kept.")
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "catalog_tool_claim_code"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Code for claim {self.claim_id}"

    def is_usable(self):
        return (
            self.used_at is None
            and self.attempts < self.MAX_ATTEMPTS
            and self.expires_at > timezone.now()
        )


# --- Owner proposals -------------------------------------------------------


class ToolRevisionStatus(models.TextChoices):
    SUBMITTED = "submitted", "Submitted"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    SUPERSEDED = "superseded", "Superseded"


class ToolRevisionOrigin(models.TextChoices):
    OWNER = "owner", "Listing owner"
    STAFF = "staff", "Staff"


class ToolRevision(TimeStampedModel):
    """A proposed field-level edit, as a JSON diff.

    A diff rather than a shadow table: the schema is not duplicated (and
    re-duplicated each time Tool gains a field), reviewers get a readable
    before/after, and a revision can be applied in part.
    """

    tool = models.ForeignKey(Tool, on_delete=models.CASCADE, related_name="revisions")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tool_revisions",
    )
    origin = models.CharField(
        max_length=16, choices=ToolRevisionOrigin.choices, default=ToolRevisionOrigin.OWNER
    )
    changes = models.JSONField(default=dict, help_text="{field: new value}")
    base_snapshot = models.JSONField(
        default=dict, help_text="The same fields when the revision was written."
    )
    status = models.CharField(
        max_length=16,
        choices=ToolRevisionStatus.choices,
        default=ToolRevisionStatus.SUBMITTED,
        db_index=True,
    )
    admin_comment = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    applied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "catalog_tool_revision"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self):
        return f"{self.tool.name}: {', '.join(self.changes)}"

    def conflicting_fields(self):
        """Fields staff changed since this revision was written."""
        return [
            field
            for field, was in self.base_snapshot.items()
            if getattr(self.tool, field, None) != was
        ]


class PriceProposalStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    SUPERSEDED = "superseded", "Superseded"


class PriceProposalOrigin(models.TextChoices):
    OWNER = "owner", "Listing owner"
    STAFF = "staff", "Staff"


class PriceProposal(TimeStampedModel):
    """A proposed price awaiting approval - the only owner path to a price row.

    There is deliberately no owner write path to Plan or PlanPrice, so a
    permission bug here cannot become a live-price bug.
    """

    tool = models.ForeignKey(Tool, on_delete=models.CASCADE, related_name="price_proposals")
    plan = models.ForeignKey(
        Plan,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="price_proposals",
        help_text="Null when proposing a plan we do not list yet.",
    )
    proposed_plan_name = models.CharField(max_length=120, blank=True)
    currency = models.CharField(max_length=3, default="USD")
    amount = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    unit = models.CharField(max_length=16, choices=PriceUnit.choices, blank=True)
    billing_period = models.CharField(max_length=16, choices=BillingPeriod.choices, blank=True)
    is_free_tier = models.BooleanField(default=False)
    is_trial = models.BooleanField(default=False)
    trial_days = models.PositiveSmallIntegerField(null=True, blank=True)
    is_enterprise_quote = models.BooleanField(default=False)

    origin = models.CharField(
        max_length=16, choices=PriceProposalOrigin.choices, default=PriceProposalOrigin.OWNER
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="price_proposals",
    )
    rationale = models.TextField(blank=True)
    evidence_url = models.URLField(blank=True, validators=[validate_external_url])

    # Captured at proposal time so a reviewer sees what actually changed.
    previous_amount = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    previous_currency = models.CharField(max_length=3, blank=True)
    previous_unit = models.CharField(max_length=16, blank=True)

    status = models.CharField(
        max_length=16,
        choices=PriceProposalStatus.choices,
        default=PriceProposalStatus.PENDING,
        db_index=True,
    )
    admin_comment = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    applied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "catalog_price_proposal"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self):
        return f"{self.tool.name}: {self.amount} {self.currency}"
