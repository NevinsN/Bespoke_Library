import os
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Initialize DB
client = MongoClient(os.getenv("COSMOS_CONNECTION_STRING"))
db = client["bespoke_library"]
collection = db["chapters"]

def get_chapter(title):
    query = {"title": title}
    chapter = collection.find_one(query)

    if chapter:
        print(f"Found Chapter: {chapter['title']}")
        print(f"Content Preview: {chapter['content'][:100]}...")  # Preview first 100 characters of content
        print(f"Word Count: {chapter['word_count']} words")
    else:
        print("Chapter not found.")

if __name__ == "__main__":
    get_chapter("01")
