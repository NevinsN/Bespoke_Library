"""
application_repo.py — Author applications.
"""

from .db import db, serialize, serialize_list
from bson.objectid import ObjectId
from datetime import datetime

VALID_STATUSES = {"pending", "approved", "rejected"}


def create_application(name, email, background, project_description, links=""):
    doc = {
        "name":                name.strip(),
        "email":               email.strip().lower(),
        "background":          background.strip(),
        "project_description": project_description.strip(),
        "links":               links.strip(),
        "status":              "pending",
        "created_at":          datetime.utcnow(),
        "reviewed_at":         None,
        "reviewed_by":         None,
        "review_note":         None,
        "user_id":             None,  # filled on approval if user exists
    }
    result = db["applications"].insert_one(doc)
    return str(result.inserted_id)


def get_application(application_id):
    return serialize(db["applications"].find_one({"_id": ObjectId(application_id)}))


def get_applications(status=None):
    query = {}
    if status:
        query["status"] = status
    return serialize_list(
        db["applications"].find(query).sort("created_at", -1)
    )


def set_application_status(application_id, status, reviewed_by, review_note=None):
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status: {status}")
    db["applications"].update_one(
        {"_id": ObjectId(application_id)},
        {"$set": {
            "status":      status,
            "reviewed_at": datetime.utcnow(),
            "reviewed_by": reviewed_by,
            "review_note": review_note,
        }}
    )


def link_application_to_user(application_id, user_id):
    db["applications"].update_one(
        {"_id": ObjectId(application_id)},
        {"$set": {"user_id": user_id}}
    )
