# services/author_service.py

import re
import json

from repositories.novel_repo import (
    insert_chapter,
    update_chapter,
    find_chapter_by_filename,
    get_next_order,
    get_chapters_for_draft,
    get_drafts_for_book,
)
from bson.objectid import ObjectId
from datetime import datetime

# -----------------------------
# Project / Draft Creation
# -----------------------------
def create_new_project(body):
    """
    Create a new manuscript/project with its initial draft.
    Expects body to include:
      - series
      - book
      - draft
      - display_name (optional)
      - owner
      - authors (list)
      - readers (list)
    """
    series = body.get("series", "Standalone")
    book = body.get("book", "Novel")
    draft_name = body.get("draft", "Draft One")
    display_name = body.get("display_name") or f"{series}: {book}"
    owner = body.get("owner")
    authors = body.get("authors", [owner])
    readers = body.get("readers", [])

    # manuscript_id derived from display_name
    man_id = re.sub(r"[^a-z0-9]", "-", display_name.lower())

    # Initial chapter (front matter)
    chapter_doc = {
        "manuscript_id": man_id,
        "manuscript_display_name": display_name,
        "series": series,
        "book": book,
        "draft_name": draft_name,
        "title": "Front Matter",
        "content": "<h1>New Project Created</h1>",
        "word_count": 0,
        "order": 0,
        "date_added": datetime.utcnow(),
        "owner": owner,
        "authors": authors,
        "readers": readers,
        "filename": "front_matter.md",
    }

    chapter_id = insert_chapter(chapter_doc)

    return {
        "manuscript_id": man_id,
        "draft_name": draft_name,
        "chapter_id": str(chapter_id),
        "display_name": display_name,
    }

# -----------------------------
# Chapter Upload Handling
# -----------------------------
def process_uploaded_chapters(manuscript_id, draft_name, files, sequential=True):
    """
    Process uploaded files for a draft.

    Args:
        manuscript_id (str)
        draft_name (str)
        files (list of dicts):
            {
                "filename": "Chapter1.docx",
                "title": "Chapter 1",
                "content": "...text...",
                "slot": int (optional, for non-sequential)
            }
        sequential (bool): append sequentially (True) or use provided slots (False)

    Returns:
        dict: {"added": [], "updated": [], "skipped": []}
    """
    result = {"added": [], "updated": [], "skipped": []}

    current_order = get_next_order(manuscript_id, draft_name) if sequential else None

    for file in files:
        filename = file.get("filename")
        title = file.get("title") or filename
        content = file.get("content", "")
        slot = file.get("slot") if not sequential else current_order

        # Check for duplicates in this draft
        existing = find_chapter_by_filename(draft_name, filename, manuscript_id)

        chapter_doc = {
            "manuscript_id": manuscript_id,
            "draft_name": draft_name,
            "title": title,
            "content": content,
            "order": slot,
            "filename": filename,
            "date_added": datetime.utcnow(),
        }

        if existing:
            update_chapter(existing["_id"], chapter_doc)
            result["updated"].append(str(existing["_id"]))
        else:
            new_id = insert_chapter(chapter_doc)
            result["added"].append(str(new_id))

        if sequential:
            current_order += 1

    return result

# -----------------------------
# Fetch Chapters for UI
# -----------------------------
def get_draft_chapters(manuscript_id, draft_name):
    """
    Returns all chapters for a draft (excluding content for listing).
    """
    chapters = get_chapters_for_draft(manuscript_id, draft_name)
    for ch in chapters:
        ch["_id"] = str(ch["_id"])
    return chapters

# -----------------------------
# Draft Utilities
# -----------------------------
def list_drafts(manuscript_id):
    """
    Returns list of draft names for a manuscript
    """
    return get_drafts_for_book(manuscript_id)