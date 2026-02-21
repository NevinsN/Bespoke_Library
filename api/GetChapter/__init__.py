import azure.functions as func
import os
from pymongo import MongoClient
from bson import json_util, ObjectId

def main(req: func.HttpRequest) -> func.HttpResponse:
    chapter_id = req.params.get('id')
    
    uri = os.environ.get("COSMOS_CONNECTION_STRING")
    client = MongoClient(uri)
    db = client["bespoke_library"]
    collection = db["chapters"]

    # Fetch one document by its unique MongoDB ID
    chapter = collection.find_one({"_id": ObjectId(chapter_id)})
    
    if chapter:
        return func.HttpResponse(json_util.dumps(chapter), mimetype="application/json")
    else:
        return func.HttpResponse("Chapter not found", status_code=404)