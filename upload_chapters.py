import os
import pypandoc
from pymongo import MongoClient
from datetime import datetime

# --- CONFIGURATION ---
# 1. Your Azure Cosmos Connection String
CONNECTION_STRING = "YOUR_COSMOS_CONNECTION_STRING_HERE"
# 2. The ID used in your 'users' collection (e.g., 'slick-the-sly-b1-d2')
MANUSCRIPT_ID = "slick-the-sly-b1-d2" 
# 3. Path to your folder full of .md files
FOLDER_PATH = "./manuscript/draft2"

client = MongoClient(CONNECTION_STRING)
db = client['bespoke_library']
collection = db['novels']

def upload_manuscript():
    print(f"🚀 Starting upload for: {MANUSCRIPT_ID}")
    
    # Optional: Clear old version of this manuscript before uploading new one
    # collection.delete_many({"manuscript_id": MANUSCRIPT_ID})

    files = sorted([f for f in os.listdir(FOLDER_PATH) if f.endswith('.md')])

    for filename in files:
        full_path = os.path.join(FOLDER_PATH, filename)
        
        # 1. Convert Markdown to Sleek HTML using Pandoc
        # We use 'fragment' so we don't get <html><body> tags inside the DB
        html_content = pypandoc.convert_file(full_path, 'html5', extra_args=['--mathjax'])

        # 2. Calculate Word Count
        with open(full_path, 'r', encoding='utf-8') as f:
            text = f.read()
            word_count = len(text.split())

        # 3. Create the Database Document
        chapter_doc = {
            "manuscript_id": MANUSCRIPT_ID, # The "Shelf" it belongs to
            "title": filename.replace('.md', '').replace('_', ' ').title(),
            "content": html_content,
            "word_count": word_count,
            "date_added": datetime.utcnow().isoformat(),
            "order": files.index(filename) # Keeps chapters in sequence
        }

        # 4. Push to Azure
        collection.insert_one(chapter_doc)
        print(f" ✅ Uploaded: {chapter_doc['title']} ({word_count} words)")

if __name__ == "__main__":
    upload_manuscript()
    print("\n✨ Library Updated! Refresh your website to see the changes.")
