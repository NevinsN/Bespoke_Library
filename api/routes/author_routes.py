import azure.functions as func
from services.author_service import (
    create_new_project,
    list_drafts,
    get_authored_manuscripts,
)
from utils.auth import extract_user
from utils.response import ok, error


def handle_get_authored_manuscripts(req: func.HttpRequest) -> func.HttpResponse:
    """
    GET — Returns only manuscripts where the user is owner or author.
    This is the exclusive data source for Author Studio.
    """
    try:
        user = extract_user(req)
        if not user:
            return error("Unauthorized", 401)
        manuscripts = get_authored_manuscripts(user["email"])
        return ok(manuscripts)
    except Exception as e:
        return error(str(e))


def handle_create_project(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user = extract_user(req)
        if not user:
            return error("Unauthorized", 401)
        try:
            body = req.get_json()
        except Exception:
            return error("Invalid JSON body", 400)
        if not body.get("series_name") or not body.get("book"):
            return error("series_name and book are required", 400)
        result = create_new_project(body, owner_email=user["email"])
        return ok(result)
    except PermissionError as e:
        return error(str(e), 403)
    except Exception as e:
        return error(str(e))


def handle_get_drafts(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user = extract_user(req)
        if not user:
            return error("Unauthorized", 401)
        manuscript_id = req.params.get("manuscript_id")
        if not manuscript_id:
            return error("Missing manuscript_id", 400)
        drafts = list_drafts(user["email"], manuscript_id)
        return ok(drafts)
    except PermissionError as e:
        return error(str(e), 403)
    except ValueError as e:
        return error(str(e), 404)
    except Exception as e:
        return error(str(e))
