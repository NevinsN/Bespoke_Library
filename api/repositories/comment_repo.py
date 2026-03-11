from .db import db, serialize, serialize_list
from bson.objectid import ObjectId
from datetime import datetime

VALID_STATUSES   = {"pending", "flagged", "accepted", "dismissed"}
VALID_CATEGORIES = {"typo", "grammar", "flow", "question", "suggestion", "general"}


def create_comment(draft_id, chapter_id, manuscript_id, reader_id,
                   highlighted_text, paragraph_index, category, note):
    doc = {
        "draft_id":         str(draft_id),
        "chapter_id":       str(chapter_id),
        "manuscript_id":    str(manuscript_id),
        "reader_id":        reader_id,
        "highlighted_text": highlighted_text,
        "paragraph_index":  paragraph_index,
        "category":         category,
        "note":             note,
        "status":           "pending",
        "created_at":       datetime.utcnow(),
    }
    result = db["comments"].insert_one(doc)
    return str(result.inserted_id)


def _enrich_with_usernames(comments):
    """Look up usernames for all reader_ids in a comment list."""
    reader_ids = list({c.get("reader_id") for c in comments if c.get("reader_id")})
    if not reader_ids:
        return comments

    users = db["users"].find({
        "auth0_subs": {"$in": reader_ids}
    }, {"auth0_subs": 1, "username": 1})

    # Build sub → username map
    sub_to_username = {}
    for u in users:
        username = u.get("username") or "unknown"
        for sub in (u.get("auth0_subs") or []):
            sub_to_username[sub] = username

    for c in comments:
        c["reader_username"] = sub_to_username.get(c.get("reader_id"), "unknown")

    return comments


def get_comments_for_draft(draft_id):
    comments = serialize_list(db["comments"].find({"draft_id": str(draft_id)}))
    return _enrich_with_usernames(comments)


def get_unread_count_for_manuscripts(manuscript_ids):
    return db["comments"].count_documents({
        "manuscript_id": {"$in": [str(m) for m in manuscript_ids]},
        "status": "pending",
    })


def set_comment_status(comment_id, status):
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status: {status}")
    db["comments"].update_one(
        {"_id": ObjectId(comment_id)},
        {"$set": {"status": status}}
    )


def get_comment_by_id(comment_id):
    return serialize(db["comments"].find_one({"_id": ObjectId(comment_id)}))
