from .db import db
from datetime import datetime


def get_user(email):
    """Fetch a user document by email."""
    return db["users"].find_one({"email": email})


def upsert_user(email):
    """
    Create a user record on first login if one doesn't exist.
    Safe to call on every authenticated request.
    """
    db["users"].update_one(
        {"email": email},
        {
            "$setOnInsert": {
                "email": email,
                "created_at": datetime.utcnow(),
                "access": []
            }
        },
        upsert=True
    )
