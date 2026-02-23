# repositories/author_repo.py

from .db import db
from bson.objectid import ObjectId
from datetime import datetime

# -----------------------------
# Chapter & Draft Management
# -----------------------------

def insert_chapter(chapter_doc):
    """
    Insert a new chapter into the DB.
    chapter_doc should include:
      - manuscript_id
      - draft_name
      - title
      - content
      - order (optional, defaults to next available slot)
      - date_added (optional)
      - filename (optional)
    """
    chapter_doc.setdefault("date_added", datetime.utcnow())
    result = db['novels'].insert_one(chapter_doc)
    return result.inserted_id


def update_chapter(chapter_id, updates):
    """
    Update an existing chapter by _id.
    Returns the modified count.
    """
    if "_id" in updates:
        updates.pop("_id")  # never allow changing _id
    result = db['novels'].update_one({"_id": ObjectId(chapter_id)}, {"$set": updates})
    return result.modified_count


def find_chapter_by_filename(draft_name, filename, manuscript_id=None):
    """
    Check if a file with the same name exists in a draft.
    Optional: filter by manuscript_id.
    Returns the first matching chapter or None.
    """
    query = {"draft_name": draft_name, "filename": filename}
    if manuscript_id:
        query["manuscript_id"] = manuscript_id
    return db['novels'].find_one(query)


def get_chapters_for_draft(manuscript_id, draft_name):
    """
    Returns all chapters for a specific draft of a manuscript,
    sorted by the 'order' field.
    """
    return list(
        db['novels']
        .find({"manuscript_id": manuscript_id, "draft_name": draft_name}, {"content": 0})
        .sort("order", 1)
    )


def get_next_order(manuscript_id, draft_name):
    """
    Returns the next available chapter order for sequential uploads.
    """
    last_chapter = db['novels'].find({"manuscript_id": manuscript_id, "draft_name": draft_name}).sort("order", -1).limit(1)
    last = list(last_chapter)
    if not last:
        return 0
    return last[0].get("order", 0) + 1


# -----------------------------
# Draft / Manuscript Utilities
# -----------------------------

def get_drafts_for_book(manuscript_id):
    """
    Returns a list of draft names for a manuscript.
    """
    return db['novels'].distinct("draft_name", {"manuscript_id": manuscript_id})


def delete_chapter(chapter_id):
    """
    Delete a chapter by _id.
    """
    result = db['novels'].delete_one({"_id": ObjectId(chapter_id)})
    return result.deleted_count