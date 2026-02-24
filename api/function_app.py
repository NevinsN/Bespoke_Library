import azure.functions as func
from routes.novel_routes import handle_get_novels, handle_get_chapters, handle_get_chapter_content
from routes.upload_files import handle_upload_files
from routes.author_routes import (
    handle_get_authored_manuscripts,
    handle_create_project,
    handle_get_drafts,
)
from routes.invite_routes import (
    handle_create_invite,
    handle_redeem_invite,
    handle_revoke_invite,
    handle_list_invites,
)

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# ── Reader routes ─────────────────────────────────────────────────────────────
@app.route(route="GetNovels", methods=["GET"])
def get_novels(req: func.HttpRequest) -> func.HttpResponse:
    return handle_get_novels(req)

@app.route(route="GetChapters", methods=["GET"])
def get_chapters(req: func.HttpRequest) -> func.HttpResponse:
    return handle_get_chapters(req)

@app.route(route="GetChapterContent", methods=["GET"])
def get_chapter_content(req: func.HttpRequest) -> func.HttpResponse:
    return handle_get_chapter_content(req)

# ── Author routes ─────────────────────────────────────────────────────────────
@app.route(route="GetAuthoredManuscripts", methods=["GET"])
def get_authored_manuscripts(req: func.HttpRequest) -> func.HttpResponse:
    return handle_get_authored_manuscripts(req)

@app.route(route="CreateProject", methods=["POST"])
def create_project(req: func.HttpRequest) -> func.HttpResponse:
    return handle_create_project(req)

@app.route(route="GetDrafts", methods=["GET"])
def get_drafts(req: func.HttpRequest) -> func.HttpResponse:
    return handle_get_drafts(req)

@app.route(route="UploadFiles", methods=["POST"])
def upload_files(req: func.HttpRequest) -> func.HttpResponse:
    return handle_upload_files(req)

# ── Invite routes ─────────────────────────────────────────────────────────────
@app.route(route="CreateInvite", methods=["POST"])
def create_invite(req: func.HttpRequest) -> func.HttpResponse:
    return handle_create_invite(req)

@app.route(route="RedeemInvite", methods=["POST"])
def redeem_invite(req: func.HttpRequest) -> func.HttpResponse:
    return handle_redeem_invite(req)

@app.route(route="RevokeInvite", methods=["POST"])
def revoke_invite(req: func.HttpRequest) -> func.HttpResponse:
    return handle_revoke_invite(req)

@app.route(route="ListInvites", methods=["GET"])
def list_invites(req: func.HttpRequest) -> func.HttpResponse:
    return handle_list_invites(req)

# ── Utility ───────────────────────────────────────────────────────────────────
@app.route(route="DemoPing", methods=["GET"])
def demo_ping(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse("pong", status_code=200)
