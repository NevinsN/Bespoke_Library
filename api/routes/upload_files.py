from flask import request
from services.author_service import process_uploaded_chapters
from utils.auth import extract_user
from utils.response import ok, error


def handle_upload_files():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)

        body       = request.get_json(silent=True) or {}
        draft_id   = body.get("draft_id")
        files      = body.get("files", [])
        sequential = body.get("sequential", True)

        if not draft_id:
            return error("Missing draft_id", 400)
        if not files:
            return error("No files provided", 400)

        result = process_uploaded_chapters(
            user_email=user["email"],
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
