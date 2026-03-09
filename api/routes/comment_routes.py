from flask import request
from utils.auth import extract_user
from utils.response import ok, error
from repositories.comment_repo import (
    create_comment, get_comments_for_draft,
    set_comment_status, get_comment_by_id,
    get_unread_count_for_manuscripts, VALID_CATEGORIES,
)
from repositories.draft_repo import get_draft_by_id
from repositories.chapter_repo import get_chapter_by_id
from services.permission_service import can_read, can_manage, can_write


def handle_create_comment():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)

        body = request.get_json(silent=True) or {}
        chapter_id      = body.get("chapter_id")
        highlighted_text = body.get("highlighted_text", "").strip()
        paragraph_index  = body.get("paragraph_index", 0)
        category         = body.get("category", "general").lower()
        note             = body.get("note", "").strip()

        if not chapter_id:
            return error("chapter_id is required", 400)
        if category not in VALID_CATEGORIES:
            return error(f"Invalid category", 400)
        if not note:
            return error("note is required", 400)

        chapter = get_chapter_by_id(chapter_id)
        if not chapter:
            return error("Chapter not found", 404)

        draft = get_draft_by_id(chapter["draft_id"])
        if not draft:
            return error("Draft not found", 404)

        if not can_read(user["email"], manuscript_id=draft["manuscript_id"], draft_id=chapter["draft_id"]):
            return error("Forbidden", 403)

        comment_id = create_comment(
            draft_id        = chapter["draft_id"],
            chapter_id      = chapter_id,
            manuscript_id   = draft["manuscript_id"],
            reader_email    = user["email"],
            highlighted_text = highlighted_text,
            paragraph_index  = paragraph_index,
            category         = category,
            note             = note,
        )
        return ok({"comment_id": comment_id})
    except Exception as e:
        return error(str(e))


def handle_get_comments():
    """Author/owner only — get all comments for a draft."""
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)

        draft_id = request.args.get("draft_id")
        if not draft_id:
            return error("draft_id is required", 400)

        draft = get_draft_by_id(draft_id)
        if not draft:
            return error("Draft not found", 404)

        if not can_write(user["email"], manuscript_id=draft["manuscript_id"]):
            return error("Forbidden", 403)

        comments = get_comments_for_draft(draft_id)
        return ok(comments)
    except Exception as e:
        return error(str(e))


def handle_set_comment_status():
    """Author/owner only — flag, accept, or dismiss a comment."""
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)

        body       = request.get_json(silent=True) or {}
        comment_id = body.get("comment_id")
        status     = body.get("status")

        if not comment_id or not status:
            return error("comment_id and status are required", 400)

        comment = get_comment_by_id(comment_id)
        if not comment:
            return error("Comment not found", 404)

        draft = get_draft_by_id(comment["draft_id"])
        if not can_write(user["email"], manuscript_id=draft["manuscript_id"]):
            return error("Forbidden", 403)

        set_comment_status(comment_id, status)
        return ok({"comment_id": comment_id, "status": status})
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(str(e))


def handle_get_unread_count():
    """Returns pending comment count across all authored manuscripts."""
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)

        from services.author_service import get_authored_manuscripts
        manuscripts = get_authored_manuscripts(user["email"])
        manuscript_ids = [m["_id"] for m in manuscripts]
        count = get_unread_count_for_manuscripts(manuscript_ids)
        return ok({"count": count})
    except Exception as e:
        return error(str(e))
