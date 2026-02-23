# repositories/novel_repo.py
from .db import db
from bson.objectid import ObjectId

def insert_chapter(chapter_doc):
    return db["novels"].insert_one(chapter_doc).inserted_id

def find_chapter_by_filename(draft_name, filename):
    return db["novels"].find_one({"draft_name": draft_name, "filename": filename})