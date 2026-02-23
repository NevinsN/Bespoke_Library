import azure.functions as func
from utils.response import ok, error
from services.author_service import process_uploaded_chapters
import zipfile
from io import BytesIO
import markdown
from docx import Document

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# -------------------------
# Upload chapters/files
# -------------------------
@app.route(route="UploadChapters", methods=["POST"])
def upload_chapters(req: func.HttpRequest) -> func.HttpResponse:
    """
    Accepts:
    - manuscript_id: str
    - mode: "sequential" or "non-sequential"
    - files[]: list of uploaded files
    - optional slot info for non-sequential mode
    """
    try:
        manuscript_id = req.form.get("manuscript_id")
        mode = req.form.get("mode", "sequential")
        sequential = mode == "sequential"

        uploaded_files = []

        for key in req.files:
            file = req.files[key]
            filename = file.filename

            if filename.endswith(".zip"):
                with zipfile.ZipFile(BytesIO(file.stream.read())) as z:
                    for name in sorted(z.namelist()):
                        if not z.getinfo(name).is_dir():
                            content = z.read(name).decode("utf-8")
                            uploaded_files.append({"filename": name, "title": name, "content": content})
            elif filename.endswith(".md"):
                content = file.stream.read().decode("utf-8")
                uploaded_files.append({"filename": filename, "title": filename.replace(".md", ""), "content": markdown.markdown(content)})
            elif filename.endswith(".docx"):
                doc = Document(file.stream)
                chapter_texts = []
                current_title = "Front Matter"
                current_content = ""
                for para in doc.paragraphs:
                    if para.style.name.startswith("Heading"):
                        if current_content:
                            uploaded_files.append({"filename": current_title, "title": current_title, "content": current_content})
                        current_title = para.text
                        current_content = ""
                    else:
                        current_content += para.text + "\n"
                if current_content:
                    uploaded_files.append({"filename": current_title, "title": current_title, "content": current_content})
            else:
                continue  # ignore unsupported files

        # Handle sequential/non-sequential slots
        # Slot mapping can be extracted from form data for non-sequential
        for f in uploaded_files:
            slot = req.form.get(f"slot_{f['filename']}")
            if slot is not None:
                f["slot"] = int(slot)

        result = process_uploaded_chapters(manuscript_id, "Draft One", uploaded_files, sequential=sequential)
        return ok(result)
    except Exception as e:
        return error(f"Upload failed: {str(e)}")