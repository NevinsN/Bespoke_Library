from .db import db, serialize, serialize_list
from bson.objectid import ObjectId
from datetime import datetime

VALID_STATUSES = {"pending", "flagged", "accepted", "dismissed"}
VALID_CATEGORIES = {"typo", "grammar", "flow", "question", "suggestion", "general"}


def create_comment(draft_id, chapter_id, manuscript_id, reader_email,
                   highlighted_text, paragraph_index, category, note):
    doc = {
        "draft_id":        str(draft_id),
        "chapter_id":      str(chapter_id),
        "manuscript_id":   str(manuscript_id),
        "reader_email":    reader_email.lower(),
        "highlighted_text": highlighted_text,
        "paragraph_index": paragraph_index,
        "category":        category,
        "note":            note,
        "status":          "pending",
        "created_at":      datetime.utcnow(),
    }
    result = db["comments"].insert_one(doc)
    return str(result.inserted_id)


def get_comments_for_draft(draft_id):
    return serialize_list(
        db["comments"].find({"draft_id": str(draft_id)})
    )


def get_unread_count_for_manuscripts(manuscript_ids):
    """Count pending comments across a list of manuscript IDs."""
    count = db["comments"].count_documents({
        "manuscript_id": {"$in": [str(m) for m in manuscript_ids]},
        "status": "pending",
    })
    return count


def set_comment_status(comment_id, status):
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status: {status}")
    db["comments"].update_one(
        {"_id": ObjectId(comment_id)},
        {"$set": {"status": status}}
    )


def get_comment_by_id(comment_id):
    return serialize(db["comments"].find_one({"_id": ObjectId(comment_id)}))
