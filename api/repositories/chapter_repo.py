from .db import db, serialize, serialize_list
from bson.objectid import ObjectId
from datetime import datetime


def insert_chapter(draft_id, manuscript_id, title, filename, content, order, word_count=None):
    """Insert a new chapter. Returns inserted _id."""
    if word_count is None:
        word_count = len(content.split())
    doc = {
        "draft_id": draft_id,
        "manuscript_id": manuscript_id,
        "title": title,
        "filename": filename,
        "content": content,
        "word_count": word_count,
        "order": order,
        "date_added": datetime.utcnow(),
    }
    result = db["chapters"].insert_one(doc)
    return result.inserted_id


def update_chapter(chapter_id, updates):
    """Partial update of a chapter by _id."""
    updates.pop("_id", None)
    # Recalculate word count if content is being updated
    if "content" in updates and "word_count" not in updates:
        updates["word_count"] = len(updates["content"].split())
    db["chapters"].update_one(
        {"_id": ObjectId(chapter_id)},
        {"$set": updates}
    )


def get_chapters_for_draft(draft_id, include_content=False):
    """All chapters for a draft, sorted by order. Excludes content by default."""
    projection = None if include_content else {"content": 0}
    results = serialize_list(db["chapters"].find({"draft_id": draft_id}, projection))
    return sorted(results, key=lambda c: c.get("order", 0))


def get_chapter_by_id(chapter_id):
    return serialize(db["chapters"].find_one({"_id": ObjectId(chapter_id)}))


def get_chapter_by_filename(draft_id, filename):
    """Check if a filename already exists in this draft."""
    return serialize(db["chapters"].find_one({"draft_id": draft_id, "filename": filename}))


def get_next_order(draft_id):
    """Returns the next available order index for sequential uploads."""
    results = list(db["chapters"].find({"draft_id": draft_id}, {"order": 1}))
    last = sorted(results, key=lambda c: c.get("order", 0), reverse=True)[:1]
    return (last[0]["order"] + 1) if last else 0


def get_neighboring_chapter(manuscript_id, draft_id, order):
    """Get the chapter immediately before or after by order within the same draft."""
    return serialize(db["chapters"].find_one(
        {"draft_id": draft_id, "order": order},
        {"_id": 1}
    ))


def get_word_count_for_manuscript(manuscript_id):
    """Aggregate total word count across all drafts for a manuscript."""
    pipeline = [
        {"$match": {"manuscript_id": manuscript_id}},
        {"$group": {"_id": None, "total": {"$sum": "$word_count"}}}
    ]
    result = list(db["chapters"].aggregate(pipeline))
    return result[0]["total"] if result else 0


def delete_chapters_for_draft(draft_id):
    """Delete all chapters belonging to a draft."""
    db["chapters"].delete_many({"draft_id": draft_id})


def delete_chapter(chapter_id):
    db["chapters"].delete_one({"_id": ObjectId(chapter_id)})


VALID_STATUSES = {"hidden", "upcoming", "published"}

def set_chapter_status(chapter_id, status):
    """Set a chapter's publication status: hidden | upcoming | published."""
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status: {status}")
    db["chapters"].update_one(
        {"_id": ObjectId(chapter_id)},
        {"$set": {"status": status}}
    )

def publish_all_chapters(draft_id):
    """Set all chapters in a draft to published."""
    db["chapters"].update_many(
        {"draft_id": draft_id},
        {"$set": {"status": "published"}}
    )
