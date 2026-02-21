import azure.functions as func
import json
import os
from pymongo import MongoClient
from bson import ObjectId

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# Database Setup
CONNECTION_STRING = os.environ.get("COSMOS_CONNECTION_STRING")
client = MongoClient(CONNECTION_STRING)
db = client['bespoke_library']
collection = db['chapters']

@app.route(route="GetChapters", methods=["GET"])
def get_chapters(req: func.HttpRequest) -> func.HttpResponse:
    try:
        # Fetching all documents, returning only title and _id
        chapters = list(collection.find({}, {"title": 1, "_id": 1}))
        for doc in chapters:
            doc["_id"] = str(doc["_id"])
        
        return func.HttpResponse(
            json.dumps(chapters),
            mimetype="application/json",
            status_code=200
        )
    except Exception as e:
        return func.HttpResponse(f"Error: {str(e)}", status_code=500)

@app.route(route="GetChapter", methods=["GET"])
def get_chapter(req: func.HttpRequest) -> func.HttpResponse:
    chapter_id = req.params.get('id')
    if not chapter_id:
        return func.HttpResponse("Please pass an id on the query string", status_code=400)

    try:
        chapter = collection.find_one({"_id": ObjectId(chapter_id)})
        if chapter:
            chapter["_id"] = str(chapter["_id"])
            return func.HttpResponse(json.dumps(chapter), mimetype="application/json")
        else:
            return func.HttpResponse("Chapter not found", status_code=404)
    except Exception as e:
        return func.HttpResponse(f"Error: {str(e)}", status_code=500)