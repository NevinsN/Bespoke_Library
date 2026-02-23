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

# --- READER / GENERAL ROUTES ---
def handle_get_novels(req: func.HttpRequest) -> func.HttpResponse:
    """
    Returns all novels the user has permission to see.
    - Anonymous users: only books where is_public=True
    - Logged-in users: their allowed books
    - Admins: all books
    """
    try:
        user = extract_user(req)

        # Determine visibility filter
        if user:
            if user.get("is_admin"):
                match_filter = {}  # admin sees all
            else:
                match_filter = {"allowed_readers": user.get("email")}
        else:
            match_filter = {"is_public": True}  # only public books

        pipeline = [
            {"$match": match_filter},
            {"$group": {
                "_id": "$manuscript_id",
                "display_name": {"$first": "$manuscript_display_name"},
                "series_name": {"$first": "$series"},
                "total_word_count": {"$sum": "$word_count"}
            }}
        ]

        novels = list(db['novels'].aggregate(pipeline))

        meta = {}
        if not novels:
            meta['empty_reason'] = "not_logged_in" if not user else "no_access"

        return ok(novels, meta=meta)

    except Exception as e:
        return error(f"Failed to fetch library: {str(e)}", code=500)


def handle_get_chapters(req: func.HttpRequest) -> func.HttpResponse:
    """
    Returns the Table of Contents for a specific book.
    - Anonymous users: only if is_public=True
    - Logged-in users: only if allowed_readers contains their email
    - Admins: can access all
    """
    try:
        user = extract_user(req)
        m_id = req.params.get("manuscript_id")

        if not m_id:
            return error("Missing manuscript_id", code=400)

        # Base query
        query = {"manuscript_id": m_id}

        if user:
            if not user.get("is_admin"):
                query["$or"] = [
                    {"allowed_readers": user.get("email")},
                    {"is_public": True}
                ]
        else:
            query["is_public"] = True

        chapters = list(db['novels'].find(query, {"content": 0}).sort("order", 1))

        for ch in chapters:
            ch["_id"] = str(ch["_id"])

        return ok(chapters)

    except Exception as e:
        return error(str(e), code=500)


def handle_get_content(req: func.HttpRequest) -> func.HttpResponse:
    """
    Returns full text of a chapter.
    - Anonymous users: only if parent book is_public=True
    - Logged-in users: only if allowed_readers contains their email
    - Admins: can access all
    """
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
        return error(str(e), code=500)