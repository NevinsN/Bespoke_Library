from .db import db, serialize, serialize_list
from bson.objectid import ObjectId
from datetime import datetime


# ─── Write ────────────────────────────────────────────────────────────────────

def grant_access(email, scope_type, scope_id, role, granted_by):
    """
    Grant a user access at a given scope.
    Upserts on (email, scope_type, scope_id) — no duplicate grants.
    scope_type: 'series' | 'manuscript' | 'draft'
    role:       'owner'  | 'author'     | 'reader'
    """
    db["access"].update_one(
        {
            "email": email,
            "scope_type": scope_type,
            "scope_id": str(scope_id),
        },
        {
            "$set": {
                "role": role,
                "granted_by": granted_by,
                "granted_at": datetime.utcnow(),
            },
            "$setOnInsert": {
                "email": email,
                "scope_type": scope_type,
                "scope_id": str(scope_id),
            }
        },
        upsert=True
    )


def revoke_access(email, scope_type, scope_id):
    """Remove a specific access grant."""
    db["access"].delete_one({
        "email": email,
        "scope_type": scope_type,
        "scope_id": str(scope_id),
    })


# ─── Read ─────────────────────────────────────────────────────────────────────

def get_grants_for_user(email):
    """All access grants for a user, across all scopes."""
    return serialize_list(db["access"].find({"email": email}))


def get_grants_for_scope(scope_type, scope_id):
    """All grants for a given scope (e.g. all people with access to a manuscript)."""
    return serialize_list(db["access"].find({
        "scope_type": scope_type,
        "scope_id": str(scope_id),
    }))


def get_user_role_for_scope(email, scope_type, scope_id):
    """
    Returns the role string for a specific (user, scope) pair, or None.
    """
    grant = db["access"].find_one({
        "email": email,
        "scope_type": scope_type,
        "scope_id": str(scope_id),
    })
    return grant["role"] if grant else None


def get_series_ids_for_user(email, role=None):
    """All series scope_ids this user has a grant on (optionally filtered by role)."""
    query = {"email": email, "scope_type": "series"}
    if role:
        query["role"] = role
    return [g["scope_id"] for g in db["access"].find(query)]


def get_manuscript_ids_for_user(email, role=None):
    """All manuscript scope_ids this user has a grant on."""
    query = {"email": email, "scope_type": "manuscript"}
    if role:
        query["role"] = role
    return [g["scope_id"] for g in db["access"].find(query)]


def get_draft_ids_for_user(email, role=None):
    """All draft scope_ids this user has a reader grant on."""
    query = {"email": email, "scope_type": "draft"}
    if role:
        query["role"] = role
    return [g["scope_id"] for g in db["access"].find(query)]
