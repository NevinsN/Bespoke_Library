import azure.functions as func
import json
import base64
import os
from pymongo import MongoClient

app = func.FunctionApp()

# --- DATABASE SETUP ---
# Ensure 'COSMOS_CONNECTION_STRING' is set in your Azure Environment Variables
CONNECTION_STRING = os.getenv("COSMOS_CONNECTION_STRING") 
client = MongoClient(CONNECTION_STRING)
db = client['bespoke_library']

# --- DOOR 1: THE BOOKSHELF ---
@app.route(route="GetNovels", methods=["GET"])
def get_novels(req: func.HttpRequest) -> func.HttpResponse:
    auth_header = req.headers.get("x-ms-client-principal")
    if not auth_header:
        return func.HttpResponse("[]", status_code=200, mimetype="application/json")

    # Decode the user's identity
    payload = json.loads(base64.b64decode(auth_header).decode('utf-8'))
    user_email = payload['userDetails']

    # --- ADMIN OVERRIDE ("GOD MODE") ---
    # Replace with your actual admin email
    if user_email == "YOUR_ACTUAL_EMAIL@HERE.COM":
        # Get every unique manuscript ID currently in the database
        all_ids = db['novels'].distinct("manuscript_id")
        
        admin_list = []
        for m_id in all_ids:
            # Find a sample chapter to get the pretty display name
            sample = db['novels'].find_one({"manuscript_id": m_id})
            if sample:
                admin_list.append({
                    "id": m_id,
                    "display_name": sample.get("manuscript_display_name", clean_name(m_id))
                })
        return func.HttpResponse(json.dumps(admin_list), status_code=200, mimetype="application/json")

    # --- STANDARD USER LOGIC ---
    user_record = db['users'].find_one({"email": user_email})
    if not user_record:
        return func.HttpResponse("[]", status_code=200, mimetype="application/json")

    authorized_books = user_record.get('authorized_manuscripts', [])
    return func.HttpResponse(json.dumps(authorized_books), status_code=200, mimetype="application/json")


# --- DOOR 2: THE CHAPTERS ---
@app.route(route="GetChapters", methods=["GET"])
def get_chapters(req: func.HttpRequest) -> func.HttpResponse:
    auth_header = req.headers.get("x-ms-client-principal")
    if not auth_header: 
        return func.HttpResponse("Unauthorized", status_code=401)
    
    payload = json.loads(base64.b64decode(auth_header).decode('utf-8'))
    user_email = payload['userDetails']
    
    m_id = req.params.get('manuscript_id')
    if not m_id:
        return func.HttpResponse("Missing manuscript_id", status_code=400)

    # PERMISSION CHECK (Admins pass automatically)
    if user_email != "YOUR_ACTUAL_EMAIL@HERE.COM":
        user_record = db['users'].find_one({"email": user_email})
        if not user_record:
            return func.HttpResponse("Access Denied", status_code=403)
        
        allowed_ids = [m['id'] for m in user_record.get('authorized_manuscripts', [])]
        if m_id not in allowed_ids:
            return func.HttpResponse("Unauthorized for this book", status_code=403)

    # Fetch chapters and sanitize for JSON
    chapters = list(db['novels'].find({"manuscript_id": m_id}, {"content": 0}))
    for c in chapters:
        c['_id'] = str(c['_id']) # Convert ObjectID to string

    return func.HttpResponse(json.dumps(chapters), mimetype="application/json")

def clean_name(text):
    """Helper to prettify IDs if display_name is missing"""
    return text.replace('-', ' ').title()
