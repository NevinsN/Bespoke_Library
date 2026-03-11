"""
permission_service.py — Access control using auth0_sub (user_id) as identifier.
"""

import os
from repositories.access_repo import (
    get_grants_for_user,
    get_series_ids_for_user,
    get_manuscript_ids_for_user,
    get_draft_ids_for_user,
    grant_access,
    revoke_access,
    get_grants_for_scope,
)
from repositories.series_repo import get_series_for_ids, get_all_series
from repositories.manuscript_repo import (
    get_manuscripts_for_series,
    get_manuscripts_by_ids,
    get_all_manuscripts,
)
from repositories.draft_repo import (
    get_drafts_for_manuscript,
    get_drafts_by_ids,
    get_public_drafts,
)

ADMIN_SUBS = [s.strip() for s in os.getenv("ADMIN_SUB", "").split(",") if s]


def resolve_effective_role(user_id, series_id=None, manuscript_id=None, draft_id=None):
    if not user_id:
        return None

    if user_id in ADMIN_SUBS:
        return "owner"

    grants = get_grants_for_user(user_id)
    grant_map = {(g["scope_type"], g["scope_id"]): g["role"] for g in grants}

    if series_id:
        role = grant_map.get(("series", str(series_id)))
        if role in ("owner", "author", "reader"):
            return role

    if manuscript_id:
        role = grant_map.get(("manuscript", str(manuscript_id)))
        if role in ("owner", "author", "reader"):
            return role

    if draft_id:
        role = grant_map.get(("draft", str(draft_id)))
        if role == "reader":
            return "reader"

    return None


def can_read(user_id, series_id=None, manuscript_id=None, draft_id=None):
    return resolve_effective_role(user_id, series_id, manuscript_id, draft_id) is not None


def can_write(user_id, series_id=None, manuscript_id=None):
    role = resolve_effective_role(user_id, series_id, manuscript_id)
    return role in ("owner", "author")


def can_manage(user_id, series_id=None, manuscript_id=None):
    role = resolve_effective_role(user_id, series_id, manuscript_id)
    return role == "owner"


def get_visible_manuscripts(user_id):
    if user_id in ADMIN_SUBS:
        manuscripts = get_all_manuscripts()
        return _attach_all_drafts(manuscripts)

    if not user_id:
        return []

    grants = get_grants_for_user(user_id)

    visible_manuscript_ids = set()
    draft_only_ids = set()

    for grant in grants:
        scope_type = grant["scope_type"]
        scope_id   = grant["scope_id"]
        role       = grant["role"]

        if scope_type == "series":
            manuscripts = get_manuscripts_for_series(scope_id)
            for m in manuscripts:
                visible_manuscript_ids.add(str(m["_id"]))
        elif scope_type == "manuscript":
            visible_manuscript_ids.add(scope_id)
        elif scope_type == "draft" and role == "reader":
            draft_only_ids.add(scope_id)

    result = []

    if visible_manuscript_ids:
        manuscripts = get_manuscripts_by_ids(list(visible_manuscript_ids))
        result.extend(_attach_all_drafts(manuscripts))

    if draft_only_ids:
        result.extend(_build_draft_only_entries(draft_only_ids, visible_manuscript_ids))

    # Public drafts visible to all authenticated users
    public_drafts = get_public_drafts()
    if public_drafts:
        result.extend(_build_draft_only_entries(
            {str(d["_id"]) for d in public_drafts}, visible_manuscript_ids
        ))

    seen = set()
    deduped = []
    for m in result:
        if m["_id"] not in seen:
            seen.add(m["_id"])
            deduped.append(m)

    return sorted(deduped, key=lambda m: (m.get("series_name", ""), m.get("display_name", "")))


def _attach_all_drafts(manuscripts):
    result = []
    for m in manuscripts:
        m["_id"] = str(m["_id"])
        drafts = get_drafts_for_manuscript(m["_id"])
        m["drafts"] = [{"_id": str(d["_id"]), "name": d["name"], "public": d.get("public", False)} for d in drafts]
        result.append(m)
    return result


def _build_draft_only_entries(draft_ids, already_visible_manuscript_ids):
    from repositories.draft_repo import get_drafts_by_ids
    from repositories.manuscript_repo import get_manuscript_by_id

    drafts = get_drafts_by_ids(list(draft_ids))
    by_manuscript = {}
    for d in drafts:
        mid = d["manuscript_id"]
        if mid in already_visible_manuscript_ids:
            continue
        by_manuscript.setdefault(mid, []).append(d)

    result = []
    for manuscript_id, drafts in by_manuscript.items():
        manuscript = get_manuscript_by_id(manuscript_id)
        if not manuscript:
            continue
        manuscript["_id"] = str(manuscript["_id"])
        manuscript["drafts"] = [
            {"_id": str(d["_id"]), "name": d["name"], "public": d.get("public", False)}
            for d in drafts
        ]
        result.append(manuscript)
    return result


def add_access(granted_by_id, user_id, scope_type, scope_id, role):
    series_id     = scope_id if scope_type == "series"     else None
    manuscript_id = scope_id if scope_type == "manuscript" else None

    if scope_type == "draft":
        from repositories.draft_repo import get_draft_by_id
        draft = get_draft_by_id(scope_id)
        if draft:
            manuscript_id = draft["manuscript_id"]

    if not can_manage(granted_by_id, series_id=series_id, manuscript_id=manuscript_id):
        raise PermissionError(f"{granted_by_id} does not have owner rights to grant access here.")

    if role == "owner" and scope_type == "draft":
        raise ValueError("Ownership cannot be granted at draft level.")
    if role == "author" and scope_type == "draft":
        raise ValueError("Author access cannot be granted at draft level.")

    grant_access(user_id, scope_type, scope_id, role, granted_by=granted_by_id)


def remove_access(granted_by_id, user_id, scope_type, scope_id):
    series_id     = scope_id if scope_type == "series"     else None
    manuscript_id = scope_id if scope_type == "manuscript" else None

    if not can_manage(granted_by_id, series_id=series_id, manuscript_id=manuscript_id):
        raise PermissionError(f"{granted_by_id} does not have owner rights to revoke access here.")

    revoke_access(user_id, scope_type, scope_id)


def list_access_for_scope(requesting_id, scope_type, scope_id):
    series_id     = scope_id if scope_type == "series"     else None
    manuscript_id = scope_id if scope_type == "manuscript" else None

    if not can_manage(requesting_id, series_id=series_id, manuscript_id=manuscript_id):
        raise PermissionError("Only owners can view access lists.")

    return get_grants_for_scope(scope_type, scope_id)
