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
    - draft_name: Name of the draft (optional, defaults to 'Draft One')
    - mode: "sequential" or "non-sequential"
    - files[]: array of files to upload
    - optional slots for non-sequential mode: slot_<filename>
    """
    try:
        form = req.form
        files = req.files.getlist('files')  # list of uploaded files
        manuscript_id = form.get('manuscript_id')
        draft_name = form.get('draft_name', 'Draft One')
        mode = form.get('mode', 'sequential')
        sequential = mode.lower() == 'sequential'

        if not manuscript_id:
            return error("manuscript_id is required")

        # Transform uploaded files into the expected structure
        processed_files = []
        for f in files:
            content = f.stream.read().decode('utf-8')
            processed_files.append({
                "filename": f.name,
                "title": f.name.replace('.md',''),
                "content": content,
                "slot": int(form.get(f"slot_{f.name}", 0)) if not sequential else None
            })

        # Call service layer
        result = process_uploaded_chapters(manuscript_id, draft_name, processed_files, sequential=sequential)
        return ok(result)

    except Exception as e:
        return error(f"Failed to upload chapters: {str(e)}")


# -------------------------
# Optional ping route to confirm SWA detection
# -------------------------
@app.route(route="DemoPing", methods=["GET"])
def demo_ping(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse("Author routes active!", status_code=200)