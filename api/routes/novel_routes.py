import azure.functions as func
from services.novel_service import get_authorized_novels, get_manuscript_toc, get_full_chapter
from utils.auth import extract_user
from utils.response import ok, error


def handle_get_novels(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user = extract_user(req)
        novels = get_authorized_novels(user if user else {})
        return ok(novels)
    except Exception as e:
        return error(str(e))


def handle_get_chapters(req: func.HttpRequest) -> func.HttpResponse:
    """Expects ?draft_id=<id>"""
    try:
        user = extract_user(req)
        draft_id = req.params.get("draft_id")
        if not draft_id:
            return error("Missing draft_id", 400)
        chapters, err = get_manuscript_toc(user if user else {}, draft_id)
        if err:
            code = 404 if err == "Draft not found" else 403
            return error(err, code)
        return ok(chapters)
    except Exception as e:
        return error(str(e))


def handle_get_chapter_content(req: func.HttpRequest) -> func.HttpResponse:
    """Expects ?id=<chapter_id>"""
    try:
        user = extract_user(req)
        chapter_id = req.params.get("id")
        if not chapter_id:
            return error("Missing chapter id", 400)
        chapter, err = get_full_chapter(user if user else {}, chapter_id)
        if err:
            code = 404 if "not found" in err else 403
            return error(err, code)
        return ok(chapter)
    except Exception as e:
        return error(str(e))
