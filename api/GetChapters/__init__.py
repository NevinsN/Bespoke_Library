import azure.functions as func
import os
import json
from pymongo import MongoClient
from bson import json_util

def main(req: func.HttpRequest) -> func.HttpResponse:
    # 1. Connect using the same string we used in test_db.py
    # In Azure, we'll store this in 'Application Settings'
    uri = os.environ.get("COSMOS_CONNECTION_STRING")

    if not uri:
        return func.HttpResponse("Missing Connection String", status_code=500)

    client = MongoClient(uri)
    db = client["bespoke_library"]
    collection = db["chapters"]

    # 2. Fetch all chapters (just titles and word coutns for the list)
    chapters = list(collection.find({}, {"title": 1, "word_count": 1}))
    
    # 3. Return as JSON
    return func.HttpResponse(
        json_util.dumps(chapters),
        mimetype="application/json",
        status_code=200
    )