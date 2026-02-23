import azure.functions as func
import json
from routes.novel_routes import handle_get_novels

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# --- Route to get novels
@app.route(route="GetNovels", methods=["GET"])
def get_novels(req: func.HttpRequest) -> func.HttpResponse:
    return handle_get_novels(req)

# --- Optional: test route to confirm SWA detects Python ---
@app.route(route="DemoPing", methods=["GET"])
def demo_ping(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse("Function detected!", status_code=200)