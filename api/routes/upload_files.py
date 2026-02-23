# routes/upload_files.py
import azure.functions as func
import json
from services.author_service import process_uploaded_chapters
from utils.auth import extract_user

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

@app.route(route="UploadFiles", methods=["POST"])
def upload_files_route(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user = extract_user(req)
        if not user:
            return func.HttpResponse(
                json.dumps({"success": False, "error": "Unauthorized"}),
                status_code=401,
                mimetype="application/json"
            )

        # Retrieve form-data
        files = req.files.getlist("files")  # List of uploaded files
        series_name = req.form.get("series_name")
        book_name = req.form.get("book_name")
        draft_name = req.form.get("draft_name")
        sequential = req.form.get("sequential") == "true"

        if not (series_name and book_name and draft_name):
            return func.HttpResponse(
                json.dumps({"success": False, "error": "Missing series/book/draft info"}),
                status_code=400,
                mimetype="application/json"
            )

        # Transform uploaded files into expected structure for the service
        files_payload = []
        for f in files:
            content = f.stream.read().decode("utf-8")
            files_payload.append({
                "filename": f.filename,
                "title": f.filename.replace('.md', ''),
                "content": content
            })

        # Process upload via author service
        result = process_uploaded_chapters(
            manuscript_id=f"{series_name}-{book_name}-{draft_name}".lower().replace(" ", "-"),
            draft_name=draft_name,
            files=files_payload,
            sequential=sequential
        )

        return func.HttpResponse(
            json.dumps({"success": True, "result": result}),
            status_code=200,
            mimetype="application/json"
        )

    except Exception as e:
        return func.HttpResponse(
            json.dumps({"success": False, "error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )