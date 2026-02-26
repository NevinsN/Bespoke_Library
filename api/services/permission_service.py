"""
permission_service.py

Central authority for all access control decisions.

Resolution order (first match wins):
  1. App-level admin (env var)          → full access to everything
  2. Series owner                        → full access to all manuscripts in series
  3. Manuscript owner                    → full access to that manuscript
  4. Series author                       → all drafts of all books in series
  5. Manuscript author                   → all drafts of that manuscript
  6. Series reader                       → read access to all manuscripts in series
  7. Manuscript reader                   → read access to all drafts
  8. Draft reader                        → read access to that draft only

Authors always see all drafts — draft-level restrictions are reader-only.
Owners can exist at series or manuscript level.
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

ADMIN_EMAILS = [e.strip() for e in os.getenv("ADMIN_EMAIL", "").split(",") if e]


# ─── Core resolution ──────────────────────────────────────────────────────────

def resolve_effective_role(email, series_id=None, manuscript_id=None, draft_id=None):
    if email:
        email = email.lower()
    """
    Returns the highest effective role the user has for the given scope,
    or None if no access.

    Pass the most specific scope you want to check.
    Walks up the hierarchy automatically.
    """
    if email in ADMIN_EMAILS:
        return "owner"

    grants = get_grants_for_user(email)
    grant_map = {(g["scope_type"], g["scope_id"]): g["role"] for g in grants}

    # Check series-level grants
    if series_id:
        role = grant_map.get(("series", str(series_id)))
        if role in ("owner", "author", "reader"):
            return role

    # Check manuscript-level grants
    if manuscript_id:
        role = grant_map.get(("manuscript", str(manuscript_id)))
        if role in ("owner", "author", "reader"):
            return role

    # Check draft-level grants (readers only)
    if draft_id:
        role = grant_map.get(("draft", str(draft_id)))
        if role == "reader":
            return "reader"

    return None


def can_read(email, series_id=None, manuscript_id=None, draft_id=None):
    role = resolve_effective_role(email, series_id, manuscript_id, draft_id)
    return role is not None


def can_write(email, series_id=None, manuscript_id=None):
    """Authors and owners can write. Draft-level grants never confer write access."""
    role = resolve_effective_role(email, series_id, manuscript_id)
    return role in ("owner", "author")


def can_manage(email, series_id=None, manuscript_id=None):
    """Only owners can manage access and delete."""
    role = resolve_effective_role(email, series_id, manuscript_id)
    return role == "owner"


# ─── Visible content for a user ───────────────────────────────────────────────

def get_visible_manuscripts(email):
    """
    Returns all manuscripts the user can see, with their accessible drafts.
    Handles the full hierarchy in one place.
    """
    if email in ADMIN_EMAILS:
        manuscripts = get_all_manuscripts()
        return _attach_all_drafts(manuscripts)

    if not email:
        return []

    grants = get_grants_for_user(email)

    visible_manuscript_ids = set()  # manuscripts the user can fully see
    draft_only_ids = set()          # specific drafts visible via draft-level grants

    for grant in grants:
        scope_type = grant["scope_type"]
        scope_id = grant["scope_id"]
        role = grant["role"]

        if scope_type == "series":
            # Series grant → all manuscripts in that series
            manuscripts = get_manuscripts_for_series(scope_id)
            for m in manuscripts:
                visible_manuscript_ids.add(str(m["_id"]))

        elif scope_type == "manuscript":
            visible_manuscript_ids.add(scope_id)

        elif scope_type == "draft" and role == "reader":
            draft_only_ids.add(scope_id)

    result = []

    # Fully visible manuscripts — user sees all their drafts
    if visible_manuscript_ids:
        manuscripts = get_manuscripts_by_ids(list(visible_manuscript_ids))
        result.extend(_attach_all_drafts(manuscripts))

    # Draft-only access — build minimal manuscript shells
    if draft_only_ids:
        draft_only_entries = _build_draft_only_entries(
            draft_only_ids, visible_manuscript_ids
        )
        result.extend(draft_only_entries)

    # Public drafts — visible to all authenticated users
    public_drafts = get_public_drafts()
    if public_drafts:
        public_entries = _build_draft_only_entries(
            {str(d["_id"]) for d in public_drafts}, visible_manuscript_ids
        )
        result.extend(public_entries)

    # Deduplicate by manuscript _id (series + manuscript grants may overlap)
    seen = set()
    deduped = []
    for m in result:
        if m["_id"] not in seen:
            seen.add(m["_id"])
            deduped.append(m)

    return sorted(deduped, key=lambda m: (m.get("series_name", ""), m.get("display_name", "")))


def _attach_all_drafts(manuscripts):
    """Attach all drafts to each manuscript document."""
    result = []
    for m in manuscripts:
        m["_id"] = str(m["_id"])
        drafts = get_drafts_for_manuscript(m["_id"])
        m["drafts"] = [{"_id": str(d["_id"]), "name": d["name"], "public": d.get("public", False)} for d in drafts]
        result.append(m)
    return result


def _build_draft_only_entries(draft_ids, already_visible_manuscript_ids):
    """
    For users with only draft-level access, construct minimal manuscript
    entries showing only the drafts they can see.
    """
    from repositories.draft_repo import get_drafts_by_ids
    from repositories.manuscript_repo import get_manuscript_by_id

    drafts = get_drafts_by_ids(list(draft_ids))

    # Group drafts by manuscript
    by_manuscript = {}
    for d in drafts:
        mid = d["manuscript_id"]
        if mid in already_visible_manuscript_ids:
            continue  # already handled above
        by_manuscript.setdefault(mid, []).append(d)

    result = []
    for manuscript_id, drafts in by_manuscript.items():
        manuscript = get_manuscript_by_id(manuscript_id)
        if not manuscript:
            continue
        manuscript["_id"] = str(manuscript["_id"])
        manuscript["drafts"] = [
            {"_id": str(d["_id"]), "name": d["name"], "public": d.get("public", False)} for d in drafts
        ]
        result.append(manuscript)

    return result


# ─── Access management (called by owner-only routes) ──────────────────────────

def add_access(granted_by_email, email, scope_type, scope_id, role):
    """
    Grant access. Validates that the granting user has owner rights
    at the relevant scope before writing.

    Raises PermissionError if the granter doesn't have owner rights.
    """
    # Resolve the series/manuscript context for permission check
    series_id = scope_id if scope_type == "series" else None
    manuscript_id = scope_id if scope_type == "manuscript" else None

    # For draft-level grants, check manuscript ownership
    if scope_type == "draft":
        from repositories.draft_repo import get_draft_by_id
        draft = get_draft_by_id(scope_id)
        if draft:
            manuscript_id = draft["manuscript_id"]

    if not can_manage(granted_by_email, series_id=series_id, manuscript_id=manuscript_id):
        raise PermissionError(f"{granted_by_email} does not have owner rights to grant access here.")

    # Owners can only be granted at series or manuscript level
    if role == "owner" and scope_type == "draft":
        raise ValueError("Ownership cannot be granted at draft level.")

    # Authors can only be granted at series or manuscript level
    if role == "author" and scope_type == "draft":
        raise ValueError("Author access cannot be granted at draft level.")

    grant_access(email, scope_type, scope_id, role, granted_by=granted_by_email)


def remove_access(granted_by_email, email, scope_type, scope_id):
    """Revoke access. Same ownership check as add_access."""
    series_id = scope_id if scope_type == "series" else None
    manuscript_id = scope_id if scope_type == "manuscript" else None

    if not can_manage(granted_by_email, series_id=series_id, manuscript_id=manuscript_id):
        raise PermissionError(f"{granted_by_email} does not have owner rights to revoke access here.")

    revoke_access(email, scope_type, scope_id)


def list_access_for_scope(requesting_email, scope_type, scope_id):
    """Returns all grants for a scope. Only owners can see this."""
    series_id = scope_id if scope_type == "series" else None
    manuscript_id = scope_id if scope_type == "manuscript" else None

    if not can_manage(requesting_email, series_id=series_id, manuscript_id=manuscript_id):
        raise PermissionError("Only owners can view access lists.")

    return get_grants_for_scope(scope_type, scope_id)
