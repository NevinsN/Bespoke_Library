# routes/author_routes.py

import azure.functions as func
from utils.response import ok, error
from services.author_service import create_new_project, process_uploaded_chapters

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


# -------------------------
# Create a new author project
# -------------------------
@app.route(route="CreateProject", methods=["POST"])
def create_project(req: func.HttpRequest) -> func.HttpResponse:
    """
    Expects JSON body:
    {
        "series": "Series Name",
        "book": "Book Name",
        "draft": "Draft Name",
        "display_name": "Optional Display Name"
    }
    Returns the newly created manuscript ID and metadata.
    """
    try:
        body = req.get_json()
        project = create_new_project(body)
        return ok(project)
    except Exception as e:
        return error(f"Failed to create project: {str(e)}")


# -------------------------
# Upload chapters/files to a manuscript
# -------------------------
@app.route(route="UploadChapters", methods=["POST"])
def upload_chapters(req: func.HttpRequest) -> func.HttpResponse:
    """
    Expects form-data:
    - manuscript_id: ID of the project
    - mode: "sequential" or "non-sequential"
    - files[]: array of files to upload
    - optional slots mapping for non-sequential mode
    """
    try:
        result = process_uploaded_chapters(req)
        return ok(result)
    except Exception as e:
        return error(f"Failed to upload chapters: {str(e)}")


# -------------------------
# Optional: ping route to confirm SWA detection
# -------------------------
@app.route(route="DemoPing", methods=["GET"])
def demo_ping(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse("Author routes active!", status_code=200)