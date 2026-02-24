from .db import db
from datetime import datetime, timedelta
import uuid


def create_invite(created_by, scope_type, scope_id, role, expires_days=7, max_uses=1):
    """
    Create a new invite token.
    Returns the full invite document including the token.
    """
    token = str(uuid.uuid4())
    doc = {
        "token": token,
        "created_by": created_by,
        "scope_type": scope_type,
        "scope_id": str(scope_id),
        "role": role,
        "created_at": datetime.utcnow(),
        "expires_at": datetime.utcnow() + timedelta(days=expires_days),
        "max_uses": max_uses,
        "uses": 0,
        "redeemed_by": [],
        "active": True,
    }
    db["invites"].insert_one(doc)
    return doc


def get_invite(token):
    """Fetch an invite by token."""
    return db["invites"].find_one({"token": token})


def redeem_invite(token, email):
    """
    Atomically increment uses and record who redeemed.
    Returns True if successful, False if already maxed out or inactive.
    """
    now = datetime.utcnow()
    result = db["invites"].find_one_and_update(
        {
            "token": token,
            "active": True,
            "expires_at": {"$gt": now},
            "redeemed_by": {"$ne": email},  # Can't redeem twice
            "$expr": {"$lt": ["$uses", "$max_uses"]},
        },
        {
            "$inc": {"uses": 1},
            "$push": {"redeemed_by": email},
        },
        return_document=True
    )
    return result


def revoke_invite(token, revoked_by):
    """Owner can revoke an invite link."""
    db["invites"].update_one(
        {"token": token, "created_by": revoked_by},
        {"$set": {"active": False}}
    )


def get_invites_for_scope(scope_type, scope_id):
    """List all active invites for a scope (for the owner's management view)."""
    return list(db["invites"].find({
        "scope_type": scope_type,
        "scope_id": str(scope_id),
        "active": True,
    }).sort("created_at", -1))
