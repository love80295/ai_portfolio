from django.contrib import admin
from .models import Candidate, ChatMessage


@admin.register(Candidate)
class CandidateAdmin(admin.ModelAdmin):
    list_display = ("name", "headline", "email", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "email")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        ("Identity", {
            "fields": ("name", "headline", "avatar_path", "is_active")
        }),
        ("Contact", {
            "fields": ("email", "location", "github_url")
        }),
        ("Resume (this is what the AI reads)", {
            "fields": ("resume_text",),
            "description": (
                "Paste the full resume as plain text. "
                "The AI will answer questions ONLY from this text."
            ),
        }),
        ("Timestamps", {
            "classes": ("collapse",),
            "fields": ("created_at", "updated_at"),
        }),
    )


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ("session_key", "role", "short_content", "created_at")
    list_filter = ("role",)
    readonly_fields = ("session_key", "role", "content", "created_at")

    def short_content(self, obj):
        return obj.content[:60] + ("…" if len(obj.content) > 60 else "")

    def has_add_permission(self, request):
        return False