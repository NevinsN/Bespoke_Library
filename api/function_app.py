import azure.functions as func
import json
import base64
import os
from pymongo import MongoClient
from bson.objectid import ObjectId

app = func.FunctionApp()

# --- DATABASE SETUP ---
CONNECTION_STRING = os.getenv("COSMOS_CONNECTION_STRING")
client = MongoClient(CONNECTION_STRING)
db = client['bespoke_library']

ADMIN_EMAIL = "YOUR_ACTUAL_EMAIL@HERE.COM"

# --- DOOR 1: THE BOOKSHELF ---
@app.route(route="GetNovels", methods=["GET"])
def get_novels(req: func.HttpRequest) -> func.HttpResponse:
    auth_header = req.headers.get("x-ms-client-principal")
    if not auth_header:
        return func.HttpResponse("[]", status_code=200, mimetype="application/json")

    payload = json.loads(base64.b64decode(auth_header).decode('utf-8'))
    user_email = payload['userDetails']

    # Aggregation to get unique books + total word counts
    pipeline = [
        {"$group": {
            "_id": "$manuscript_id",
            "display_name": {"$first": "$manuscript_display_name"},
            "total_word_count": {"$sum": "$word_count"}
        }}
    ]
    
    all_novels = list(db['novels'].aggregate(pipeline))
    formatted_novels = [{"id": n["_id"], "display_name": n["display_name"], "total_word_count": n["total_word_count"]} for n in all_novels]

    if user_email == ADMIN_EMAIL:
        return func.HttpResponse(json.dumps(formatted_novels), mimetype="application/json")

    # Standard User Filter
    user_record = db['users'].find_one({"email": user_email})
    if not user_record: return func.HttpResponse("[]", status_code=200)
    
    allowed_ids = [m['id'] for m in user_record.get('authorized_manuscripts', [])]
    filtered = [n for n in formatted_novels if n['id'] in allowed_ids]
    
    return func.HttpResponse(json.dumps(filtered), mimetype="application/json")

# --- DOOR 2: CHAPTER LIST ---
@app.route(route="GetChapters", methods=["GET"])
def get_chapters(req: func.HttpRequest) -> func.HttpResponse:
    m_id = req.params.get('manuscript_id')
    chapters = list(db['novels'].find({"manuscript_id": m_id}, {"content": 0}).sort("order", 1))
    for c in chapters: c['_id'] = str(c['_id'])
    return func.HttpResponse(json.dumps(chapters), mimetype="application/json")

# --- DOOR 3: THE READER (With Navigation) ---
@app.route(route="GetChapterContent", methods=["GET"])
def get_chapter_content(req: func.HttpRequest) -> func.HttpResponse:
    ch_id = req.params.get('id')
    if not ch_id: return func.HttpResponse("Missing ID", status_code=400)

    chapter = db['novels'].find_one({"_id": ObjectId(ch_id)})
    if not chapter: return func.HttpResponse("Not Found", status_code=404)

    # Find Neighbors for Nav
    prev_ch = db['novels'].find_one({"manuscript_id": chapter['manuscript_id'], "order": chapter['order'] - 1}, {"_id": 1})
    next_ch = db['novels'].find_one({"manuscript_id": chapter['manuscript_id'], "order": chapter['order'] + 1}, {"_id": 1})

    chapter['_id'] = str(chapter['_id'])
    chapter['prev_id'] = str(prev_ch['_id']) if prev_ch else None
    chapter['next_id'] = str(next_ch['_id']) if next_ch else None

    return func.HttpResponse(json.dumps(chapter), mimetype="application/json")
