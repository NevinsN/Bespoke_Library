# routes/uploadFiles.py
import azure.functions as func
from services.authorService import upload_files
from utils.auth import extract_user

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

@app.route(route="UploadFiles", methods=["POST"])
def upload_files_route(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user = extract_user(req)
        files = req.files.getlist("files")  # Assuming multipart form-data
        series_name = req.form.get("series_name")
        book_name = req.form.get("book_name")
        draft_name = req.form.get("draft_name")
        sequential = req.form.get("sequential") == "true"

        result = upload_files(user, series_name, book_name, draft_name, files, sequential)
        return func.HttpResponse(result, status_code=200, mimetype="application/json")
    except Exception as e:
        return func.HttpResponse(
            '{"success": false, "error": "' + str(e) + '"}',
            status_code=500,
            mimetype="application/json"
        )