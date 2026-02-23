import azure.functions as func
import json
import base64
import os
from pymongo import MongoClient
from bson.objectid import ObjectId
from utils.response import ok, error  # <--- Use your standard helpers

# Database Connection
client = MongoClient(os.getenv("COSMOS_CONNECTION_STRING"))
db = client['bespoke']

# Admin Config
admin_secrets = os.getenv("ADMIN_EMAIL", "")
ADMIN_EMAILS = [email.strip() for email in admin_secrets.split(",") if email]

def get_user_info(req):
    auth_header = req.headers.get("x-ms-client-principal")
    if not auth_header:
        return None, False
    
    payload = json.loads(base64.b64decode(auth_header).decode('utf-8'))
    email = payload.get('userDetails', '')
    is_admin = email in ADMIN_EMAILS
    return email, is_admin

def handle_get_novels(req):
    email, is_admin = get_user_info(req)
    if not email:
        return ok([]) # Return wrapped empty list

    match_filter = {} if is_admin else {"published": {"$ne": False}}
    
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
    return ok(novels) # <--- Standardized Wrapper

def handle_get_chapters(req):
    _, is_admin = get_user_info(req)
    # Ensure we use 'manuscript_id' to match your Service call
    m_id = req.params.get('manuscript_id')
    
    query = {"manuscript_id": m_id}
    if not is_admin:
        query["published"] = {"$ne": False}

    chapters = list(db['novels'].find(query, {"content": 0}).sort("order", 1))
    for c in chapters: 
        c['_id'] = str(c['_id'])
        
    return ok(chapters) # <--- Standardized Wrapper

def handle_get_content(req):
    ch_id = req.params.get('id')
    if not ch_id: 
        return error("Missing ID", code=400)

    chapter = db['novels'].find_one({"_id": ObjectId(ch_id)})
    if not chapter: 
        return error("Chapter Not Found", code=404)

    chapter['_id'] = str(chapter['_id'])
    return ok(chapter) # <--- Standardized Wrapper