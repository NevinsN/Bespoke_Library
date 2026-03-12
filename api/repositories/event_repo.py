"""
event_repo.py — Platform analytics events.

Schema: {
  user_id:     auth0_sub (or None for anonymous)
  event_type:  string — see EVENT_TYPES
  manuscript_id, draft_id, chapter_id: optional context
  meta:        dict — any extra data
  created_at:  datetime
}
"""

from .db import db, serialize_list
from datetime import datetime, timedelta


EVENT_TYPES = {
    "chapter_opened",
    "chapter_completed",
    "comment_created",
    "invite_redeemed",
    "draft_published",
    "user_registered",
    "manuscript_created",
    "draft_hidden",
    "admin_action",
}


def record_event(event_type, user_id=None, manuscript_id=None,
                 draft_id=None, chapter_id=None, meta=None):
    if event_type not in EVENT_TYPES:
        return  # silently ignore unknown types
    db["events"].insert_one({
        "event_type":    event_type,
        "user_id":       user_id,
        "manuscript_id": str(manuscript_id) if manuscript_id else None,
        "draft_id":      str(draft_id)      if draft_id      else None,
        "chapter_id":    str(chapter_id)    if chapter_id    else None,
        "meta":          meta or {},
        "created_at":    datetime.utcnow(),
    })


# ─── Query helpers ────────────────────────────────────────────────────────────

def get_events(event_type=None, user_id=None, manuscript_id=None,
               draft_id=None, since_days=30, limit=500):
    query = {}
    if event_type:    query["event_type"]    = event_type
    if user_id:       query["user_id"]       = user_id
    if manuscript_id: query["manuscript_id"] = str(manuscript_id)
    if draft_id:      query["draft_id"]      = str(draft_id)
    if since_days:
        query["created_at"] = {"$gte": datetime.utcnow() - timedelta(days=since_days)}
    return serialize_list(
        db["events"].find(query).sort("created_at", -1).limit(limit)
    )


def get_platform_stats(since_days=30):
    since = datetime.utcnow() - timedelta(days=since_days)
    pipeline_base = {"created_at": {"$gte": since}}

    def count(event_type):
        return db["events"].count_documents({**pipeline_base, "event_type": event_type})

    def unique_users(event_type):
        return len(db["events"].distinct("user_id", {
            **pipeline_base, "event_type": event_type, "user_id": {"$ne": None}
        }))

    total_users      = db["users"].count_documents({})
    total_manuscripts = db["manuscripts"].count_documents({})
    total_comments   = db["comments"].count_documents({})

    return {
        "period_days":        since_days,
        "total_users":        total_users,
        "total_manuscripts":  total_manuscripts,
        "total_comments":     total_comments,
        "chapters_opened":    count("chapter_opened"),
        "chapters_completed": count("chapter_completed"),
        "comments_created":   count("comment_created"),
        "invites_redeemed":   count("invite_redeemed"),
        "drafts_published":   count("draft_published"),
        "active_readers":     unique_users("chapter_opened"),
        "new_registrations":  count("user_registered"),
    }


def get_events_by_day(event_type, since_days=30):
    """Returns daily counts for charting."""
    since = datetime.utcnow() - timedelta(days=since_days)
    pipeline = [
        {"$match": {"event_type": event_type, "created_at": {"$gte": since}}},
        {"$group": {
            "_id": {
                "y": {"$year":  "$created_at"},
                "m": {"$month": "$created_at"},
                "d": {"$dayOfMonth": "$created_at"},
            },
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}},
    ]
    return list(db["events"].aggregate(pipeline))


def get_manuscript_read_stats(manuscript_id):
    """Per-manuscript: unique readers, chapters opened, completion events."""
    base = {"manuscript_id": str(manuscript_id)}
    return {
        "unique_readers":     len(db["events"].distinct("user_id", {
            **base, "event_type": "chapter_opened", "user_id": {"$ne": None}
        })),
        "chapters_opened":    db["events"].count_documents({**base, "event_type": "chapter_opened"}),
        "chapters_completed": db["events"].count_documents({**base, "event_type": "chapter_completed"}),
        "comments":           db["comments"].count_documents({"manuscript_id": str(manuscript_id)}),
    }
