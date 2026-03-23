from flask import request
from services.novel_service import get_authorized_novels, get_manuscript_toc, get_full_chapter
from utils.auth import extract_user
from utils.response import ok, error
from repositories.pg_event_repo import record_event, has_completed_chapter


def handle_get_novels():
    try:
        user   = extract_user()
        mode   = request.args.get("mode", "admin")  # 'author' | 'admin'
        novels = get_authorized_novels(user or {}, author_mode=(mode == "author"))
        meta   = {"is_admin": user.get("is_admin", False) if user else False}
        return ok(novels, meta=meta)
    except Exception as e:
        return error(str(e))


def handle_get_chapters():
    try:
        user     = extract_user()
        draft_id = request.args.get("draft_id") or request.args.get("book")
        if not draft_id:
            return error("Missing draft_id", 400)
        chapters, err = get_manuscript_toc(user or {}, draft_id)
        if err == "Forbidden":
            return error(err, 403)
        if err:
            return error(err, 404)
        return ok(chapters)
    except Exception as e:
        return error(str(e))


def handle_get_chapter_content():
    try:
        user       = extract_user()
        chapter_id = request.args.get("id")
        if not chapter_id:
            return error("Missing id", 400)
        chapter, err = get_full_chapter(user or {}, chapter_id)
        if err == "Forbidden":
            return error(err, 403)
        if err:
            return error(err, 404)

        try:
            record_event(
                "chapter_opened",
                user_id=user["id"] if user else None,
                manuscript_id=chapter.get("manuscript_id"),
                draft_id=chapter.get("draft_id"),
                chapter_id=chapter_id,
            )
        except Exception:
            pass

        return ok(chapter)
    except Exception as e:
        return error(str(e))


def handle_record_event():
    """
    Client-side event recorder.
    Handles: chapter_completed, chapter_navigation, session_start.
    For chapter_completed, detects rereads by checking prior completions.
    """
    try:
        user = extract_user()
        body = request.get_json(silent=True) or {}

        event_type    = body.get("event_type", "")
        manuscript_id = body.get("manuscript_id")
        draft_id      = body.get("draft_id")
        chapter_id    = body.get("chapter_id")

        ALLOWED = {"chapter_completed", "chapter_navigation", "session_start"}
        if event_type not in ALLOWED:
            return error(f"Unknown event type: {event_type}", 400)

        user_id = user["id"] if user else None

        # chapter_completed: check if this user has completed this chapter before
        if event_type == "chapter_completed" and user_id and chapter_id:
            already_completed = has_completed_chapter(user_id, chapter_id)
            if already_completed:
                event_type = "chapter_reread"

        record_event(
            event_type,
            user_id=user_id,
            manuscript_id=manuscript_id,
            draft_id=draft_id,
            chapter_id=chapter_id,
        )
        return ok({"recorded": True, "event_type": event_type})
    except Exception as e:
        return error(str(e))
