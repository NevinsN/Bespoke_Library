import re
from datetime import datetime
from services.permission_service import can_write, can_manage
from repositories.series_repo import create_series, get_series_by_name, get_series_by_id
from repositories.manuscript_repo import create_manuscript, get_manuscript_by_id, get_all_manuscripts
from repositories.draft_repo import (
    create_draft,
    get_draft_by_id,
    get_drafts_for_manuscript,
)
from repositories.chapter_repo import (
    insert_chapter,
    update_chapter,
    get_chapter_by_filename,
    get_next_order,
    get_chapters_for_draft,
)
from repositories.access_repo import grant_access, get_grants_for_user
import os

ADMIN_EMAILS = [e.strip() for e in os.getenv("ADMIN_EMAIL", "").split(",") if e]


def get_authored_manuscripts(user_email):
    """
    Returns only manuscripts where the user has owner or author access —
    either directly on the manuscript, or via a series grant.
    This is the authoritative list for what appears in Author Studio.
    """
    if user_email in ADMIN_EMAILS:
        manuscripts = get_all_manuscripts()
    else:
        grants = get_grants_for_user(user_email)

        authored_series_ids = {
            g["scope_id"] for g in grants
            if g["scope_type"] == "series" and g["role"] in ("owner", "author")
        }
        authored_manuscript_ids = {
            g["scope_id"] for g in grants
            if g["scope_type"] == "manuscript" and g["role"] in ("owner", "author")
        }

        # Collect all manuscripts from authored series
        from repositories.manuscript_repo import get_manuscripts_for_series, get_manuscripts_by_ids
        manuscripts = []
        seen = set()

        for sid in authored_series_ids:
            for m in get_manuscripts_for_series(sid):
                mid = str(m["_id"])
                if mid not in seen:
                    seen.add(mid)
                    manuscripts.append(m)

        # Add directly authored manuscripts not already included
        if authored_manuscript_ids:
            remaining = authored_manuscript_ids - seen
            if remaining:
                for m in get_manuscripts_by_ids(list(remaining)):
                    manuscripts.append(m)

    # Attach series name and drafts to each
    result = []
    series_cache = {}
    for m in manuscripts:
        m["_id"] = str(m["_id"])
        sid = m.get("series_id")
        if sid and sid not in series_cache:
            s = get_series_by_id(sid)
            series_cache[sid] = s["name"] if s else "Standalone"
        m["series_name"] = series_cache.get(sid, "Standalone")
        drafts = get_drafts_for_manuscript(m["_id"])
        m["drafts"] = [{"_id": str(d["_id"]), "name": d["name"]} for d in drafts]
        result.append(m)

    return sorted(result, key=lambda m: (m.get("series_name", ""), m.get("display_name", "")))


def create_new_project(body, owner_email):
    series_name  = body.get("series_name", "Standalone")
    book         = body.get("book", "Novel")
    draft_name   = body.get("draft_name", "Draft One")
    display_name = body.get("display_name") or book

    existing_series = get_series_by_name(series_name)
    if existing_series:
        series_id = str(existing_series["_id"])
        if not can_manage(owner_email, series_id=series_id):
            raise PermissionError(f"You do not own the series '{series_name}'.")
    else:
        series_id = str(create_series(series_name, owner_email))
        grant_access(
            email=owner_email, scope_type="series", scope_id=series_id,
            role="owner", granted_by=owner_email,
        )

    manuscript_id = str(create_manuscript(series_id, book, display_name, owner_email))
    draft_id      = str(create_draft(manuscript_id, draft_name))

    grant_access(
        email=owner_email, scope_type="manuscript", scope_id=manuscript_id,
        role="owner", granted_by=owner_email,
    )

    return {
        "series_id": series_id,
        "manuscript_id": manuscript_id,
        "draft_id": draft_id,
        "draft_name": draft_name,
        "display_name": display_name,
    }


def process_uploaded_chapters(user_email, draft_id, files, sequential=True):
    draft = get_draft_by_id(draft_id)
    if not draft:
        raise ValueError("Draft not found.")

    manuscript_id = draft["manuscript_id"]
    manuscript    = get_manuscript_by_id(manuscript_id)
    if not manuscript:
        raise ValueError("Manuscript not found.")

    series_id = manuscript.get("series_id")

    if not can_write(user_email, series_id=series_id, manuscript_id=manuscript_id):
        raise PermissionError("You do not have write access to this draft.")

    result = {"added": [], "updated": []}
    current_order = get_next_order(draft_id) if sequential else None

    for file in files:
        filename = file.get("filename")
        title    = file.get("title") or filename
        content  = file.get("content", "")
        order    = current_order if sequential else int(file.get("slot", 0))

        existing = get_chapter_by_filename(draft_id, filename)
        if existing:
            update_chapter(existing["_id"], {"title": title, "content": content, "order": order})
            result["updated"].append(str(existing["_id"]))
        else:
            new_id = insert_chapter(
                draft_id=draft_id, manuscript_id=manuscript_id,
                title=title, filename=filename, content=content, order=order,
            )
            result["added"].append(str(new_id))

        if sequential:
            current_order += 1

    return result


def get_draft_chapters(user_email, draft_id):
    draft = get_draft_by_id(draft_id)
    if not draft:
        raise ValueError("Draft not found.")
    manuscript = get_manuscript_by_id(draft["manuscript_id"])
    series_id  = manuscript.get("series_id") if manuscript else None
    if not can_write(user_email, series_id=series_id, manuscript_id=draft["manuscript_id"]):
        raise PermissionError("Access denied.")
    chapters = get_chapters_for_draft(draft_id, include_content=False)
    for ch in chapters:
        ch["_id"]      = str(ch["_id"])
        ch["draft_id"] = str(ch["draft_id"])
    return chapters


def list_drafts(user_email, manuscript_id):
    manuscript = get_manuscript_by_id(manuscript_id)
    if not manuscript:
        raise ValueError("Manuscript not found.")
    series_id = manuscript.get("series_id")
    if not can_write(user_email, series_id=series_id, manuscript_id=manuscript_id):
        raise PermissionError("Access denied.")
    drafts = get_drafts_for_manuscript(manuscript_id)
    for d in drafts:
        d["_id"] = str(d["_id"])
    return drafts
