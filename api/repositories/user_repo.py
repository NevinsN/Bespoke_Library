"""
user_repo.py — User records keyed by Auth0 sub.

No emails stored. The auth0_sub is the stable identifier.
Username is display name shown to authors and in public contexts.
"""

from .db import db, serialize
from datetime import datetime


def get_user_by_sub(auth0_sub):
    """Fetch user by Auth0 sub."""
    return serialize(db["users"].find_one({"auth0_sub": auth0_sub}))


def get_user_by_username(username):
    """Fetch user by username (for uniqueness checks)."""
    return serialize(db["users"].find_one({"username": username.lower()}))


def upsert_user_by_sub(auth0_sub, email=None):
    """
    Create user record on first login. Safe to call on every request.
    Only sets fields on insert — never overwrites username once set.
    """
    set_on_insert = {
        "auth0_sub":  auth0_sub,
        "created_at": datetime.utcnow(),
        "username":   None,
    }
    if email:
        set_on_insert["email_hint"] = email  # stored only for admin reference, not used as identifier

    db["users"].update_one(
        {"auth0_sub": auth0_sub},
        {"$setOnInsert": set_on_insert},
        upsert=True
    )


def set_username(auth0_sub, username):
    """
    Set username for a user. Enforces uniqueness at DB level.
    Returns True on success, False if username taken.
    """
    username = username.lower().strip()

    # Check uniqueness
    existing = get_user_by_username(username)
    if existing and existing.get("auth0_sub") != auth0_sub:
        return False

    db["users"].update_one(
        {"auth0_sub": auth0_sub},
        {"$set": {"username": username}}
    )
    return True
