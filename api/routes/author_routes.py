from flask import request
from services.author_service import (
    create_new_project,
    list_drafts,
    get_authored_manuscripts,
)
from repositories.draft_repo import get_draft_by_id, set_draft_visibility, set_comments_enabled
from repositories.chapter_repo import get_chapter_by_id, set_chapter_status, publish_all_chapters, delete_chapter, reorder_chapters, replace_chapter_content
from services.permission_service import can_manage
from utils.auth import extract_user
from utils.response import ok, error


def handle_get_authored_manuscripts():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)
        manuscripts = get_authored_manuscripts(user["email"])
        return ok(manuscripts)
    except Exception as e:
        return error(str(e))


def handle_create_project():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)
        body = request.get_json(silent=True) or {}
        if not body.get("series_name") or not body.get("book"):
            return error("series_name and book are required", 400)
        result = create_new_project(body, owner_email=user["email"])
        return ok(result)
    except PermissionError as e:
        return error(str(e), 403)
    except Exception as e:
        return error(str(e))


def handle_get_drafts():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)
        manuscript_id = request.args.get("manuscript_id")
        if not manuscript_id:
            return error("Missing manuscript_id", 400)
        drafts = list_drafts(user["email"], manuscript_id)
        return ok(drafts)
    except PermissionError as e:
        return error(str(e), 403)
    except ValueError as e:
        return error(str(e), 404)
    except Exception as e:
        return error(str(e))


def handle_set_draft_visibility():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)
        body = request.get_json(silent=True) or {}
        draft_id = body.get("draft_id")
        public   = body.get("public")
        if not draft_id or public is None:
            return error("draft_id and public are required", 400)

        # Verify ownership
        draft = get_draft_by_id(draft_id)
        if not draft:
            return error("Draft not found", 404)
        if not can_manage(user["email"], manuscript_id=draft["manuscript_id"]):
            return error("Forbidden", 403)

        set_draft_visibility(draft_id, public)
        return ok({"draft_id": draft_id, "public": public})
    except Exception as e:
        return error(str(e))


def handle_set_chapter_status():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)
        body = request.get_json(silent=True) or {}
        chapter_id = body.get("chapter_id")
        status     = body.get("status")
        if not chapter_id or not status:
            return error("chapter_id and status are required", 400)

        chapter = get_chapter_by_id(chapter_id)
        if not chapter:
            return error("Chapter not found", 404)

        draft = get_draft_by_id(chapter["draft_id"])
        if not draft:
            return error("Draft not found", 404)
        if not can_manage(user["email"], manuscript_id=draft["manuscript_id"]):
            return error("Forbidden", 403)

        set_chapter_status(chapter_id, status)
        return ok({"chapter_id": chapter_id, "status": status})
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(str(e))


def handle_publish_draft():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)
        body = request.get_json(silent=True) or {}
        draft_id = body.get("draft_id")
        if not draft_id:
            return error("draft_id is required", 400)

        draft = get_draft_by_id(draft_id)
        if not draft:
            return error("Draft not found", 404)
        if not can_manage(user["email"], manuscript_id=draft["manuscript_id"]):
            return error("Forbidden", 403)

        publish_all_chapters(draft_id)
        return ok({"draft_id": draft_id, "status": "published"})
    except Exception as e:
        return error(str(e))


def handle_delete_chapter():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)
        body = request.get_json(silent=True) or {}
        chapter_id = body.get("chapter_id")
        if not chapter_id:
            return error("chapter_id is required", 400)

        chapter = get_chapter_by_id(chapter_id)
        if not chapter:
            return error("Chapter not found", 404)

        draft = get_draft_by_id(chapter["draft_id"])
        if not can_manage(user["email"], manuscript_id=draft["manuscript_id"]):
            return error("Forbidden", 403)

        delete_chapter(chapter_id)
        return ok({"deleted": chapter_id})
    except Exception as e:
        return error(str(e))


def handle_set_comments_enabled():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)
        body    = request.get_json(silent=True) or {}
        draft_id = body.get("draft_id")
        enabled  = body.get("enabled")
        if not draft_id or enabled is None:
            return error("draft_id and enabled are required", 400)

        draft = get_draft_by_id(draft_id)
        if not draft:
            return error("Draft not found", 404)
        if not can_manage(user["email"], manuscript_id=draft["manuscript_id"]):
            return error("Forbidden", 403)

        set_comments_enabled(draft_id, enabled)
        return ok({"draft_id": draft_id, "comments_enabled": enabled})
    except Exception as e:
        return error(str(e))


def handle_reorder_chapters():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)

        body = request.get_json(silent=True) or {}
        draft_id    = body.get("draft_id")
        ordered_ids = body.get("ordered_ids", [])

        if not draft_id or not ordered_ids:
            return error("draft_id and ordered_ids are required", 400)

        draft = get_draft_by_id(draft_id)
        if not draft:
            return error("Draft not found", 404)
        if not can_manage(user["email"], manuscript_id=draft["manuscript_id"]):
            return error("Forbidden", 403)

        reorder_chapters(ordered_ids)
        return ok({"reordered": len(ordered_ids)})
    except Exception as e:
        return error(str(e))


def handle_replace_chapter():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)

        body       = request.get_json(silent=True) or {}
        chapter_id = body.get("chapter_id")
        title      = body.get("title")
        content    = body.get("content")

        if not chapter_id or content is None:
            return error("chapter_id and content are required", 400)

        chapter = get_chapter_by_id(chapter_id)
        if not chapter:
            return error("Chapter not found", 404)

        draft = get_draft_by_id(chapter["draft_id"])
        if not can_manage(user["email"], manuscript_id=draft["manuscript_id"]):
            return error("Forbidden", 403)

        replace_chapter_content(chapter_id, title or chapter["title"], content)
        return ok({"chapter_id": chapter_id})
    except Exception as e:
        return error(str(e))
