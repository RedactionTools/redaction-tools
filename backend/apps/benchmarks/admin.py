"""Benchmark administration: the review queue, and the cases behind it.

A submission is reviewed whole - every run in it is published or none is - and the
evidence sits on its page: each run's overlay, its headline beside the claim, and, for
a run scored with the CLI, exactly where our rescore disagrees.
"""

import json

from django.contrib import admin, messages
from django.utils.html import format_html, format_html_join
from unfold.admin import ModelAdmin, TabularInline

from apps.benchmarks import services
from apps.benchmarks.files import media_url
from apps.benchmarks.models import (
    Case,
    DatasetRevision,
    Run,
    Submission,
    SubmissionStatus,
    Suite,
)
from apps.benchmarks.services import BenchmarkError


@admin.register(Suite)
class SuiteAdmin(ModelAdmin):
    list_display = ("name", "slug", "is_public")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(DatasetRevision)
class DatasetRevisionAdmin(ModelAdmin):
    """Moving the leaderboard to a new revision is `is_current`, set here and only here."""

    list_display = ("__str__", "generator_version", "is_current", "published_at", "case_count")
    list_filter = ("suite", "is_current")
    readonly_fields = ("case_pack",)

    @admin.display(description="Cases")
    def case_count(self, obj):
        return obj.cases.count()


@admin.register(Case)
class CaseAdmin(ModelAdmin):
    """Cases arrive from `pdfredeval publish-cases`. The ground truth is not shown: it is
    the answer key, and a browser tab is not where it should be read."""

    list_display = ("case_id", "family", "revision", "visibility", "probe_count")
    list_filter = ("revision", "family", "visibility")
    search_fields = ("case_id",)
    fields = (
        "revision",
        "case_id",
        "family",
        "visibility",
        "pdf",
        "input_sha256",
        "page_count",
        "probe_count",
        "probe_summary",
    )
    readonly_fields = tuple(f for f in fields if f != "visibility")

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        # Visibility decides what the case pack holds.
        services.rebuild_case_pack(obj.revision)


class RunInline(TabularInline):
    model = Run
    extra = 0
    can_delete = False
    fields = ("overlay_preview", "case", "status", "headline", "verification_display", "error")
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    @admin.display(description="Overlay")
    def overlay_preview(self, obj):
        if not obj.overlay:
            return "-"
        return format_html(
            '<a href="{0}" target="_blank"><img src="{0}" width="160" alt="" /></a>',
            media_url(obj.overlay.name),
        )

    @admin.display(description="TP / FN / FP / TN")
    def headline(self, obj):
        return f"{obj.tp} / {obj.fn} / {obj.fp} / {obj.tn}"

    @admin.display(description="Verification")
    def verification_display(self, obj):
        label = obj.get_verification_display()
        if not obj.verification_diff:
            return label
        rows = format_html_join(
            "",
            "<li><code>{}</code>: claimed {}, ours {}</li>",
            (
                (field, json.dumps(values["claimed"]), json.dumps(values["ours"]))
                for field, values in sorted(obj.verification_diff.items())
            ),
        )
        return format_html("<strong>{}</strong><ul>{}</ul>", label, rows)


@admin.register(Submission)
class SubmissionAdmin(ModelAdmin):
    """The queue. Everything the submitter sent is read-only: a reviewer decides, they do
    not edit someone else's result. The note is the one field they write - a rejection
    needs one, because the submitter reads it."""

    list_display = (
        "tool_id_label",
        "revision",
        "submitter_name",
        "submitter_role",
        "origin",
        "status",
        "runs_count",
        "verification_summary",
        "submitted_at",
    )
    list_filter = ("status", "submitter_role", "origin", "runs__verification", "revision")
    search_fields = ("tool__name", "tool__slug", "submitter_name", "submitted_by__email")
    list_select_related = ("tool", "revision__suite")
    inlines = (RunInline,)
    readonly_fields = (
        "suite",
        "revision",
        "tool",
        "surface",
        "tool_version",
        "tier",
        "notes",
        "origin",
        "submitted_by",
        "submitter_name",
        "submitter_role",
        "status",
        "submitted_at",
        "reviewed_by",
        "reviewed_at",
    )
    fields = (*readonly_fields, "review_note")
    actions = ("approve_submissions", "reject_submissions")

    def has_add_permission(self, request):
        return False

    @admin.display(description="Runs")
    def runs_count(self, obj):
        return obj.runs.count()

    @admin.display(description="Verification")
    def verification_summary(self, obj):
        states = sorted({run.get_verification_display() for run in obj.runs.all()})
        return ", ".join(states) or "-"

    @admin.action(description="Approve - publish every run")
    def approve_submissions(self, request, queryset):
        self._review(request, queryset, SubmissionStatus.APPROVED)

    @admin.action(description="Reject - the submitter sees the review note")
    def reject_submissions(self, request, queryset):
        self._review(request, queryset, SubmissionStatus.REJECTED)

    def _review(self, request, queryset, status):
        done = 0
        for submission in queryset:
            try:
                services.review(
                    user=request.user,
                    submission=submission,
                    status=status,
                    note=submission.review_note,
                )
            except BenchmarkError as exc:
                self.message_user(request, f"{submission}: {exc}", level=messages.ERROR)
            else:
                done += 1
        if done:
            self.message_user(request, f"{done} submission(s) {status}.")
