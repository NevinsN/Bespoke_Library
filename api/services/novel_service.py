from services.permission_service import get_visible_manuscripts, can_read, can_write, can_manage
from repositories.series_repo import get_series_by_id
from repositories.chapter_repo import (
    get_chapters_for_draft,
    get_chapter_by_id,
    get_neighboring_chapter,
)
from repositories.draft_repo import get_draft_by_id


def get_authorized_novels(user, author_mode=False):
    """
    Returns the full library view for a user — series → manuscripts → drafts.
    If author_mode=True, admins see only their own manuscripts (not all).
    """
    user_id = user.get("id")
    is_admin = user.get("is_admin", False)

    if is_admin and author_mode:
        # Author mode — use grant-based lookup so admin only sees their own work
        from services.author_service import get_authored_manuscripts
        manuscripts = get_authored_manuscripts(user_id)
    else:
        manuscripts = get_visible_manuscripts(user_id)

    # Attach series name to each manuscript for the frontend grouping
    series_cache = {}
    for m in manuscripts:
        sid = m.get("series_id")
        if sid and sid not in series_cache:
            s = get_series_by_id(sid)
            series_cache[sid] = s["name"] if s else "Standalone"
        m["series_name"] = series_cache.get(sid, "Standalone")

    return manuscripts


def get_manuscript_toc(user, draft_id):
    """
    Returns the chapter list for a draft the user can read.
    Enforces read permission before returning content.
    """
    draft = get_draft_by_id(draft_id)
    if not draft:
        return None, "Draft not found"

    manuscript_id = draft["manuscript_id"]

    if not can_read(user.get("id"), manuscript_id=manuscript_id, draft_id=draft_id):
        return None, "Forbidden"

    chapters = get_chapters_for_draft(draft_id, include_content=False)
    is_author = can_write(user.get("id"), manuscript_id=manuscript_id)  # owners + authors see all

    result = []
    for c in chapters:
        c["_id"] = str(c["_id"])
        c["draft_id"] = str(c["draft_id"])
        status = c.get("status", "published")  # legacy chapters default to published
        if is_author:
            c["status"] = status  # owners see everything with status label
            result.append(c)
        elif status == "published":
            c["status"] = "published"
            result.append(c)
        elif status == "upcoming":
            # Include as teaser — no _id so it can't be clicked
            result.append({"title": c["title"], "word_count": c["word_count"], "status": "upcoming"})
        # hidden: skip entirely
    return result, None


def get_full_chapter(user, chapter_id):
    """
    Returns a chapter with prev/next navigation IDs.
    Enforces read permission.
    """
    chapter = get_chapter_by_id(chapter_id)
    if not chapter:
        return None, "Chapter not found"

    draft_id = str(chapter["draft_id"])
    manuscript_id = str(chapter["manuscript_id"])

    if not can_read(user.get("id"), manuscript_id=manuscript_id, draft_id=draft_id):
        return None, "Forbidden"

    order = chapter["order"]
    prev_ch = get_neighboring_chapter(manuscript_id, draft_id, order, direction="prev")
    next_ch = get_neighboring_chapter(manuscript_id, draft_id, order, direction="next")

    is_author = can_write(user.get("id"), manuscript_id=manuscript_id)

    def accessible(ch):
        """Returns chapter id only if the user can navigate to it."""
        if not ch:
            return None
        status = ch.get("status", "published")
        if is_author or status == "published":
            return str(ch["_id"])
        return None

    chapter["_id"] = str(chapter["_id"])
    chapter["draft_id"] = draft_id
    chapter["manuscript_id"] = manuscript_id
    chapter["prev_id"] = accessible(prev_ch)
    chapter["next_id"] = accessible(next_ch)

    # Pass comments_enabled from draft (default True if not set)
    draft = get_draft_by_id(draft_id)
    chapter["comments_enabled"] = draft.get("comments_enabled", True) if draft else True

    return chapter, None
