import os
import pypandoc
from pymongo import MongoClient
import datetime
import time
import re
from dotenv import load_dotenv

# Load the variables from .env
load_dotenv()

# --- CONFIGURATION ---
# 1. Paste your Azure Cosmos Connection String here
CONNECTION_STRING = os.getenv("COSMOS_CONNECTION_STRING")

# 2. Path to the MAIN series folder (The one with Book_One inside it)
SERIES_PATH = "./novels/The_Devious_Adventures_of_Slick_the_Sly"

# 3. Connect to Cosmos DB
client = MongoClient(CONNECTION_STRING)
db = client['bespoke']

# FORCE the collection to exist with minimum throughput before we start
# This prevents Azure from trying to default to higher, expensive limits
try:
    db.create_collection('novels', session=None)
except Exception:
    # Collection likely already exists, which is fine
    pass

collection = db['novels']

def clean_name(text):
    """Turns 'Draft_Two' into 'Draft Two' and 'chapter_01' into 'Chapter 01'"""
    return text.replace('_', ' ').replace('-', ' ').title()

def get_initials(folder_name):
    """Turns 'The_Devious_Adventures' into 'tda'"""
    # Filters out small words like 'the', 'of', 'a' if you want, 
    # but let's keep it simple: first letter of every word separated by underscore
    return "".join([word[0].lower() for word in folder_name.split('_') if word])

def upload_series():
    series_folder_name = os.path.basename(SERIES_PATH)
    prefix = get_initials(series_folder_name)
    
    # Path to Book_One, Book_Two, etc.
    book_one_path = os.path.join(SERIES_PATH, "Book_One")
    
    if not os.path.exists(book_one_path):
        print(f"❌ Error: Could not find Book_One folder at {book_one_path}")
        return

    # 1. Get all folders inside Book_One (Draft_One, Draft_Two, etc.)
    draft_folders = [f for f in os.listdir(book_one_path) if os.path.isdir(os.path.join(book_one_path, f))]

    for folder in draft_folders:
        # 2. Skip Resources
        if folder.lower() == "resources":
            print(f"⏩ Skipping {folder}...")
            continue

        folder_path = os.path.join(book_one_path, folder)
        
        # 3. Generate the Bulletproof ID (e.g., tdaosts-book-one-draft-one)
        # We use parent folder name 'Book_One' to keep the ID hierarchical
        parent_name = "Book_One"
        manuscript_id = f"{prefix}-{parent_name.lower()}-{folder.lower()}".replace('_', '-')
        
        # UI Display Name (e.g., Book One: Draft Two)
        display_name = f"{clean_name(parent_name)}: {clean_name(folder)}"

        print(f"\n🚀 Uploading {display_name} (ID: {manuscript_id})")

        # 4. Process Markdown files
        files = sorted([f for f in os.listdir(folder_path) if f.endswith('.md')])

        for filename in files:
            full_path = os.path.join(folder_path, filename)
            
            # Convert MD to HTML using Pandoc
            html_content = pypandoc.convert_file(full_path, 'html5', extra_args=['--mathjax'])

            # Calculate Word Count
            with open(full_path, 'r', encoding='utf-8') as f:
                text = f.read()
                word_count = len(text.split())

            # 5. Create the document
            chapter_doc = {
                "manuscript_id": manuscript_id,
                "manuscript_display_name": display_name,
                "title": clean_name(filename.replace('.md', '')),
                "content": html_content,
                "word_count": word_count,
                "date_added": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "order": files.index(filename)
            }

            # 6. Upsert to Cosmos (Update if title exists in this manuscript, else insert)
            collection.replace_one(
                {"manuscript_id": manuscript_id, "title": chapter_doc["title"]},
                chapter_doc,
                upsert=True
            )
            print(f"   ✅ Saved: {chapter_doc['title']}")
            time.sleep(0.5) # Wait half a second between chapters

if __name__ == "__main__":
    upload_series()
    print("\n✨ All set! Your bookshelf has been updated.")
