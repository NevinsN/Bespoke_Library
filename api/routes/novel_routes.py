import azure.functions as func
import json
import os
from pymongo import MongoClient
from bson.objectid import ObjectId
from utils.response import ok, error
from utils.auth import extract_user

# Database Connection
client = MongoClient(os.getenv("COSMOS_CONNECTION_STRING"))
db = client['bespoke']

# -----------------------------
# --- NOVEL / READER HANDLERS ---
# -----------------------------
def handle_get_novels(req: func.HttpRequest):
    """Returns all novels the user has permission to see."""
    try:
        user = extract_user(req)

        # Determine filter
        if user:  # logged in
            if user['is_admin']:
                match_filter = {}  # admin sees everything
            else:
                match_filter = {"allowed_readers": user['email']}
        else:  # anonymous
            match_filter = {"is_public": True}  # only public/demo books

        # Aggregation: group chapters into "Book" view
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

        # Meta info for frontend if empty
        meta = {}
        if not novels:
            meta['empty_reason'] = "not_logged_in" if not user else "no_access"

        return ok(novels, meta=meta)

    except Exception as e:
        return error(f"Failed to fetch library: {str(e)}", code=500)


def handle_get_chapters(req: func.HttpRequest):
    """Returns the Table of Contents for a specific book if permitted."""
    try:
        user = extract_user(req)
        m_id = req.params.get('manuscript_id')

        if not m_id:
            return error("Missing manuscript_id", code=400)

        # Permission filter
        query = {"manuscript_id": m_id}
        if user and not user['is_admin']:
            query["allowed_readers"] = user['email']
        elif not user:
            query["is_public"] = True  # allow public chapters

        # Fetch chapters, exclude full content
        chapters = list(db['novels'].find(query, {"content": 0}).sort("order", 1))

        if not chapters:
            return error("No chapters available or access denied", code=403)

        # Convert ObjectIds to strings
        for c in chapters:
            c['_id'] = str(c['_id'])

        return ok(chapters)

    except Exception as e:
        return error(str(e), code=500)


def handle_get_content(req: func.HttpRequest):
    """Returns the full text of a chapter if the user is permitted."""
    try:
        user = extract_user(req)
        ch_id = req.params.get('id')

        if not ch_id:
            return error("Missing chapter ID", code=400)

        chapter = db['novels'].find_one({"_id": ObjectId(ch_id)})

        if not chapter:
            return error("Chapter not found", code=404)

        # Permission check
        if user:
            if not user['is_admin'] and user['email'] not in chapter.get('allowed_readers', []) and not chapter.get('is_public', False):
                return error("Access denied", code=403)
        else:
            if not chapter.get('is_public', False):
                return error("Access denied", code=403)

        chapter['_id'] = str(chapter['_id'])
        return ok(chapter)

    except Exception as e:
        return error(str(e), code=500)


# -----------------------------
# --- AUTHOR / ADMIN HANDLERS ---
# -----------------------------
def handle_upload_draft(req: func.HttpRequest):
    try:
        user = extract_user(req)
        if not user:
            return error("Unauthorized", code=401)

        # TODO: implement actual draft upload
        return ok({"message": "Draft uploaded successfully"})

    except Exception as e:
        return error(str(e), code=500)


def handle_update_meta(req: func.HttpRequest):
    try:
        user = extract_user(req)
        if not user:
            return error("Unauthorized", code=401)

        # TODO: implement actual metadata update
        return ok({"message": "Metadata updated successfully"})

    except Exception as e:
        return error(str(e), code=500)


def handle_create_project(req: func.HttpRequest):
    try:
        user = extract_user(req)
        if not user:
            return error("Unauthorized", code=401)

        # TODO: implement actual project creation
        return ok({"message": "Project created successfully"})

    except Exception as e:
        return error(str(e), code=500)