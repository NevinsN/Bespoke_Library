import azure.functions as func
import json
import os
import re
import markdown
import datetime
from pymongo import MongoClient

client = MongoClient(os.getenv("COSMOS_CONNECTION_STRING"))
db = client['bespoke']

def handle_upload_draft(req):
    try:
        col = db['novels']
        upload_type = req.form.get('upload_type')
        man_id = req.form.get('manuscript_id')
        is_published = req.form.get('published') == 'true'
        
        file = req.files.get('file')
        raw_content = file.stream.read().decode('utf-8')

        # Path A: Splitting a full file
        if upload_type == 'full':
            chunks = re.split(r'^(?=#+ )', raw_content, flags=re.MULTILINE)
            chunks = [c.strip() for c in chunks if c.strip()]
            for i, chunk in enumerate(chunks):
                title = chunk.split('\n')[0].replace('#', '').strip()
                save_chapter(col, man_id, i, title, chunk, is_published)
        
        # Path B: Surgical update for one file
        else:
            order = int(req.form.get('order'))
            title = re.sub(r'^\d+\.?\s*', '', file.name).replace('.md', '').strip().title()
            save_chapter(col, man_id, order, title, raw_content, is_published)

        return func.HttpResponse("Sync Complete", status_code=200)
    except Exception as e:
        return func.HttpResponse(str(e), status_code=500)

def handle_update_meta(req):
    try:
        body = req.get_json()
        man_id = body.get('id')
        new_goal = body.get('target_goal')

        # Update goal for all chapters in this manuscript
        db['novels'].update_many(
            {"manuscript_id": man_id},
            {"$set": {"target_goal": int(new_goal)}}
        )
        return func.HttpResponse("Goal Updated", status_code=200)
    except Exception as e:
        return func.HttpResponse(str(e), status_code=500)

def save_chapter(col, man_id, order, title, content, published):
    # Retrieve existing doc to preserve display names/metadata
    existing = col.find_one({"manuscript_id": man_id})
    
    doc = {
        "manuscript_id": man_id,
        "manuscript_display_name": existing.get('manuscript_display_name') if existing else man_id,
        "series": existing.get('series') if existing else "Standalone",
        "book": existing.get('book') if existing else "Novel",
        "draft": existing.get('draft') if existing else "Current",
        "target_goal": existing.get('target_goal') if existing else 50000,
        "order": order,
        "title": title,
        "content": markdown.markdown(content),
        "word_count": len(content.split()),
        "published": published,
        "date_added": datetime.datetime.utcnow().isoformat()
    }
    col.replace_one({"manuscript_id": man_id, "order": order}, doc, upsert=True)

def handle_create_project(req):
    try:
        col = db['novels']
        body = req.get_json()
        
        # Build the ID: "the-devious-adventures-book-1-draft-1"
        series = body.get('series', 'Standalone')
        book = body.get('book', 'Novel')
        draft = body.get('draft', 'Draft 1')
        display_name = f"{series}: {book} ({draft})"
        
        # Clean ID string
        man_id = re.sub(r'[^a-z0-9]', '-', display_name.lower())

        # Create an initial "Introduction" or Placeholder record
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
        
        col.insert_one(doc)
        return func.HttpResponse(json.dumps({"id": man_id}), status_code=200)
    except Exception as e:
        return func.HttpResponse(str(e), status_code=500)
