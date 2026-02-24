import azure.functions as func
from services.author_service import process_uploaded_chapters
from repositories.draft_repo import get_draft_by_id
from utils.auth import extract_user
from utils.response import ok, error


def handle_upload_files(req: func.HttpRequest) -> func.HttpResponse:
    """
    Expects multipart/form-data:
      - files[]      one or more uploaded files
      - draft_id     target draft _id
      - sequential   "true" | "false"
      - slot_<filename>  (optional, for non-sequential uploads)
    """
    try:
        user = extract_user(req)
        if not user:
            return error("Unauthorized", 401)

        files = req.files.getlist("files")
        draft_id = req.form.get("draft_id")
        sequential = req.form.get("sequential", "true") == "true"

        if not draft_id:
            return error("Missing draft_id", 400)
        if not files:
            return error("No files provided", 400)

        files_payload = []
        for f in files:
            content = f.stream.read().decode("utf-8")
            files_payload.append({
                "filename": f.filename,
                "title": f.filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " "),
                "content": content,
                "slot": req.form.get(f"slot_{f.filename}"),
            })

        result = process_uploaded_chapters(
            user_email=user["email"],
            draft_id=draft_id,
            files=files_payload,
            sequential=sequential,
        )
        return ok(result)

    except PermissionError as e:
        return error(str(e), 403)
    except ValueError as e:
        return error(str(e), 404)
    except Exception as e:
        return error(str(e))
