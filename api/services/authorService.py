# services/authorService.py
from repositories.novel_repo import insert_chapter, find_chapter_by_filename

def upload_files(user, series, book, draft, files, sequential=True):
    response = {"success": True, "uploaded": [], "skipped": []}

    for idx, file in enumerate(files):
        filename = file.filename

        # Check for duplicates
        existing = find_chapter_by_filename(draft, filename)
        if existing:
            # Could overwrite or skip
            response["skipped"].append(filename)
            continue

        # Determine order
        if sequential:
            order = None  # repository will assign next order
        else:
            # For non-sequential, maybe get order from file metadata
            order = file.form.get("order", None)

        doc = {
            "series_name": series,
            "book_name": book,
            "draft_name": draft,
            "filename": filename,
            "content": file.read().decode("utf-8"),
            "order": order,
            "author_email": user["email"]
        }

        inserted = insert_chapter(doc)
        response["uploaded"].append(inserted["_id"])

    return json.dumps(response)