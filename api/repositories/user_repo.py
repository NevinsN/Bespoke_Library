"""
user_repo.py — User records keyed by auth0_subs array.

Supports multiple linked identities per user.
Auth0 sub lookups check the auth0_subs array (or legacy auth0_sub field).
"""

from .db import db, serialize
from datetime import datetime


def get_user_by_sub(auth0_sub):
    """Find user by any sub in their auth0_subs array, or legacy auth0_sub field."""
    return serialize(db["users"].find_one({
        "$or": [
            {"auth0_subs": auth0_sub},
            {"auth0_sub":  auth0_sub},   # legacy single-sub records
        ]
    }))


def get_user_by_username(username):
    return serialize(db["users"].find_one({"username": username.lower()}))


def upsert_user_by_sub(auth0_sub, email=None):
    """
    Create user on first login using auth0_subs array.
    Migrates legacy auth0_sub records to array format on first touch.
    """
    now = datetime.utcnow()

    # Migrate legacy single-sub record to array format
    db["users"].update_one(
        {"auth0_sub": auth0_sub, "auth0_subs": {"$exists": False}},
        {"$set":    {"auth0_subs": [auth0_sub]},
         "$unset":  {"auth0_sub": ""}}
    )

    update = {
        "$setOnInsert": {
            "auth0_subs": [auth0_sub],
            "created_at": now,
            "username":   None,
        }
    }
    if email:
        update["$set"] = {"email": email.lower()}

    db["users"].update_one(
        {"auth0_subs": auth0_sub},
        update,
        upsert=True
    )


def set_username(auth0_sub, username):
    username = username.lower().strip()
    existing = get_user_by_username(username)
    if existing:
        # Check if it's this same user (any of their subs)
        existing_subs = existing.get("auth0_subs") or []
        if auth0_sub not in existing_subs:
            return False
    db["users"].update_one(
        {"auth0_subs": auth0_sub},
        {"$set": {"username": username}}
    )
    return True


def link_sub_to_user(username, new_sub):
    """
    Add new_sub to the auth0_subs array of the user with the given username.
    Also deletes any orphan user record that only has new_sub.
    Returns True on success, False if user not found.
    """
    username = username.lower().strip()

    # Add sub to target user
    result = db["users"].update_one(
        {"username": username},
        {"$addToSet": {"auth0_subs": new_sub}}
    )
    if result.matched_count == 0:
        return False

    # Delete orphan record for new_sub (if it exists and has no username)
    db["users"].delete_one({
        "auth0_subs": new_sub,
        "username":   None,
    })

    return True
