import azure.functions as func
# Import the modular handlers
from routes.novel_routes import handle_get_novels, handle_get_chapters, handle_get_content
from routes.author_routes import handle_upload_draft, handle_update_meta, handle_create_project

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# --- READER / GENERAL ROUTES ---
@app.route(route="GetNovels", methods=["GET"])
def get_novels(req: func.HttpRequest) -> func.HttpResponse:
    return handle_get_novels(req)

@app.route(route="GetChapters", methods=["GET"])
def get_chapters(req: func.HttpRequest) -> func.HttpResponse:
    return handle_get_chapters(req)

@app.route(route="GetChapterContent", methods=["GET"])
def get_chapter_content(req: func.HttpRequest) -> func.HttpResponse:
    return handle_get_content(req)

# --- AUTHOR STUDIO ROUTES ---
@app.route(route="UploadDraft", methods=["POST"])
def upload_draft(req: func.HttpRequest) -> func.HttpResponse:
    return handle_upload_draft(req)

@app.route(route="UpdateNovelMeta", methods=["POST"])
def update_meta(req: func.HttpRequest) -> func.HttpResponse:
    return handle_update_meta(req)

@app.route(route="CreateProject", methods=["POST"])
def create_project(req: func.HttpRequest) -> func.HttpResponse:
    return handle_create_project(req)
