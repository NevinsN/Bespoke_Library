from .db import db, serialize, serialize_list
from bson.objectid import ObjectId
from datetime import datetime


def create_series(name, owner):
    """Create a new series. Returns inserted _id."""
    result = db["series"].insert_one({
        "name": name,
        "owner": owner,
        "created_at": datetime.utcnow(),
    })
    return result.inserted_id


def get_series_by_id(series_id):
    return serialize(db["series"].find_one({"_id": ObjectId(series_id)}))


def get_series_by_name(name):
    return serialize(db["series"].find_one({"name": name}))


def get_all_series():
    return serialize_list(db["series"].find())


def get_series_for_ids(series_ids):
    """Fetch multiple series by a list of _id strings."""
    object_ids = [ObjectId(sid) for sid in series_ids if sid]
    return serialize_list(db["series"].find({"_id": {"$in": object_ids}}))
