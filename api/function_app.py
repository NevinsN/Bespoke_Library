import azure.functions as func
import json
import base64
import os
from pymongo import MongoClient

app = func.FunctionApp()

# --- DATABASE SETUP ---
# Pro-tip: Use an environment variable for security
CONNECTION_STRING = os.getenv("COSMOS_CONNECTION_STRING") 
client = MongoClient(CONNECTION_STRING)
db = client['bespoke_library']

# --- DOOR 1: THE BOOKSHELF ---
@app.route(route="GetNovels", methods=["GET"])
def get_novels(req: func.HttpRequest) -> func.HttpResponse:
    # 1. Get the login info from the header
    auth_header = req.headers.get("x-ms-client-principal")
    if not auth_header:
        return func.HttpResponse("[]", status_code=200, mimetype="application/json")

    # 2. Decode the user's email
    payload = json.loads(base64.b64decode(auth_header).decode('utf-8'))
    user_email = payload['userDetails']

    # 3. Find this user in your 'users' collection
    user_record = db['users'].find_one({"email": user_email})
    
    if not user_record:
        return func.HttpResponse("[]", status_code=200, mimetype="application/json")

    # 4. Return the list of authorized manuscripts
    return func.HttpResponse(
        json.dumps(user_record.get('authorized_manuscripts', [])),
        status_code=200,
        mimetype="application/json"
    )

# --- DOOR 2: THE CHAPTERS ---
@app.route(route="GetChapters", methods=["GET"])
def get_chapters(req: func.HttpRequest) -> func.HttpResponse:
    # 1. Identity Check
    auth_header = req.headers.get("x-ms-client-principal")
    if not auth_header: 
        return func.HttpResponse("[]", status_code=401)
    
    payload = json.loads(base64.b64decode(auth_header).decode('utf-8'))
    user_email = payload['userDetails']
    
    # Get the specific book ID requested by the frontend
    m_id = req.params.get('manuscript_id')
    if not m_id:
        return func.HttpResponse("Missing manuscript_id", status_code=400)

    # 2. PERMISSION CHECK
    user_record = db['users'].find_one({"email": user_email})
    if not user_record:
        return func.HttpResponse("User record not found", status_code=403)

    allowed_ids = [m['id'] for m in user_record.get('authorized_manuscripts', [])]
    
    if m_id not in allowed_ids:
        return func.HttpResponse("Unauthorized for this book", status_code=403)

    # 3. Fetch Chapters (Excluding heavy content for the list view)
    # We use list(db['novels'].find(...)) to get all chapters for THIS book
    chapters = list(db['novels'].find({"manuscript_id": m_id}, {"content": 0}))
    
    # Simple fix for MongoDB ObjectIDs
    for c in chapters:
        c['_id'] = str(c['_id'])

    return func.HttpResponse(json.dumps(chapters), mimetype="application/json")
