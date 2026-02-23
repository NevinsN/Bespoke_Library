# services/author_service.py

from repositories.author_repo import (
    insert_chapter,
    update_chapter,
    find_chapter_by_filename,
    get_next_order,
    get_chapters_for_draft
)
from bson.objectid import ObjectId
import datetime

def process_uploaded_chapters(manuscript_id, draft_name, files, sequential=True):
    """
    Process uploaded files for a draft.

    Args:
        manuscript_id (str): The ID of the manuscript/book.
        draft_name (str): Name of the draft (e.g., 'Draft One').
        files (list of dicts): Each dict represents a file:
            {
                "filename": "Chapter1.docx",
                "title": "Chapter 1",
                "content": "...text...",
                "slot": int (optional, for non-sequential)
            }
        sequential (bool): Whether to append chapters in order (True)
                           or use provided 'slot' values (False).

    Returns:
        dict: {
            "added": [chapter_ids],
            "updated": [chapter_ids],
            "skipped": [filenames]
        }
    """
    result = {"added": [], "updated": [], "skipped": []}

    # Determine starting order for sequential uploads
    current_order = get_next_order(manuscript_id, draft_name) if sequential else None

    for file in files:
        filename = file.get("filename")
        title = file.get("title") or filename
        content = file.get("content", "")
        slot = file.get("slot") if not sequential else current_order
        word_count = len(content.split())

        # Check for duplicates by filename in this draft
        existing = find_chapter_by_filename(draft_name, filename, manuscript_id)

        chapter_doc = {
            "manuscript_id": manuscript_id,
            "draft_name": draft_name,
            "title": title,
            "content": content,
            "order": slot,
            "filename": filename,
            "word_count": word_count,
            "date_added": datetime.datetime.utcnow().isoformat()
        }

        if existing:
            # Overwrite existing chapter
            update_chapter(existing["_id"], chapter_doc)
            result["updated"].append(str(existing["_id"]))
        else:
            # Insert new chapter
            new_id = insert_chapter(chapter_doc)
            result["added"].append(str(new_id))

        if sequential:
            current_order += 1

    return result


def get_draft_chapters(manuscript_id, draft_name):
    """
    Returns all chapters for a draft (no content for listing)
    """
    chapters = get_chapters_for_draft(manuscript_id, draft_name)
    for ch in chapters:
        ch["_id"] = str(ch["_id"])
    return chapters