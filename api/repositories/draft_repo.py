from .db import db
from bson.objectid import ObjectId
from datetime import datetime


def create_draft(manuscript_id, name):
    """Insert a new draft. Returns inserted _id."""
    result = db["drafts"].insert_one({
        "manuscript_id": str(manuscript_id),
        "name": name,
        "created_at": datetime.utcnow(),
    })
    return result.inserted_id


def get_draft_by_id(draft_id):
    return db["drafts"].find_one({"_id": ObjectId(draft_id)})


def get_draft_by_name(manuscript_id, name):
    return db["drafts"].find_one({"manuscript_id": str(manuscript_id), "name": name})


def get_drafts_for_manuscript(manuscript_id):
    return list(
        db["drafts"]
        .find({"manuscript_id": str(manuscript_id)})
        .sort("created_at", 1)
    )


def get_drafts_by_ids(draft_ids):
    """Fetch multiple drafts by a list of _id strings."""
    object_ids = [ObjectId(did) for did in draft_ids if did]
    return list(db["drafts"].find({"_id": {"$in": object_ids}}))


def delete_draft(draft_id):
    db["drafts"].delete_one({"_id": ObjectId(draft_id)})
