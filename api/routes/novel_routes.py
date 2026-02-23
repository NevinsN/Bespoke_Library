import azure.functions as func
import json
import os
from pymongo import MongoClient
from bson.objectid import ObjectId
from utils.response import ok, error
from utils.auth import extract_user  # Using your updated auth utility

# Database Connection
client = MongoClient(os.getenv("COSMOS_CONNECTION_STRING"))
db = client['bespoke']

def handle_get_novels(req):
    """Returns all novels the user has permission to see."""
    try:
        user = extract_user(req)

        # --- Determine filter based on user ---
        if user:  # logged in
            if user['is_admin']:
                match_filter = {}  # admin sees all
            else:
                match_filter = {"allowed_readers": user['email']}
        else:  # anonymous user
            match_filter = {"is_public": True}  # optional: only show public books

        # --- Aggregation to group chapters into a "Book" view ---
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

        # --- Return meta info for frontend if empty ---
        meta = {}
        if not novels:
            if not user:
                meta['empty_reason'] = "not_logged_in"
            else:
                meta['empty_reason'] = "no_access"

        return ok(novels, meta=meta)

    except Exception as e:
        return error(f"Failed to fetch library: {str(e)}", code=500)
def handle_get_chapters(req):
    """Returns the Table of Contents for a specific book if permitted."""
    try:
        user = extract_user(req)
        m_id = req.params.get('manuscript_id')
        
        if not user or not m_id:
            return error("Unauthorized or Missing ID", code=401)

        # Ensure the user has permission for this specific manuscript
        query = {"manuscript_id": m_id}
        if not user['is_admin']:
            query["allowed_readers"] = user['email']

        # Get chapters (exclude content for faster loading of the list)
        chapters = list(db['novels'].find(query, {"content": 0}).sort("order", 1))
        
        if not chapters and not user['is_admin']:
             return error("Access Denied to this Manuscript", code=403)

        for c in chapters: 
            c['_id'] = str(c['_id'])
            
        return ok(chapters)
    except Exception as e:
        return error(str(e), code=500)

def handle_get_content(req):
    """Returns the full text of a chapter if the user is permitted."""
    try:
        user = extract_user(req)
        ch_id = req.params.get('id')
        
        if not user or not ch_id:
            return error("Unauthorized", code=401)

        # Fetch the specific chapter
        chapter = db['novels'].find_one({"_id": ObjectId(ch_id)})
        
        if not chapter:
            return error("Chapter not found", code=404)

        # Final Permission Check: Is this user allowed to read this book?
        if not user['is_admin'] and user['email'] not in chapter.get('allowed_readers', []):
            return error("You do not have permission to read this manuscript", code=403)

        chapter['_id'] = str(chapter['_id'])
        return ok(chapter)
    except Exception as e:
        return error(str(e), code=500)