"""
message_repo.py — Support messages from users to admins.
"""

from .db import db, serialize, serialize_list
from bson.objectid import ObjectId
from datetime import datetime


def create_message(user_id, username, subject, body):
    doc = {
        "user_id":    user_id,
        "username":   username,
        "subject":    subject.strip(),
        "body":       body.strip(),
        "status":     "unread",
        "created_at": datetime.utcnow(),
        "resolved_at": None,
        "resolved_by": None,
        "admin_note":  None,
    }
    result = db["messages"].insert_one(doc)
    return str(result.inserted_id)


def get_messages(status=None):
    query = {}
    if status:
        query["status"] = status
    return serialize_list(
        db["messages"].find(query).sort("created_at", -1)
    )


def get_message(message_id):
    return serialize(db["messages"].find_one({"_id": ObjectId(message_id)}))


def resolve_message(message_id, admin_id, admin_note=None):
    db["messages"].update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {
            "status":      "resolved",
            "resolved_at": datetime.utcnow(),
            "resolved_by": admin_id,
            "admin_note":  admin_note,
        }}
    )


def mark_message_read(message_id):
    db["messages"].update_one(
        {"_id": ObjectId(message_id)},
        {"$set": {"status": "read"}}
    )


def get_unread_count():
    return db["messages"].count_documents({"status": "unread"})
