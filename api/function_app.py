import azure.functions as func
import json
from routes.novel_routes import handle_get_novels, handle_get_chapters, handle_get_chapter_content

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# --- Route to get novels
@app.route(route="GetNovels", methods=["GET"])
def get_novels(req: func.HttpRequest) -> func.HttpResponse:
    return handle_get_novels(req)

# --- Route to get chapters for a manuscript
@app.route(route="GetChapters", methods=["GET"])
def get_chapters(req: func.HttpRequest) -> func.HttpResponse:
    return handle_get_chapters(req)

# --- Route to get full chapter content
@app.route(route="GetChapterContent", methods=["GET"])
def get_chapter_content(req: func.HttpRequest) -> func.HttpResponse:
    return handle_get_chapter_content(req)

# --- Optional: test route to confirm SWA detects Python ---
@app.route(route="DemoPing", methods=["GET"])
def demo_ping(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse("Function detected!", status_code=200)
