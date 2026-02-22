# repositories/novel_repo.py

from .db import db
from bson.objectid import ObjectId

def get_aggregated_novels():
    pipeline = [
        {"$group": {
            "_id": "$manuscript_id",
            "display_name": {"$first": "$manuscript_display_name"},
            "total_word_count": {"$sum": "$word_count"}
        }}
    ]
    return list(db['novels'].aggregate(pipeline))

def get_chapters_by_manuscript(m_id):
    return list(db['novels'].find({"manuscript_id": m_id}, {"content": 0}).sort("order", 1))

def get_chapter_by_id(ch_id):
    return db['novels'].find_one({"_id": ObjectId(ch_id)})

def get_neighboring_chapter(manuscript_id, order_offset):
    return db['novels'].find_one({"manuscript_id": manuscript_id, "order": order_offset}, {"_id": 1})

def get_user_record(email):
    return db['users'].find_one({"email": email})