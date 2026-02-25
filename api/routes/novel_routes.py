from flask import request
from services.novel_service import get_authorized_novels, get_draft_chapters, get_chapter
from utils.auth import extract_user
from utils.response import ok, error


def handle_get_novels():
    try:
        user   = extract_user()
        email  = user["email"] if user else None
        novels = get_authorized_novels(email)
        return ok(novels)
    except Exception as e:
        return error(str(e))


def handle_get_chapters():
    try:
        user     = extract_user()
        email    = user["email"] if user else None
        draft_id = request.args.get("draft_id") or request.args.get("book")
        if not draft_id:
            return error("Missing draft_id", 400)
        chapters = get_draft_chapters(email, draft_id)
        return ok(chapters)
    except PermissionError as e:
        return error(str(e), 403)
    except ValueError as e:
        return error(str(e), 404)
    except Exception as e:
        return error(str(e))


def handle_get_chapter_content():
    try:
        user       = extract_user()
        email      = user["email"] if user else None
        chapter_id = request.args.get("id")
        if not chapter_id:
            return error("Missing id", 400)
        chapter = get_chapter(email, chapter_id)
        return ok(chapter)
    except PermissionError as e:
        return error(str(e), 403)
    except ValueError as e:
        return error(str(e), 404)
    except Exception as e:
        return error(str(e))
