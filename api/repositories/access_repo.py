from .db import db, serialize, serialize_list
from bson.objectid import ObjectId
from datetime import datetime


# ─── Write ────────────────────────────────────────────────────────────────────

def grant_access(user_id, scope_type, scope_id, role, granted_by):
    """
    Grant a user access at a given scope. Keyed by user_id (auth0_sub).
    Upserts on (user_id, scope_type, scope_id) — no duplicate grants.
    """
    db["access"].update_one(
        {
            "user_id":    user_id,
            "scope_type": scope_type,
            "scope_id":   str(scope_id),
        },
        {
            "$set": {
                "role":       role,
                "granted_by": granted_by,
                "granted_at": datetime.utcnow(),
            },
            "$setOnInsert": {
                "user_id":    user_id,
                "scope_type": scope_type,
                "scope_id":   str(scope_id),
            }
        },
        upsert=True
    )


def revoke_access(user_id, scope_type, scope_id):
    db["access"].delete_one({
        "user_id":    user_id,
        "scope_type": scope_type,
        "scope_id":   str(scope_id),
    })


# ─── Read ─────────────────────────────────────────────────────────────────────

def get_grants_for_user(user_id):
    return serialize_list(db["access"].find({"user_id": user_id}))


def get_grants_for_scope(scope_type, scope_id):
    return serialize_list(db["access"].find({
        "scope_type": scope_type,
        "scope_id":   str(scope_id),
    }))


def get_user_role_for_scope(user_id, scope_type, scope_id):
    grant = db["access"].find_one({
        "user_id":    user_id,
        "scope_type": scope_type,
        "scope_id":   str(scope_id),
    })
    return grant["role"] if grant else None


def get_series_ids_for_user(user_id, role=None):
    query = {"user_id": user_id, "scope_type": "series"}
    if role:
        query["role"] = role
    return [g["scope_id"] for g in db["access"].find(query)]


def get_manuscript_ids_for_user(user_id, role=None):
    query = {"user_id": user_id, "scope_type": "manuscript"}
    if role:
        query["role"] = role
    return [g["scope_id"] for g in db["access"].find(query)]


def get_draft_ids_for_user(user_id, role=None):
    query = {"user_id": user_id, "scope_type": "draft"}
    if role:
        query["role"] = role
    return [g["scope_id"] for g in db["access"].find(query)]
