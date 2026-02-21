import os
import pymongo
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Setup Connection
uri = os.getenv("COSMOS_CONNECTION_STRING")
client = pymongo.MongoClient(uri)

# Create and Select Database and Collection
db = client["bespoke_library"]
collection = db["chapters"]

def upload_chapters(folder_path):
    for filename in os.listdir(folder_path):
        if filename.endswith(".md"):
            file_path = os.path.join(folder_path, filename)

            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Create document structure
            chapter_data = {
                "title": filename.replace(".md", ""),
                "content": content,
                "word_count": len(content.split()),
                "status": "draft"
            }

            # Upload to Azure
            result = collection.insert_one(chapter_data)
            print(f"Uploaded {filename} with ID: {result.inserted_id}")

if __name__ == "__main__":
    upload_chapters("novels\The_Devious_Adventures_of_Slick_the_Sly\Book_One\Draft_Two")

