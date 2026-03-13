from flask import request
from services.author_service import process_uploaded_chapters
from utils.auth import extract_user
from utils.response import ok, error
import json


def handle_upload_files():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)

        # Supports both multipart/form-data (XHR upload) and JSON
        if request.content_type and 'multipart/form-data' in request.content_type:
            draft_id   = request.form.get("draft_id")
            sequential = request.form.get("sequential", "true").lower() == "true"
            uploaded   = request.files.getlist("files")

            if not draft_id:
                return error("Missing draft_id", 400)
            if not uploaded:
                return error("No files provided", 400)

            # Read slots for manual ordering
            files = []
            for f in uploaded:
                content = f.read().decode("utf-8", errors="replace")
                slot_key = f"slot_{f.filename}"
                slot = request.form.get(slot_key)
                files.append({
                    "filename": f.filename,
                    "content":  content,
                    "slot":     int(slot) if slot is not None else None,
                })
        else:
            body       = request.get_json(silent=True) or {}
            draft_id   = body.get("draft_id")
            files      = body.get("files", [])
            sequential = body.get("sequential", True)

            if not draft_id:
                return error("Missing draft_id", 400)
            if not files:
                return error("No files provided", 400)

        result = process_uploaded_chapters(
            user_id=user["id"],
            draft_id=draft_id,
            files=files,
            sequential=sequential,
        )
        return ok(result)
    except PermissionError as e:
        return error(str(e), 403)
    except ValueError as e:
        return error(str(e), 404)
    except Exception as e:
        return error(str(e))
