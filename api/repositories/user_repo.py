"""
user_repo.py — User records keyed by auth0_subs array.
Emails stored encrypted at rest via Fernet.
"""

from .db import db, serialize
from utils.encryption import encrypt, decrypt
from datetime import datetime


def get_user_by_sub(auth0_sub):
    return serialize(db["users"].find_one({
        "$or": [
            {"auth0_subs": auth0_sub},
            {"auth0_sub":  auth0_sub},
        ]
    }))


def get_user_by_username(username):
    return serialize(db["users"].find_one({"username": username.lower()}))


def get_decrypted_email(auth0_sub):
    """Return plaintext email for a user, or None. Used only for account linking."""
    user = get_user_by_sub(auth0_sub)
    if not user:
        return None
    return decrypt(user.get("email_enc"))


def upsert_user_by_sub(auth0_sub, email=None):
    """
    Create/update user record. Encrypts email before storing.
    Migrates legacy auth0_sub (singular) to auth0_subs array on touch.
    """
    now = datetime.utcnow()

    # Migrate legacy single-sub record
    db["users"].update_one(
        {"auth0_sub": auth0_sub, "auth0_subs": {"$exists": False}},
        {"$set": {"auth0_subs": [auth0_sub]}, "$unset": {"auth0_sub": ""}}
    )

    update = {
        "$setOnInsert": {
            "auth0_subs": [auth0_sub],
            "created_at": now,
            "username":   None,
        }
    }

    if email:
        update["$set"] = {"email_enc": encrypt(email.lower())}

    result = db["users"].update_one(
        {"auth0_subs": auth0_sub},
        update,
        upsert=True
    )

    # Fire registration event on first-ever insert
    if result.upserted_id:
        try:
            from repositories.event_repo import record_event
            record_event("user_registered", user_id=auth0_sub)
        except Exception:
            pass


def set_username(auth0_sub, username):
    username = username.lower().strip()
    existing = get_user_by_username(username)
    if existing:
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
    Add new_sub to auth0_subs array of user with given username.
    Deletes orphan record for new_sub.
    """
    result = db["users"].update_one(
        {"username": username.lower().strip()},
        {"$addToSet": {"auth0_subs": new_sub}}
    )
    if result.matched_count == 0:
        return False

    # Delete orphan record
    db["users"].delete_one({"auth0_subs": new_sub, "username": None})
    return True
