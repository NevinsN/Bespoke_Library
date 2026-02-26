from .db import db, serialize, serialize_list
from bson.objectid import ObjectId
from datetime import datetime


def create_manuscript(series_id, book, display_name, owner):
    """Insert a new manuscript. Returns inserted _id."""
    result = db["manuscripts"].insert_one({
        "series_id": str(series_id),
        "book": book,
        "display_name": display_name,
        "owner": owner,
        "created_at": datetime.utcnow(),
    })
    return result.inserted_id


def get_manuscript_by_id(manuscript_id):
    return serialize(db["manuscripts"].find_one({"_id": ObjectId(manuscript_id)}))


def get_manuscripts_for_series(series_id):
    """All manuscripts in a series, sorted by book name."""
    return serialize_list(db["manuscripts"]
        .find({"series_id": str(series_id)})
        
    )


def get_manuscripts_by_ids(manuscript_ids):
    """Fetch multiple manuscripts by a list of _id strings."""
    object_ids = [ObjectId(mid) for mid in manuscript_ids if mid]
    return serialize_list(db["manuscripts"].find({"_id": {"$in": object_ids}}))


def get_all_manuscripts():
    """Admin use only."""
    return serialize_list(db["manuscripts"].find())


def delete_manuscript(manuscript_id):
    db["manuscripts"].delete_one({"_id": ObjectId(manuscript_id)})
