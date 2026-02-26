from flask import request
from services.author_service import (
    create_new_project,
    list_drafts,
    get_authored_manuscripts,
)
from repositories.draft_repo import get_draft_by_id, set_draft_visibility
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
