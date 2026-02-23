import azure.functions as func
import json
import os
import re
import markdown
import datetime
from pymongo import MongoClient
from utils.response import ok, error # <--- Use your standard helpers

client = MongoClient(os.getenv("COSMOS_CONNECTION_STRING"))
db = client['bespoke']

def handle_create_project(req):
    try:
        body = req.get_json()
        series = body.get('series', 'Standalone')
        book = body.get('book', 'Novel')
        draft = body.get('draft', 'Draft 1')
        display_name = body.get('display_name', f"{series}: {book}")
        
        man_id = re.sub(r'[^a-z0-9]', '-', display_name.lower())

        doc = {
            "manuscript_id": man_id,
            "manuscript_display_name": display_name,
            "series": series,
            "book": book,
            "draft": draft,
            "target_goal": 50000,
            "order": 0,
            "title": "Front Matter",
            "content": "<h1>New Project Created</h1>",
            "word_count": 0,
            "published": False,
            "date_added": datetime.datetime.utcnow().isoformat()
        }
        
        db['novels'].insert_one(doc)
        return ok({"message": "Project created", "manuscript_id": man_id})
        
    except Exception as e:
        return error(str(e))

def handle_upload_draft(req):
    try:
        col = db['novels']
        man_id = req.form.get('manuscript_id')
        
        file = req.files.get('file')
        raw_content = file.stream.read().decode('utf-8')

        # Simple logic to save the chapter
        doc = {
            "manuscript_id": man_id,
            "title": file.name.replace('.md', ''),
            "content": markdown.markdown(raw_content),
            "word_count": len(raw_content.split()),
            "date_added": datetime.datetime.utcnow().isoformat()
        }
        
        col.insert_one(doc)
        return ok("Upload successful")
    except Exception as e:
        return error(str(e))