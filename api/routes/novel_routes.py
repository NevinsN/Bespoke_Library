import azure.functions as func
import json
import base64
import os
import logging
from pymongo import MongoClient
from bson.objectid import ObjectId

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
        return func.HttpResponse("[]", status_code=200, mimetype="application/json")

    # Pipeline: Group chapters into "Books"
    # Logic: If NOT admin, only sum 'published' chapters
    match_filter = {} if is_admin else {"published": {"$ne": False}}
    
    pipeline = [
        {"$match": match_filter},
        {"$group": {
            "_id": "$manuscript_id",
            "display_name": {"$first": "$manuscript_display_name"},
            "series": {"$first": "$series"},
            "book": {"$first": "$book"},
            "draft": {"$first": "$draft"},
            "target_goal": {"$first": "$target_goal"},
            "total_word_count": {"$sum": "$word_count"}
        }}
    ]
    
    novels = list(db['novels'].aggregate(pipeline))
    
    # Filter for standard users based on your 'users' collection
    if not is_admin:
        user_record = db['users'].find_one({"email": email})
        if not user_record: return func.HttpResponse("[]", mimetype="application/json")
        allowed_ids = [m['id'] for m in user_record.get('authorized_manuscripts', [])]
        novels = [n for n in novels if n['_id'] in allowed_ids]

    return func.HttpResponse(json.dumps(novels), mimetype="application/json")

def handle_get_chapters(req):
    _, is_admin = get_user_info(req)
    m_id = req.params.get('manuscript_id')
    
    # Readers only see published chapters; Authors see everything
    query = {"manuscript_id": m_id}
    if not is_admin:
        query["published"] = {"$ne": False}

    chapters = list(db['novels'].find(query, {"content": 0}).sort("order", 1))
    for c in chapters: c['_id'] = str(c['_id'])
    return func.HttpResponse(json.dumps(chapters), mimetype="application/json")

def handle_get_content(req):
    ch_id = req.params.get('id')
    if not ch_id: return func.HttpResponse("Missing ID", status_code=400)

    chapter = db['novels'].find_one({"_id": ObjectId(ch_id)})
    if not chapter: return func.HttpResponse("Not Found", status_code=404)

    # Neighbors for Reader Navigation
    prev_ch = db['novels'].find_one({"manuscript_id": chapter['manuscript_id'], "order": chapter['order'] - 1}, {"_id": 1})
    next_ch = db['novels'].find_one({"manuscript_id": chapter['manuscript_id'], "order": chapter['order'] + 1}, {"_id": 1})

    chapter['_id'] = str(chapter['_id'])
    chapter['prev_id'] = str(prev_ch.get('_id')) if prev_ch else None
    chapter['next_id'] = str(next_ch.get('_id')) if next_ch else None

    return func.HttpResponse(json.dumps(chapter), mimetype="application/json")
