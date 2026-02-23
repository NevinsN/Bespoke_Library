# routes/novel_routes.py

import azure.functions as func
import json
import os
from pymongo import MongoClient
from bson.objectid import ObjectId
from utils.response import ok, error
from utils.auth import extract_user

# --- DATABASE CONNECTION ---
client = MongoClient(os.getenv("COSMOS_CONNECTION_STRING"))
db = client['bespoke']


# -------------------------------
# Helper: Determine visibility
# -------------------------------
def get_visibility_filter(user):
    """
    Returns a MongoDB filter dict based on the user's access level:
    - Admin: sees everything
    - Logged-in user: only allowed_readers books
    - Anonymous: only public books
    """
    if user:
        if user.get("is_admin"):
            return {}  # all books
        else:
            return {"$or": [{"allowed_readers": user.get("email")}, {"is_public": True}]}
    else:
        return {"is_public": True}


# -------------------------------
# /api/GetNovels
# -------------------------------
def handle_get_novels(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user = extract_user(req)
        filter_query = get_visibility_filter(user)

        # Aggregate books by manuscript_id
        pipeline = [
            {"$match": filter_query},
            {"$group": {
                "_id": "$manuscript_id",
                "display_name": {"$first": "$manuscript_display_name"},
                "series_name": {"$first": "$series"},
                "total_word_count": {"$sum": "$word_count"},
                "is_public": {"$first": "$is_public"}
            }}
        ]

        novels = list(db['novels'].aggregate(pipeline))

        meta = {}
        if not novels:
            meta['empty_reason'] = "not_logged_in" if not user else "no_access"

        return ok(novels, meta=meta)
    except Exception as e:
        return error(f"Failed to fetch library: {str(e)}", code=500)


# -------------------------------
# /api/GetChapters
# -------------------------------
def handle_get_chapters(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user = extract_user(req)
        manuscript_id = req.params.get("manuscript_id")
        if not manuscript_id:
            return error("Missing manuscript_id", code=400)

        filter_query = get_visibility_filter(user)
        filter_query["manuscript_id"] = manuscript_id

        chapters = list(db['novels'].find(filter_query, {"content": 0}).sort("order", 1))
        for ch in chapters:
            ch["_id"] = str(ch["_id"])

        return ok(chapters)
    except Exception as e:
        return error(f"Failed to fetch chapters: {str(e)}", code=500)


# -------------------------------
# /api/GetChapterContent
# -------------------------------
def handle_get_content(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user = extract_user(req)
        ch_id = req.params.get("id")
        if not ch_id:
            return error("Missing chapter id", code=400)

        chapter = db['novels'].find_one({"_id": ObjectId(ch_id)})
        if not chapter:
            return error("Chapter not found", code=404)

        # Permission check
        if user:
            if not user.get("is_admin") and user.get("email") not in chapter.get("allowed_readers", []) and not chapter.get("is_public", False):
                return error("Access denied", code=403)
        else:
            if not chapter.get("is_public", False):
                return error("Access denied", code=403)

        chapter["_id"] = str(chapter["_id"])
        return ok(chapter)
    except Exception as e:
        return error(f"Failed to fetch chapter content: {str(e)}", code=500)