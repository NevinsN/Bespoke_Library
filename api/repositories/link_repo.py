"""
link_repo.py — Account link verification tokens.
"""

from .db import db
from datetime import datetime, timedelta
import secrets


def create_link_token(new_sub, target_username):
    """Create a verification token for linking new_sub to target_username's account."""
    token = secrets.token_urlsafe(32)
    db["link_tokens"].insert_one({
        "token":            token,
        "new_sub":          new_sub,
        "target_username":  target_username.lower(),
        "created_at":       datetime.utcnow(),
        "expires_at":       datetime.utcnow() + timedelta(hours=24),
        "used":             False,
    })
    return token


def get_link_token(token):
    doc = db["link_tokens"].find_one({"token": token, "used": False})
    if not doc:
        return None
    if doc["expires_at"] < datetime.utcnow():
        return None
    return doc


def consume_link_token(token):
    """Mark token as used. Returns the token doc or None."""
    doc = get_link_token(token)
    if not doc:
        return None
    db["link_tokens"].update_one(
        {"token": token},
        {"$set": {"used": True, "used_at": datetime.utcnow()}}
    )
    return doc
