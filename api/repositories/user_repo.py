from .db import db, serialize
from datetime import datetime


def get_user_by_sub(auth0_sub):
    return serialize(db["users"].find_one({"auth0_sub": auth0_sub}))


def get_user_by_username(username):
    return serialize(db["users"].find_one({"username": username.lower()}))


def upsert_user_by_sub(auth0_sub, email=None):
    """
    Create user on first login. If email provided, always keep it up to date.
    Email is stored so the permission system can look it up by sub.
    """
    now = datetime.utcnow()

    if email:
        db["users"].update_one(
            {"auth0_sub": auth0_sub},
            {
                "$set":         {"email": email.lower()},
                "$setOnInsert": {
                    "auth0_sub":  auth0_sub,
                    "created_at": now,
                    "username":   None,
                }
            },
            upsert=True
        )
    else:
        db["users"].update_one(
            {"auth0_sub": auth0_sub},
            {"$setOnInsert": {
                "auth0_sub":  auth0_sub,
                "created_at": now,
                "username":   None,
            }},
            upsert=True
        )


def set_username(auth0_sub, username):
    username = username.lower().strip()
    existing = get_user_by_username(username)
    if existing and existing.get("auth0_sub") != auth0_sub:
        return False
    db["users"].update_one(
        {"auth0_sub": auth0_sub},
        {"$set": {"username": username}}
    )
    return True
