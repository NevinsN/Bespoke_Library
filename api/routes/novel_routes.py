from flask import request
from services.novel_service import get_authorized_novels, get_manuscript_toc, get_full_chapter
from utils.auth import extract_user
from utils.response import ok, error
from repositories.pg_event_repo import record_event


def handle_get_novels():
    try:
        user   = extract_user()
        novels = get_authorized_novels(user or {})
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

        # Record chapter_opened event
        try:
            record_event(
                "chapter_opened",
                user_id=user["id"] if user else None,
                manuscript_id=chapter.get("manuscript_id"),
                draft_id=chapter.get("draft_id"),
                chapter_id=chapter_id,
            )
        except Exception:
            pass  # never let analytics break the read

        return ok(chapter)
    except Exception as e:
        return error(str(e))
