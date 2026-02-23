# repositories/novel_repo.py

from .db import db
from bson.objectid import ObjectId
from datetime import datetime

# -----------------------------
# Novel / Draft Retrieval
# -----------------------------

def get_aggregated_novels():
    """
    Returns a summary of novels grouped by manuscript_id,
    including first display name and total word count.
    """
    pipeline = [
        {"$group": {
            "_id": "$manuscript_id",
            "display_name": {"$first": "$display_name"},
            "total_word_count": {"$sum": "$total_word_count"}
        }}
    ]
    return list(db['novels'].aggregate(pipeline))


def get_novels_for_user(email=None):
    """
    Returns all drafts visible to a user:
      - owner or co-author
      - allowed readers
      - public novels
    """
    if email:
        query = {
            "$or": [
                {"owner": email},
                {"authors": email},
                {"allowed_readers": email},
                {"is_public": True}
            ]
        }
    else:
        query = {"is_public": True}

    return list(db['novels'].find(query).sort([("series_name", 1), ("book_name", 1)]))


def get_draft_by_id(draft_id):
    """Fetch a single draft by its _id"""
    return db['novels'].find_one({"_id": ObjectId(draft_id)})


# -----------------------------
# Chapters / Sequential Handling
# -----------------------------

def insert_chapter(chapter_doc):
    """
    Insert a new chapter into a draft document.
    Expects chapter_doc to include:
      - manuscript_id
      - draft_name
      - title
      - content
      - order (optional)
      - filename (optional)
    Returns inserted_id.
    """
    chapter_doc.setdefault("date_added", datetime.utcnow())
    result = db['novels'].insert_one(chapter_doc)
    return result.inserted_id


def update_chapter(chapter_id, updates):
    """
    Update an existing chapter by _id.
    """
    if "_id" in updates:
        updates.pop("_id")
    res = db['novels'].update_one({"_id": ObjectId(chapter_id)}, {"$set": updates})
    return res.modified_count


def find_chapter_by_filename(draft_name, filename, manuscript_id=None):
    """
    Check if a file with the same name exists in a draft.
    Optional: filter by manuscript_id.
    Returns first matching chapter or None.
    """
    query = {"draft_name": draft_name, "filename": filename}
    if manuscript_id:
        query["manuscript_id"] = manuscript_id
    return db['novels'].find_one(query)


def get_chapters_for_draft(manuscript_id, draft_name):
    """
    Returns all chapters for a draft, sorted by order.
    Content is excluded for listing purposes.
    """
    return list(
        db['novels']
        .find({"manuscript_id": manuscript_id, "draft_name": draft_name}, {"content": 0})
        .sort("order", 1)
    )


def get_next_order(manuscript_id, draft_name):
    """
    Returns the next available order index for sequential uploads.
    """
    last = list(
        db['novels']
        .find({"manuscript_id": manuscript_id, "draft_name": draft_name})
        .sort("order", -1)
        .limit(1)
    )
    if not last:
        return 0
    return last[0].get("order", 0) + 1


def get_chapters_by_manuscript(manuscript_id):
    """Legacy-style fetch of all chapters for a manuscript"""
    return list(db['novels'].find({"manuscript_id": manuscript_id}, {"content": 0}).sort("order", 1))


def get_chapter_by_id(ch_id):
    """Legacy fetch a single chapter"""
    return db['novels'].find_one({"_id": ObjectId(ch_id)})


def get_neighboring_chapter(manuscript_id, order_offset):
    """Fetch a chapter at a specific order index"""
    return db['novels'].find_one({"manuscript_id": manuscript_id, "order": order_offset}, {"_id": 1})


# -----------------------------
# Draft / Manuscript Utilities
# -----------------------------

def get_drafts_for_book(manuscript_id):
    """Return all draft names for a manuscript"""
    return db['novels'].distinct("draft_name", {"manuscript_id": manuscript_id})


def delete_chapter(chapter_id):
    """Delete chapter by _id"""
    res = db['novels'].delete_one({"_id": ObjectId(chapter_id)})
    return res.deleted_count


# -----------------------------
# User Utilities
# -----------------------------

def get_user_record(email):
    """Fetch a user document by email"""
    return db['users'].find_one({"email": email})