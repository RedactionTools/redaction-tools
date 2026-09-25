"""Benchmark domain models.

The shape follows pdfredeval, the scorer this site vendors: a *suite* is one medium
(`/benchmarks/pdf`), a *dataset revision* is one frozen case set, a *case* is one
synthetic document, and a *run* is one tool's output for one case, scored. Runs arrive
grouped in a *submission* - one tool, one revision - which is what an editor reviews.

Same conventions as the catalog: explicit `db_table` prefixed `benchmarks_`, explicit
`Meta.ordering`, an explicit `__str__`, `TimeStampedModel` for the created/updated pair.
"""

import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.catalog.models import Tool
from apps.catalog.slugs import validate_catalog_slug
from apps.core.models import TimeStampedModel


class Suite(TimeStampedModel):
    """One medium's benchmark - `pdf` today. Its slug is the URL segment."""

    slug = models.SlugField(max_length=40, unique=True, validators=[validate_catalog_slug])
    name = models.CharField(max_length=120)
    description_md = models.TextField(blank=True)
    is_public = models.BooleanField(default=False)

    class Meta:
        db_table = "benchmarks_suite"
        ordering = ["name"]

    def __str__(self):
        return self.name


class DatasetRevision(TimeStampedModel):
    """One frozen case set, named as pdfredeval names it (`v0.1.1`).

    Scores from different revisions are never pooled: a revision changes what is being
    measured, so one leaderboard is always one revision.
    """

    suite = models.ForeignKey(Suite, on_delete=models.PROTECT, related_name="revisions")
    revision = models.CharField(max_length=32)
    generator_version = models.CharField(max_length=32, blank=True)
    is_current = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    case_pack = models.FileField(
        upload_to="benchmarks",
        max_length=255,
        blank=True,
        help_text="A zip of every public case PDF, rebuilt whenever a case is published.",
    )

    class Meta:
        db_table = "benchmarks_dataset_revision"
        ordering = ["suite", "-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["suite", "revision"], name="uniq_suite_revision"),
            models.UniqueConstraint(
                fields=["suite"], condition=Q(is_current=True), name="one_current_revision"
            ),
        ]

    def __str__(self):
        return f"{self.suite.slug} {self.revision}"


class CaseVisibility(models.TextChoices):
    PUBLIC = "public", "Public"
    # Scored, never shown: no PDF, overlay or output of a holdout case is served, so a
    # tool cannot be tuned against the cases that keep the leaderboard honest.
    HOLDOUT = "holdout", "Holdout"


class Case(TimeStampedModel):
    """One synthetic document and the ground truth it is scored against.

    `ground_truth` is pdfredeval's `ground_truth.json`, and it never leaves the server:
    it holds the seed that regenerates the case. The public view is `probe_summary`,
    the counts derived from it.
    """

    revision = models.ForeignKey(DatasetRevision, on_delete=models.PROTECT, related_name="cases")
    case_id = models.CharField(max_length=80)
    family = models.CharField(max_length=60, db_index=True)
    visibility = models.CharField(
        max_length=16, choices=CaseVisibility.choices, default=CaseVisibility.PUBLIC
    )
    pdf = models.FileField(upload_to="benchmarks", max_length=255, blank=True)
    # The first page as an image, rendered at publication: what the site shows in place
    # of the PDF, which media's X-Frame-Options: DENY keeps out of a frame.
    preview = models.ImageField(upload_to="benchmarks", max_length=255, blank=True)
    preview_widths = models.JSONField(default=list, blank=True)
    preview_width = models.PositiveIntegerField(null=True, blank=True)
    preview_height = models.PositiveIntegerField(null=True, blank=True)
    input_sha256 = models.CharField(max_length=64, blank=True)
    page_count = models.PositiveSmallIntegerField(default=1)
    ground_truth = models.JSONField(default=dict, blank=True)
    probe_summary = models.JSONField(default=dict, blank=True)
    probe_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "benchmarks_case"
        ordering = ["revision", "family", "case_id"]
        constraints = [
            models.UniqueConstraint(fields=["revision", "case_id"], name="uniq_revision_case"),
        ]

    def __str__(self):
        return self.case_id


class Surface(models.TextChoices):
    """How the tool was driven - the suffix of a pdfredeval tool id (`slug:web`)."""

    WEB = "web", "Web app"
    API = "api", "API"
    DESKTOP = "desktop", "Desktop app"


class SubmissionOrigin(models.TextChoices):
    UPLOAD = "upload", "Uploaded outputs, scored by us"
    CLI = "cli", "Published from the CLI, scored by the submitter"


class SubmitterRole(models.TextChoices):
    STAFF = "staff", "Redaction Tools"
    OWNER = "owner", "Tool owner"
    COMMUNITY = "community", "Community"


class SubmissionStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SCORING = "scoring", "Scoring"
    SCORING_FAILED = "scoring_failed", "Scoring failed"
    PENDING_REVIEW = "pending_review", "Pending review"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"
    WITHDRAWN = "withdrawn", "Withdrawn"


class Submission(TimeStampedModel):
    """One tool's runs against one revision, published together and reviewed together.

    Who published it is recorded twice on purpose: `submitted_by` is the account, and
    `submitter_name` / `submitter_role` are what the site shows - snapshotted when the
    submission opens, so a later claim, promotion or deleted account does not rewrite
    the provenance of a result that is already public.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    suite = models.ForeignKey(Suite, on_delete=models.PROTECT, related_name="submissions")
    revision = models.ForeignKey(
        DatasetRevision, on_delete=models.PROTECT, related_name="submissions"
    )
    tool = models.ForeignKey(Tool, on_delete=models.CASCADE, related_name="benchmark_submissions")
    surface = models.CharField(max_length=16, choices=Surface.choices)
    tool_version = models.CharField(max_length=80, blank=True)
    tier = models.CharField(max_length=80, blank=True, help_text="The plan the tool ran on.")
    notes = models.TextField(blank=True)

    origin = models.CharField(max_length=16, choices=SubmissionOrigin.choices)
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="benchmark_submissions",
    )
    submitter_name = models.CharField(max_length=255)
    submitter_role = models.CharField(max_length=16, choices=SubmitterRole.choices)

    status = models.CharField(
        max_length=20,
        choices=SubmissionStatus.choices,
        default=SubmissionStatus.DRAFT,
        db_index=True,
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_note = models.TextField(blank=True)

    class Meta:
        db_table = "benchmarks_submission"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "-created_at"])]

    def __str__(self):
        return f"{self.tool_id_label} on {self.revision} by {self.submitter_name}"

    @property
    def tool_id_label(self):
        """The pdfredeval tool id this submission stands for: `slug:surface`."""
        return f"{self.tool.slug}:{self.surface}"


class RunStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    SCORED = "scored", "Scored"
    FAILED = "failed", "Failed"


class ScoredBy(models.TextChoices):
    SERVER = "server", "Redaction Tools"
    SUBMITTER = "submitter", "The submitter"


class Verification(models.TextChoices):
    """Whether our rescore agrees with a report the submitter scored themselves."""

    NOT_NEEDED = "not_needed", "Scored by us"
    PENDING = "pending", "Pending"
    VERIFIED = "verified", "Verified"
    MISMATCH = "mismatch", "Mismatch"
    FAILED = "failed", "Could not verify"


class Run(TimeStampedModel):
    """One case's output, and the score it earned.

    `report` is pdfredeval's `report.json`, whole - the site renders its own report from
    it rather than trusting anyone's HTML. The headline counts are copied out of it so
    the leaderboard can pool them without parsing every report on every request.
    """

    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="runs")
    case = models.ForeignKey(Case, on_delete=models.PROTECT, related_name="runs")
    run_id = models.CharField(max_length=160, unique=True)
    status = models.CharField(
        max_length=16, choices=RunStatus.choices, default=RunStatus.QUEUED, db_index=True
    )
    error = models.TextField(blank=True)

    output_pdf = models.FileField(upload_to="benchmarks", max_length=255)
    output_sha256 = models.CharField(max_length=64)
    overlay = models.ImageField(upload_to="benchmarks", max_length=255, blank=True)
    overlay_widths = models.JSONField(default=list, blank=True)

    manifest = models.JSONField(default=dict, blank=True)
    report = models.JSONField(default=dict, blank=True)

    tp = models.PositiveIntegerField(default=0)
    fn = models.PositiveIntegerField(default=0)
    fp = models.PositiveIntegerField(default=0)
    tn = models.PositiveIntegerField(default=0)
    unsupported = models.PositiveIntegerField(default=0)
    undecided = models.PositiveIntegerField(default=0)
    weighted_leak_rate = models.FloatField(null=True, blank=True)
    text_retention = models.FloatField(null=True, blank=True)
    gates_passed = models.BooleanField(null=True, blank=True)

    scored_by = models.CharField(max_length=16, choices=ScoredBy.choices)
    scorer_version = models.CharField(max_length=32, blank=True)
    thresholds_digest = models.CharField(max_length=64, blank=True)
    verification = models.CharField(
        max_length=16, choices=Verification.choices, default=Verification.NOT_NEEDED
    )
    verification_diff = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "benchmarks_run"
        ordering = ["submission", "case"]
        constraints = [
            models.UniqueConstraint(fields=["submission", "case"], name="uniq_submission_case"),
        ]

    def __str__(self):
        return self.run_id
