from django.contrib import admin
from django.core.exceptions import PermissionDenied
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.urls import path, reverse
from django.utils.html import format_html
from unfold.admin import ModelAdmin

from apps.blog import mdx, services
from apps.blog.models import PostSubmission, PostSubmissionStatus


@admin.register(PostSubmission)
class PostSubmissionAdmin(ModelAdmin):
    list_display = ("title", "author_name", "submitted_by", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("title", "author_name", "submitted_by__email")
    ordering = ("-created_at",)
    # What the writer sent is evidence, not a draft to edit here; the decision goes
    # through the actions so it is stamped. Only the note to the writer is typed in.
    fields = (
        "status",
        "review_note",
        "mdx_export",
        "title",
        "description",
        "tags",
        "body",
        "author_name",
        "author_role",
        "author_bio",
        "author_links",
        "submitted_by",
        "created_at",
        "reviewed_by",
        "reviewed_at",
    )
    readonly_fields = tuple(f for f in fields if f != "review_note")
    actions = ("accept_submissions", "reject_submissions")

    @admin.action(description="Accept - turn into MDX by hand")
    def accept_submissions(self, request, queryset):
        for submission in queryset:
            services.review(submission, user=request.user, status=PostSubmissionStatus.ACCEPTED)
        self.message_user(request, f"Accepted {queryset.count()} posts.")

    @admin.action(description="Reject - keep the row, so the writer sees the outcome")
    def reject_submissions(self, request, queryset):
        for submission in queryset:
            services.review(submission, user=request.user, status=PostSubmissionStatus.REJECTED)
        self.message_user(request, f"Rejected {queryset.count()} posts.")

    @admin.display(description="Body (markdown)")
    def body(self, obj):
        return format_html('<pre style="white-space: pre-wrap">{}</pre>', obj.body_md)

    @admin.display(description="MDX")
    def mdx_export(self, obj):
        url = reverse("admin:blog_postsubmission_mdx", args=[obj.pk])
        return format_html('<a href="{}">Download {}</a>', url, mdx.filename(obj))

    def get_urls(self):
        export = path(
            "<int:pk>/mdx/",
            self.admin_site.admin_view(self.export_mdx),
            name="blog_postsubmission_mdx",
        )
        return [export, *super().get_urls()]

    def export_mdx(self, request, pk):
        """The post as a file to drop into `frontend/content/blog/` and finish there."""
        if not self.has_view_permission(request):
            raise PermissionDenied
        submission = get_object_or_404(PostSubmission, pk=pk)
        response = HttpResponse(mdx.render(submission), content_type="text/markdown")
        response["Content-Disposition"] = f'attachment; filename="{mdx.filename(submission)}"'
        return response
