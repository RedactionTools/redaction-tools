"""Catalog administration.

Staff enter and correct prices here, and the parts that carry a judgement are
surfaced rather than buried: whether a tool clears the publication bar, and where
each published figure came from.
"""

from django import forms
from django.conf import settings
from django.contrib import admin
from django.db import transaction
from django.utils import timezone
from django.utils.html import format_html
from django.utils.text import slugify
from unfold.admin import ModelAdmin, TabularInline
from unfold.widgets import UnfoldAdminFileFieldWidget

from apps.catalog import images, logos
from apps.catalog import screenshots as screenshot_service
from apps.catalog.images import ImageRejected
from apps.catalog.models import (
    CrawlSource,
    FacetDimension,
    FacetValue,
    Plan,
    PlanLimit,
    PlanPrice,
    PriceProposal,
    PriceProposalStatus,
    PriceReviewItem,
    PriceSource,
    Tool,
    ToolClaim,
    ToolClaimStatus,
    ToolFacet,
    ToolRevision,
    ToolRevisionStatus,
    ToolScreenshot,
    ToolScreenshotSource,
    ToolScreenshotStatus,
    ToolStatus,
    ToolSubmission,
    ToolSubmissionStatus,
    Vendor,
)
from apps.catalog.slugs import MAX_SLUG_LENGTH, RESERVED_CATALOG_SEGMENTS


def unique_tool_slug(name):
    """A slug that is free, legal and not a reserved word.

    Approving a submission must not fail on a slug collision an editor can fix in
    two seconds - so the collision is resolved here and left for them to rename.
    """
    base = slugify(name)[:MAX_SLUG_LENGTH] or "tool"
    if base in RESERVED_CATALOG_SEGMENTS:
        base = f"{base}-tool"
    slug, suffix = base, 2
    while Tool.objects.filter(slug=slug).exists():
        slug = f"{base[: MAX_SLUG_LENGTH - 3]}-{suffix}"
        suffix += 1
    return slug


class LogoUploadForm(forms.ModelForm):
    """A model form plus a way to upload a logo instead of typing a path.

    The upload is not a model field: `logo_url` stays the one place a logo
    lives, and an upload is just another way of filling it in.
    """

    logo_upload = forms.FileField(
        required=False,
        label="Upload logo",
        widget=UnfoldAdminFileFieldWidget,
        help_text=(
            "PNG, JPEG or WebP. Replaces the logo URL on save. SVG is refused: it can carry script."
        ),
    )

    def clean_logo_upload(self):
        upload = self.cleaned_data.get("logo_upload")
        if not upload:
            return None
        data = upload.read()
        # Checked here as well as in `logos.write` so that a bad file is a form
        # error an editor can read, before anything on the page is saved.
        try:
            images.load_logo(data)
        except ImageRejected as exc:
            raise forms.ValidationError(str(exc)) from exc
        return data


class LogoAdminMixin:
    """Logo upload and preview for any admin whose model has a `logo_url`."""

    form = LogoUploadForm

    def get_readonly_fields(self, request, obj=None):
        return (*super().get_readonly_fields(request, obj), "logo_preview")

    def get_fields(self, request, obj=None):
        """Every field in model order, with the upload and preview moved up
        beside `logo_url` - left alone, both would land at the very bottom."""
        fields = [
            f for f in super().get_fields(request, obj) if f not in ("logo_upload", "logo_preview")
        ]
        at = fields.index("logo_url") + 1
        return [*fields[:at], "logo_upload", "logo_preview", *fields[at:]]

    @admin.display(description="Logo preview")
    def logo_preview(self, obj):
        """The logo as the site shows it, on the same white plate.

        A site-relative path is a file in the frontend's `public/`, which this
        origin does not serve - so it is reached through FRONTEND_URL.
        """
        if not obj.logo_url:
            return "—"
        src = obj.logo_url
        if src.startswith("/") and not src.startswith("//"):
            src = f"{settings.FRONTEND_URL}{src}"
        return format_html(
            '<span style="display:inline-block;background:#fff;padding:4px;border-radius:4px">'
            '<img src="{}" style="height:40px;max-width:176px;object-fit:contain" alt="" />'
            "</span>",
            src,
        )

    def save_model(self, request, obj, form, change):
        if data := form.cleaned_data.get("logo_upload"):
            obj.logo_url = logos.write(data)
        super().save_model(request, obj, form, change)


@admin.register(Vendor)
class VendorAdmin(LogoAdminMixin, ModelAdmin):
    list_display = ("name", "slug", "hq_country", "is_active")
    list_filter = ("is_active", "hq_country")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


class ToolFacetInline(TabularInline):
    model = ToolFacet
    extra = 0
    autocomplete_fields = ("value",)


class PlanInline(TabularInline):
    """Staff price entry lives here, beside the tool it prices."""

    model = Plan
    extra = 0
    show_change_link = True
    fields = (
        "name",
        "code",
        "tier_order",
        "is_free_tier",
        "is_trial",
        "trial_days",
        "is_enterprise_quote",
        "is_public",
    )


class ToolScreenshotForm(forms.ModelForm):
    """The admin's upload, through the same gate as every other surface.

    The pipeline runs here rather than in the model's `save()` so that a file
    we will not store is a form error an editor can read, instead of a 500 from
    somewhere inside the request.
    """

    class Meta:
        model = ToolScreenshot
        fields = (
            "tool",
            "image",
            "alt_text",
            "caption",
            "source",
            "status",
            "source_url",
            "captured_at",
            "sort_order",
        )

    def clean_image(self):
        upload = self.cleaned_data["image"]
        # An unchanged file comes back as the stored FieldFile rather than an
        # upload; there is nothing to re-render in that case.
        if not hasattr(upload, "read") or upload is getattr(self.instance, "image", None):
            return upload
        upload.seek(0)
        self._image_data = upload.read()
        try:
            self._loaded = images.load_screenshot(self._image_data)
        except ImageRejected as exc:
            raise forms.ValidationError(str(exc)) from exc
        return upload

    def clean(self):
        cleaned = super().clean()
        loaded = getattr(self, "_loaded", None)
        tool = cleaned.get("tool")
        if loaded is None or tool is None:
            return cleaned
        # The same capture twice on one listing is a mistake, and the database
        # would report it as an opaque constraint violation.
        digest = screenshot_service.digest_of(loaded)
        clash = (
            ToolScreenshot.objects.filter(tool=tool, digest=digest)
            .exclude(pk=self.instance.pk)
            .first()
        )
        if clash is not None:
            raise forms.ValidationError(
                f"{tool} already has this exact picture ({clash.alt_text!r})."
            )
        return cleaned

    def save(self, commit=True):
        instance = super().save(commit=False)
        if (loaded := getattr(self, "_loaded", None)) is not None:
            screenshot_service.apply_image(instance, loaded)
        if commit:
            instance.save()
        return instance


def screenshot_preview(obj, width=240):
    """The picture itself. A gallery is unreviewable as a list of filenames."""
    if not obj.rendition_widths:
        return "—"
    return format_html(
        '<img src="{}" width="{}" style="border-radius:4px" alt="" />',
        obj.rendition_url(min(obj.rendition_widths)),
        width,
    )


class ToolScreenshotInline(TabularInline):
    """What this listing shows, in the order it shows it.

    Uploading happens on the screenshot's own page rather than here: the file
    has to go through the render pipeline, and an inline formset that half-ran
    it would leave rows pointing at renditions that were never written.
    """

    model = ToolScreenshot
    extra = 0
    max_num = 0
    can_delete = False
    show_change_link = True
    fields = ("preview", "alt_text", "status", "source", "sort_order")
    readonly_fields = ("preview",)

    @admin.display(description="Preview")
    def preview(self, obj):
        return screenshot_preview(obj, width=160)


@admin.register(ToolScreenshot)
class ToolScreenshotAdmin(ModelAdmin):
    """Screenshots, and the queue of the ones vendors have sent in.

    Pending rows are the working list: a vendor upload is stored and rendered on
    arrival but is not on the profile until it is published here.
    """

    form = ToolScreenshotForm
    list_display = ("preview", "tool", "alt_text", "status", "source", "captured_at", "sort_order")
    list_display_links = ("preview", "alt_text")
    list_filter = ("status", "source", "tool")
    search_fields = ("alt_text", "caption", "tool__name")
    autocomplete_fields = ("tool",)
    list_select_related = ("tool",)
    readonly_fields = ("preview", "dimensions", "uploaded_by", "reviewed_by", "reviewed_at")
    actions = ("publish_screenshots", "reject_screenshots", "rerender_screenshots")

    @admin.display(description="Preview")
    def preview(self, obj):
        return screenshot_preview(obj)

    @admin.display(description="Rendered")
    def dimensions(self, obj):
        """Stated rather than left to be inferred: an editor choosing whether to
        re-render needs to see what is actually on disk."""
        widths = ", ".join(f"{width}w" for width in obj.rendition_widths) or "nothing yet"
        return f"{obj.width}x{obj.height} source, rendered at {widths}"

    def get_changeform_initial_data(self, request):
        # An editor's own upload is a decision, not a submission. Shown as a
        # default they can change rather than forced, because the same form is
        # how a vendor's picture gets published.
        return {"source": ToolScreenshotSource.STAFF, "status": ToolScreenshotStatus.PUBLISHED}

    def save_model(self, request, obj, form, change):
        # Stamped from the request rather than a form field, like every other
        # attribution in this admin.
        if obj.uploaded_by_id is None:
            obj.uploaded_by = request.user
        if obj.status != ToolScreenshotStatus.PENDING and obj.reviewed_by_id is None:
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
        super().save_model(request, obj, form, change)

    def delete_model(self, request, obj):
        # Django never deletes a FileField's file when its row goes, so a plain
        # delete here would orphan a source and four renditions every time.
        screenshot_service.discard(obj)

    def delete_queryset(self, request, queryset):
        for shot in queryset:
            screenshot_service.discard(shot)

    @admin.action(description="Publish - put on the profile")
    def publish_screenshots(self, request, queryset):
        for shot in queryset:
            screenshot_service.review(
                screenshot=shot, user=request.user, status=ToolScreenshotStatus.PUBLISHED
            )
        self.message_user(request, f"Published {queryset.count()} screenshots.")

    @admin.action(description="Reject - keep the row, not the picture")
    def reject_screenshots(self, request, queryset):
        """Rejected rather than deleted: the uploader is shown the outcome, and a
        deleted row would read to them as one that never arrived."""
        for shot in queryset:
            screenshot_service.review(
                screenshot=shot, user=request.user, status=ToolScreenshotStatus.REJECTED
            )
        self.message_user(request, f"Rejected {queryset.count()} screenshots.")

    @admin.action(description="Re-render from the stored source")
    def rerender_screenshots(self, request, queryset):
        """What makes a new rendition width possible without going back to every
        vendor for a fresh capture."""
        for shot in queryset:
            screenshot_service.rerender(shot)
        self.message_user(request, f"Re-rendered {queryset.count()} screenshots.")


@admin.register(Tool)
class ToolAdmin(LogoAdminMixin, ModelAdmin):
    list_display = ("name", "vendor", "status", "listable", "is_first_party", "last_verified_at")
    list_filter = ("status", "is_first_party", "price_is_stale", "vendor")
    search_fields = ("name", "slug", "tagline", "summary")
    prepopulated_fields = {"slug": ("name",)}
    autocomplete_fields = ("vendor",)
    inlines = (ToolFacetInline, ToolScreenshotInline, PlanInline)
    readonly_fields = ("created_at", "updated_at")

    @admin.display(boolean=True, description="Listable")
    def listable(self, obj):
        """Whether this tool is a public page yet. See Tool.is_listable."""
        return obj.is_listable()


@admin.register(FacetDimension)
class FacetDimensionAdmin(ModelAdmin):
    list_display = ("code", "label", "is_landing_dimension", "sort_order")
    search_fields = ("code", "label")


@admin.register(FacetValue)
class FacetValueAdmin(ModelAdmin):
    list_display = ("slug", "dimension", "code", "label", "is_landing_page", "sort_order")
    list_filter = ("dimension", "is_landing_page")
    search_fields = ("slug", "code", "label")


class PlanLimitInline(TabularInline):
    model = PlanLimit
    extra = 0


@admin.register(Plan)
class PlanAdmin(ModelAdmin):
    list_display = ("tool", "name", "code", "tier_order", "kind", "is_public", "verified_at")
    list_filter = ("is_public", "is_free_tier", "is_trial", "is_enterprise_quote")
    search_fields = ("name", "code", "tool__name")
    autocomplete_fields = ("tool",)
    inlines = (PlanLimitInline,)

    @admin.display(description="Kind")
    def kind(self, obj):
        """Free, trial and quote-only are three different things, so say which."""
        if obj.is_free_tier:
            return "Free tier"
        if obj.is_trial:
            return f"{obj.trial_days}-day trial" if obj.trial_days else "Trial"
        if obj.is_enterprise_quote:
            return "Quote only"
        return "Paid"


@admin.register(PlanPrice)
class PlanPriceAdmin(ModelAdmin):
    list_display = (
        "tool",
        "plan",
        "amount",
        "currency",
        "unit",
        "billing_period",
        "source",
        "is_pinned",
        "entered_by",
        "effective_from",
    )
    list_filter = ("source", "is_pinned", "is_current", "currency")
    search_fields = ("plan__tool__name", "plan__name", "source_note")
    autocomplete_fields = ("plan",)
    readonly_fields = ("entered_by",)
    actions = ("unpin_prices",)
    list_select_related = ("plan__tool",)

    @admin.display(description="Tool", ordering="plan__tool__name")
    def tool(self, obj):
        """Plan names repeat across vendors, so the list has to say whose plan this is."""
        return obj.plan.tool

    def save_model(self, request, obj, form, change):
        # Stamped from the request rather than a form field: an audit trail that
        # depends on someone remembering to fill it in is not an audit trail.
        if obj.source != PriceSource.CRAWLER:
            obj.entered_by = request.user
        super().save_model(request, obj, form, change)

    @admin.action(description="Unpin - let the crawler update these prices again")
    def unpin_prices(self, request, queryset):
        updated = queryset.update(is_pinned=False)
        self.message_user(request, f"{updated} price(s) handed back to the crawler.")


@admin.register(CrawlSource)
class CrawlSourceAdmin(ModelAdmin):
    list_display = ("tool", "url", "strategy", "is_enabled", "last_run_at", "consecutive_failures")
    list_filter = ("is_enabled", "strategy", "robots_allowed")
    search_fields = ("tool__name", "url")
    autocomplete_fields = ("tool",)


@admin.register(PriceReviewItem)
class PriceReviewItemAdmin(ModelAdmin):
    list_display = ("plan", "reason", "previous_amount", "proposed_amount", "status", "created_at")
    list_filter = ("status", "reason")
    readonly_fields = (
        "plan",
        "crawl_result",
        "reason",
        "proposed_amount",
        "proposed_currency",
        "proposed_unit",
        "proposed_billing_period",
        "previous_amount",
        "previous_currency",
        "previous_unit",
    )


@admin.register(ToolSubmission)
class ToolSubmissionAdmin(ModelAdmin):
    """The review queue.

    Everything the submitter typed is read-only: a reviewer decides, they do not
    edit someone else's claim about their own product.
    """

    list_display = ("name", "status", "submitted_by", "created_at", "reviewed_at")
    list_filter = ("status", "submitter_is_owner")
    search_fields = ("name", "vendor_name", "homepage_url", "submitted_by__email")
    readonly_fields = (
        "name",
        "vendor_name",
        "homepage_url",
        "pricing_url",
        "docs_url",
        "logo_url",
        "description",
        "proposed_media",
        "proposed_deployment",
        "proposed_method",
        "notes",
        "submitted_by",
        "contact_email",
        "submitter_is_owner",
        "source_ip",
        "user_agent",
        "created_tool",
        "reviewed_by",
        "reviewed_at",
        "created_at",
        "updated_at",
    )
    fields = (*readonly_fields, "duplicate_of", "status", "admin_comment")
    autocomplete_fields = ("duplicate_of",)
    actions = ("approve_and_create_tool", "reject_submissions", "mark_duplicate")

    def _decide(self, request, queryset, status_value):
        return queryset.update(
            status=status_value, reviewed_by=request.user, reviewed_at=timezone.now()
        )

    @admin.action(description="Approve - create a DRAFT tool")
    def approve_and_create_tool(self, request, queryset):
        created = 0
        for submission in queryset.exclude(status=ToolSubmissionStatus.PUBLISHED):
            vendor, _ = Vendor.objects.get_or_create(
                slug=slugify(submission.vendor_name or submission.name)[:80],
                defaults={
                    "name": submission.vendor_name or submission.name,
                    "website_url": submission.homepage_url,
                },
            )
            tool = Tool.objects.create(
                vendor=vendor,
                name=submission.name,
                slug=unique_tool_slug(submission.name),
                # DRAFT, never PUBLISHED: an editor writes the copy first.
                status=ToolStatus.DRAFT,
                website_url=submission.homepage_url,
                pricing_url=submission.pricing_url,
                docs_url=submission.docs_url,
                logo_url=submission.logo_url,
            )
            if submission.pricing_url:
                CrawlSource.objects.create(tool=tool, url=submission.pricing_url)
            ToolSubmission.objects.filter(pk=submission.pk).update(
                created_tool=tool,
                status=ToolSubmissionStatus.PUBLISHED,
                reviewed_by=request.user,
                reviewed_at=timezone.now(),
            )
            created += 1
        self.message_user(
            request, f"{created} draft tool(s) created. Write the copy, then publish."
        )

    @admin.action(description="Reject")
    def reject_submissions(self, request, queryset):
        # The row stays: it is what stops the same site being re-submitted.
        count = self._decide(request, queryset, ToolSubmissionStatus.REJECTED)
        self.message_user(request, f"{count} submission(s) rejected.")

    @admin.action(description="Mark as a duplicate")
    def mark_duplicate(self, request, queryset):
        count = self._decide(request, queryset, ToolSubmissionStatus.DUPLICATE)
        self.message_user(request, f"{count} submission(s) marked duplicate.")


@admin.register(ToolClaim)
class ToolClaimAdmin(ModelAdmin):
    """Claim review.

    A domain match is shown, not acted on: staff approval is a ten-second
    decision, and skipping it would give anyone with a catch-all mailbox edit
    rights on a page that ranks vendors against each other.
    """

    list_display = ("tool", "user", "work_email", "domain_matched", "email_verified_at", "status")
    list_filter = ("status", "domain_matched")
    search_fields = ("tool__name", "work_email", "user__email")
    readonly_fields = (
        "tool",
        "user",
        "work_email",
        "email_domain",
        "role",
        "evidence",
        "domain_matched",
        "email_verified_at",
        "reviewed_by",
        "reviewed_at",
        "created_at",
        "updated_at",
    )
    fields = (*readonly_fields, "status", "admin_comment")
    actions = ("approve_claims", "reject_claims", "revoke_claims")

    def _decide(self, request, queryset, status_value):
        return queryset.update(
            status=status_value, reviewed_by=request.user, reviewed_at=timezone.now()
        )

    @admin.action(description="Approve - grant listing ownership")
    def approve_claims(self, request, queryset):
        # Only verified claims: approving an unverified one would hand a listing
        # to an address nobody has proved they can read.
        verified = queryset.filter(email_verified_at__isnull=False)
        skipped = queryset.count() - verified.count()
        count = self._decide(request, verified, ToolClaimStatus.APPROVED)
        message = f"{count} claim(s) approved."
        if skipped:
            message += f" {skipped} skipped: the work email is not verified yet."
        self.message_user(request, message)

    @admin.action(description="Reject")
    def reject_claims(self, request, queryset):
        count = self._decide(request, queryset, ToolClaimStatus.REJECTED)
        self.message_user(request, f"{count} claim(s) rejected.")

    @admin.action(description="Revoke - remove listing ownership")
    def revoke_claims(self, request, queryset):
        count = self._decide(request, queryset, ToolClaimStatus.REVOKED)
        self.message_user(request, f"{count} claim(s) revoked.")


@admin.register(ToolRevision)
class ToolRevisionAdmin(ModelAdmin):
    list_display = ("tool", "origin", "author", "status", "created_at", "applied_at")
    list_filter = ("status", "origin")
    search_fields = ("tool__name", "author__email")
    readonly_fields = (
        "tool",
        "author",
        "origin",
        "changes",
        "base_snapshot",
        "diff",
        "reviewed_by",
        "reviewed_at",
        "applied_at",
        "created_at",
        "updated_at",
    )
    fields = (*readonly_fields, "status", "admin_comment")
    actions = ("apply_revisions", "reject_revisions")

    @admin.display(description="Proposed change")
    def diff(self, obj):
        lines = [
            f"{field}: {obj.base_snapshot.get(field, '')!r} -> {value!r}"
            for field, value in obj.changes.items()
        ]
        return "\n".join(lines) or "-"

    @admin.action(description="Apply to the listing")
    def apply_revisions(self, request, queryset):
        applied = skipped = 0
        for revision in queryset.filter(status=ToolRevisionStatus.SUBMITTED):
            # A field staff edited since the revision was written is not
            # clobbered: the owner is proposing against a version that no longer
            # exists, so the conflict goes back to a human.
            conflicts = revision.conflicting_fields()
            if conflicts:
                ToolRevision.objects.filter(pk=revision.pk).update(
                    admin_comment=f"Not applied: staff changed {', '.join(conflicts)} since."
                )
                skipped += 1
                continue
            with transaction.atomic():
                for field, value in revision.changes.items():
                    # Facets are rows, so they are applied by name. `setattr`
                    # would set an attribute on the instance, report success and
                    # move nothing.
                    if field == "facet_slugs":
                        revision.tool.set_facet_slugs(value)
                    else:
                        setattr(revision.tool, field, value)
                revision.tool.save()
            ToolRevision.objects.filter(pk=revision.pk).update(
                status=ToolRevisionStatus.APPROVED,
                reviewed_by=request.user,
                reviewed_at=timezone.now(),
                applied_at=timezone.now(),
            )
            applied += 1
        message = f"{applied} revision(s) applied."
        if skipped:
            message += f" {skipped} left open: staff edited the same field since."
        self.message_user(request, message)

    @admin.action(description="Reject")
    def reject_revisions(self, request, queryset):
        count = queryset.update(
            status=ToolRevisionStatus.REJECTED,
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )
        self.message_user(request, f"{count} revision(s) rejected.")


@admin.register(PriceProposal)
class PriceProposalAdmin(ModelAdmin):
    """The queue staff will live in.

    The proposal sits beside the currently published figure and its provenance,
    so a disputed price is settled against evidence rather than assertion.
    """

    list_display = (
        "tool",
        "plan",
        "origin",
        "previous_display",
        "proposed_display",
        "status",
        "created_at",
    )
    list_filter = ("status", "origin")
    search_fields = ("tool__name", "author__email", "rationale")
    readonly_fields = (
        "tool",
        "plan",
        "proposed_plan_name",
        "amount",
        "currency",
        "unit",
        "billing_period",
        "is_free_tier",
        "is_trial",
        "trial_days",
        "is_enterprise_quote",
        "origin",
        "author",
        "rationale",
        "evidence_url",
        "previous_display",
        "published_price",
        "reviewed_by",
        "reviewed_at",
        "applied_at",
        "created_at",
        "updated_at",
    )
    fields = (*readonly_fields, "status", "admin_comment")
    actions = ("approve_proposals", "reject_proposals")

    @admin.display(description="Currently published")
    def previous_display(self, obj):
        if obj.previous_amount is None:
            return "-"
        return f"{obj.previous_amount} {obj.previous_currency}/{obj.previous_unit}"

    @admin.display(description="Proposed")
    def proposed_display(self, obj):
        if obj.amount is None:
            return "quote only" if obj.is_enterprise_quote else "-"
        return f"{obj.amount} {obj.currency}/{obj.unit}"

    @admin.display(description="Published figure and its provenance")
    def published_price(self, obj):
        price = obj.plan.prices.filter(is_current=True).first() if obj.plan else None
        if price is None:
            return "Nothing published for this plan."
        return f"{price.amount} {price.currency}/{price.unit} - {price.get_source_display()}"

    @admin.action(description="Approve - publish as vendor-supplied")
    def approve_proposals(self, request, queryset):
        published = 0
        for proposal in queryset.filter(status=PriceProposalStatus.PENDING, plan__isnull=False):
            now = timezone.now()
            # Close the old row rather than editing it: the profile shows a
            # history, and an edited row destroys the evidence of what changed.
            proposal.plan.prices.filter(is_current=True).update(is_current=False, effective_to=now)
            PlanPrice.objects.create(
                plan=proposal.plan,
                currency=proposal.currency,
                amount=proposal.amount,
                unit=proposal.unit,
                billing_period=proposal.billing_period,
                effective_from=now,
                source=PriceSource.VENDOR,
                is_pinned=True,
                entered_by=request.user,
                source_note=(
                    f"Vendor-supplied, reviewed {now:%Y-%m-%d}. Not independently verified."
                ),
                source_evidence_url=proposal.evidence_url,
            )
            Tool.objects.filter(pk=proposal.tool_id).update(
                prices_changed_at=now, last_verified_at=now
            )
            PriceProposal.objects.filter(pk=proposal.pk).update(
                status=PriceProposalStatus.APPROVED,
                reviewed_by=request.user,
                reviewed_at=now,
                applied_at=now,
            )
            published += 1
        self.message_user(request, f"{published} price(s) published as vendor-supplied.")

    @admin.action(description="Reject")
    def reject_proposals(self, request, queryset):
        count = queryset.update(
            status=PriceProposalStatus.REJECTED,
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )
        self.message_user(request, f"{count} proposal(s) rejected. Say why in the comment.")
