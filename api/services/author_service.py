from services.permission_service import can_write, can_manage
from repositories.series_repo import create_series, get_series_by_name
from repositories.manuscript_repo import create_manuscript, get_manuscript_by_id
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
    delete_chapters_for_draft,
)
from repositories.access_repo import grant_access


def create_new_project(body, owner_email):
    """
    Create a new series (if needed) + manuscript + initial draft.
    Automatically grants the creator owner access at the series level.

    Body fields:
      - series_name   (str) — will reuse existing series if name matches
      - book          (str)
      - draft_name    (str) — name of the first draft, defaults to "Draft One"
      - display_name  (str) — optional, defaults to book name
    """
    series_name = body.get("series_name", "Standalone")
    book = body.get("book", "Novel")
    draft_name = body.get("draft_name", "Draft One")
    display_name = body.get("display_name") or book

    # Reuse existing series by name, or create a new one
    existing_series = get_series_by_name(series_name)
    if existing_series:
        series_id = str(existing_series["_id"])
        # Verify the creator has owner rights on this series
        if not can_manage(owner_email, series_id=series_id):
            raise PermissionError(f"You do not own the series '{series_name}'.")
    else:
        series_id = str(create_series(series_name, owner_email))
        # Grant owner access on the new series
        grant_access(
            email=owner_email,
            scope_type="series",
            scope_id=series_id,
            role="owner",
            granted_by=owner_email,
        )

    manuscript_id = str(create_manuscript(series_id, book, display_name, owner_email))
    draft_id = str(create_draft(manuscript_id, draft_name))

    # Grant owner access on the manuscript too (for direct manuscript checks)
    grant_access(
        email=owner_email,
        scope_type="manuscript",
        scope_id=manuscript_id,
        role="owner",
        granted_by=owner_email,
    )

    return {
        "series_id": series_id,
        "manuscript_id": manuscript_id,
        "draft_id": draft_id,
        "draft_name": draft_name,
        "display_name": display_name,
    }


def process_uploaded_chapters(user_email, draft_id, files, sequential=True):
    """
    Upsert chapters into a draft. Enforces write permission.

    Args:
        user_email (str)
        draft_id (str)
        files (list of dicts): {filename, title, content, slot?}
        sequential (bool)

    Returns:
        {"added": [...ids], "updated": [...ids]}
    """
    draft = get_draft_by_id(draft_id)
    if not draft:
        raise ValueError("Draft not found.")

    manuscript_id = draft["manuscript_id"]
    manuscript = get_manuscript_by_id(manuscript_id)
    if not manuscript:
        raise ValueError("Manuscript not found.")

    series_id = manuscript.get("series_id")

    if not can_write(user_email, series_id=series_id, manuscript_id=manuscript_id):
        raise PermissionError("You do not have write access to this draft.")

    result = {"added": [], "updated": []}
    current_order = get_next_order(draft_id) if sequential else None

    for file in files:
        filename = file.get("filename")
        title = file.get("title") or filename
        content = file.get("content", "")
        order = current_order if sequential else int(file.get("slot", 0))

        existing = get_chapter_by_filename(draft_id, filename)

        if existing:
            update_chapter(existing["_id"], {
                "title": title,
                "content": content,
                "order": order,
            })
            result["updated"].append(str(existing["_id"]))
        else:
            new_id = insert_chapter(
                draft_id=draft_id,
                manuscript_id=manuscript_id,
                title=title,
                filename=filename,
                content=content,
                order=order,
            )
            result["added"].append(str(new_id))

        if sequential:
            current_order += 1

    return result


def get_draft_chapters(user_email, draft_id):
    """Returns chapter list for a draft. Enforces write access (author view)."""
    draft = get_draft_by_id(draft_id)
    if not draft:
        raise ValueError("Draft not found.")

    manuscript = get_manuscript_by_id(draft["manuscript_id"])
    series_id = manuscript.get("series_id") if manuscript else None

    if not can_write(user_email, series_id=series_id, manuscript_id=draft["manuscript_id"]):
        raise PermissionError("Access denied.")

    chapters = get_chapters_for_draft(draft_id, include_content=False)
    for ch in chapters:
        ch["_id"] = str(ch["_id"])
        ch["draft_id"] = str(ch["draft_id"])
    return chapters


def list_drafts(user_email, manuscript_id):
    """All drafts for a manuscript. Authors and owners see everything."""
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
