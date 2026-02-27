from flask import request, send_file
from utils.auth import extract_user
from utils.response import error
from services.export_service import build_docx
from repositories.draft_repo import get_draft_by_id
from services.permission_service import can_read


def handle_export_draft():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)

        draft_id = request.args.get("draft_id")
        if not draft_id:
            return error("draft_id is required", 400)

        draft = get_draft_by_id(draft_id)
        if not draft:
            return error("Draft not found", 404)

        if not can_read(user["email"], manuscript_id=draft["manuscript_id"]):
            return error("Forbidden", 403)

        buf, filename = build_docx(user["email"], draft_id)

        return send_file(
            buf,
            as_attachment=True,
            download_name=filename,
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(str(e))
