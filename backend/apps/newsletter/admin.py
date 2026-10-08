from django.contrib import admin
from unfold.admin import ModelAdmin

from apps.newsletter.models import Subscriber


@admin.register(Subscriber)
class SubscriberAdmin(ModelAdmin):
    list_display = ("email", "status", "reviews", "new_tools", "benchmarks", "created_at")
    list_filter = ("status", "reviews", "new_tools", "benchmarks")
    search_fields = ("email",)
    ordering = ("-created_at",)
    # The consent trail: when they asked, confirmed and left. Staff never forge it.
    readonly_fields = ("created_at", "updated_at", "confirmed_at", "unsubscribed_at")
