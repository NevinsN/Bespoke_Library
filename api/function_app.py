import azure.functions as func
import json

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# --- Demo novel route ---
@app.route(route="GetNovels", methods=["GET"])
def get_novels(req: func.HttpRequest) -> func.HttpResponse:
    # Dummy data so frontend always renders
    demo_novels = [
        {
            "_id": "demo1",
            "display_name": "Demo Book 1",
            "series_name": "Demo Series",
            "total_word_count": 1234
        },
        {
            "_id": "demo2",
            "display_name": "Demo Book 2",
            "series_name": "Demo Series",
            "total_word_count": 5678
        }
    ]

    # meta for frontend empty reason handling
    meta = {"empty_reason": "not_logged_in"}

    return func.HttpResponse(
        json.dumps({"success": True, "data": demo_novels, "meta": meta}),
        status_code=200,
        mimetype="application/json"
    )

# --- Optional: test route to confirm SWA detects Python ---
@app.route(route="DemoPing", methods=["GET"])
def demo_ping(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse("Function detected!", status_code=200)