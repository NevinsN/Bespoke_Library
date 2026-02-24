# routes/novel_routes.py

import azure.functions as func
from services.novel_service import get_authorized_novels, get_manuscript_toc, get_full_chapter
from utils.auth import extract_user
from utils.response import ok, error


def handle_get_novels(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user = extract_user(req)
        novels = get_authorized_novels(user if user else {})
        # Serialize ObjectIds
        for n in novels:
            n['_id'] = str(n['_id'])
        return ok(novels)
    except Exception as e:
        return error(str(e))


def handle_get_chapters(req: func.HttpRequest) -> func.HttpResponse:
    try:
        manuscript_id = req.params.get('manuscript_id')
        if not manuscript_id:
            return error("Missing manuscript_id", 400)
        chapters = get_manuscript_toc(manuscript_id)
        return ok(chapters)
    except Exception as e:
        return error(str(e))


def handle_get_chapter_content(req: func.HttpRequest) -> func.HttpResponse:
    try:
        chapter_id = req.params.get('id')
        if not chapter_id:
            return error("Missing chapter id", 400)
        chapter = get_full_chapter(chapter_id)
        if not chapter:
            return error("Chapter not found", 404)
        return ok(chapter)
    except Exception as e:
        return error(str(e))
