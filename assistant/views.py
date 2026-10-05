import json
import uuid

from django.conf import settings
from django.http import JsonResponse, StreamingHttpResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_POST

from .models import Candidate, ChatMessage
from .services.ai_service import AIService, AIServiceError


def index(request):
    candidate = Candidate.objects.filter(is_active=True).first()
    session_key = request.session.get("chat_session")
    if not session_key:
        session_key = uuid.uuid4().hex
        request.session["chat_session"] = session_key
    return render(request, "assistant/index.html", {"candidate": candidate})


@csrf_protect
@require_POST
def chat_api(request):
    """
    POST /api/chat/
    Body: {"question": "..."}
    Streams the answer as text/event-stream-ish plain text chunks.

    On any pre-stream error, returns a normal JSON error (so the
    frontend can distinguish "couldn't even start" from "stream ran").
    """
    try:
        body = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON."}, status=400)

    question = (body.get("question") or "").strip()
    if not question:
        return JsonResponse({"error": "Question is required."}, status=400)

    if len(question) > settings.CHAT_MAX_QUESTION_LENGTH:
        return JsonResponse(
            {"error": f"Question too long (max {settings.CHAT_MAX_QUESTION_LENGTH} characters)."},
            status=400,
        )

    candidate = Candidate.objects.filter(is_active=True).first()
    if not candidate:
        return JsonResponse({"error": "No candidate configured yet."}, status=503)

    # Create the service BEFORE starting the stream, so a config
    # error (missing key) returns a clean 500 JSON, not a broken stream.
    try:
        service = AIService()
    except AIServiceError as e:
        return JsonResponse({"error": e.user_message}, status=e.status_code)

    session_key = request.session.get("chat_session", "anon")

    def event_stream():
        """Generator that Django wraps in a streaming response."""
        collected = []
        try:
            for chunk in service.stream(question, candidate.resume_text):
                collected.append(chunk)
                yield chunk
        except AIServiceError as e:
            # Mid-stream failure — inject a friendly error string.
            err = f"\n\n[error: {e.user_message}]"
            collected.append(err)
            yield err
        finally:
            # Persist chat history after the stream finishes.
            full_answer = "".join(collected).strip()
            if full_answer:
                try:
                    ChatMessage.objects.create(
                        session_key=session_key, role="user", content=question
                    )
                    ChatMessage.objects.create(
                        session_key=session_key, role="assistant", content=full_answer
                    )
                except Exception:
                    pass

    response = StreamingHttpResponse(
        event_stream(),
        content_type="text/plain; charset=utf-8",
    )
    # Disable any buffering
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response