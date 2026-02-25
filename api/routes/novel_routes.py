from flask import request
from services.novel_service import get_authorized_novels, get_manuscript_toc, get_full_chapter
from utils.auth import extract_user
from utils.response import ok, error


def handle_get_novels():
    try:
        user   = extract_user()
        novels = get_authorized_novels(user or {})
        return ok(novels)
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
        return ok(chapter)
    except Exception as e:
        return error(str(e))
