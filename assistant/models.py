from django.db import models


class Candidate(models.Model):
    """
    The person this AI represents.
    The resume text is the single source of truth for the AI.
    """

    name = models.CharField(max_length=120)
    headline = models.CharField(
        max_length=200,
        blank=True,
        help_text="Short tagline, e.g. 'B.Tech CSE Student | Backend & AI Developer'",
    )
    email = models.EmailField(blank=True)
    location = models.CharField(max_length=120, blank=True)
    github_url = models.URLField(blank=True)

    # 👇 THE resume. Plain text. The AI reads this.
    resume_text = models.TextField(
        help_text="Paste the full resume as plain text here.",
    )

    # Path to a static avatar, e.g. "images/avatar.png"
    avatar_path = models.CharField(
        max_length=200,
        blank=True,
        default="images/avatar.png",
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_active", "name"]

    def __str__(self):
        return self.name


class ChatMessage(models.Model):
    """Optional: stores chat history for the recruiter's session."""

    class Role(models.TextChoices):
        USER = "user", "User"
        ASSISTANT = "assistant", "Assistant"

    session_key = models.CharField(max_length=64, db_index=True)
    role = models.CharField(max_length=20, choices=Role.choices)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"[{self.role}] {self.content[:40]}"