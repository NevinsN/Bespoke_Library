import os
from flask import Flask
from flask_cors import CORS

from routes.novel_routes  import handle_get_novels, handle_get_chapters, handle_get_chapter_content
from routes.upload_files  import handle_upload_files
from routes.author_routes import (handle_get_authored_manuscripts, handle_create_project,
    handle_get_drafts, handle_set_draft_visibility, handle_set_chapter_status,
    handle_publish_draft, handle_delete_chapter, handle_set_comments_enabled,
    handle_reorder_chapters, handle_replace_chapter)
from routes.invite_routes import handle_create_invite, handle_redeem_invite, handle_revoke_invite, handle_list_invites
from routes.health_routes import handle_health, handle_ping_history, handle_whoami
from routes.export_routes import handle_export_draft
from routes.comment_routes import handle_create_comment, handle_get_comments, handle_set_comment_status, handle_get_unread_count
from routes.user_routes   import handle_set_username, handle_check_username, handle_get_me
from routes.link_routes   import handle_request_account_link, handle_verify_account_link

app = Flask(__name__)

CORS(app, origins=[
    "https://bespoke.nicholasnevins.org",
    "https://purple-moss-00a59f61e.azurestaticapps.net",
    "http://localhost:4280",
    "http://localhost:3000",
], supports_credentials=True, allow_headers=["Authorization", "Content-Type"],
   methods=["GET", "POST", "OPTIONS"])

# ── Reader routes ─────────────────────────────────────────────────────────────
@app.get("/api/GetNovels")
def get_novels(): return handle_get_novels()

@app.get("/api/GetChapters")
def get_chapters(): return handle_get_chapters()

@app.get("/api/GetChapterContent")
def get_chapter_content(): return handle_get_chapter_content()

# ── Author routes ─────────────────────────────────────────────────────────────
@app.get("/api/GetAuthoredManuscripts")
def get_authored_manuscripts(): return handle_get_authored_manuscripts()

@app.post("/api/CreateProject")
def create_project(): return handle_create_project()

@app.get("/api/GetDrafts")
def get_drafts(): return handle_get_drafts()

@app.post("/api/SetDraftVisibility")
def set_draft_visibility(): return handle_set_draft_visibility()

@app.post("/api/SetChapterStatus")
def set_chapter_status(): return handle_set_chapter_status()

@app.post("/api/PublishDraft")
def publish_draft(): return handle_publish_draft()

@app.post("/api/DeleteChapter")
def delete_chapter(): return handle_delete_chapter()

@app.post("/api/SetCommentsEnabled")
def set_comments_enabled(): return handle_set_comments_enabled()

@app.post("/api/ReorderChapters")
def reorder_chapters(): return handle_reorder_chapters()

@app.post("/api/ReplaceChapter")
def replace_chapter(): return handle_replace_chapter()

@app.get("/api/ExportDraft")
def export_draft(): return handle_export_draft()

# ── Comment routes ────────────────────────────────────────────────────────────
@app.post("/api/CreateComment")
def create_comment(): return handle_create_comment()

@app.get("/api/GetComments")
def get_comments(): return handle_get_comments()

@app.post("/api/SetCommentStatus")
def set_comment_status(): return handle_set_comment_status()

@app.get("/api/GetUnreadCommentCount")
def get_unread_count(): return handle_get_unread_count()

@app.post("/api/UploadFiles")
def upload_files(): return handle_upload_files()

# ── Invite routes ─────────────────────────────────────────────────────────────
@app.post("/api/CreateInvite")
def create_invite(): return handle_create_invite()

@app.post("/api/RedeemInvite")
def redeem_invite(): return handle_redeem_invite()

@app.post("/api/RevokeInvite")
def revoke_invite(): return handle_revoke_invite()

@app.get("/api/ListInvites")
def list_invites(): return handle_list_invites()

# ── User / profile routes ─────────────────────────────────────────────────────
@app.post("/api/SetUsername")
def set_username(): return handle_set_username()

@app.get("/api/CheckUsername")
def check_username(): return handle_check_username()

@app.get("/api/GetMe")
def get_me(): return handle_get_me()

# ── Account linking routes ────────────────────────────────────────────────────
@app.post("/api/RequestAccountLink")
def request_account_link(): return handle_request_account_link()

@app.get("/api/VerifyAccountLink")
def verify_account_link(): return handle_verify_account_link()

# ── Health routes ─────────────────────────────────────────────────────────────
@app.get("/api/Health")
def health(): return handle_health()

@app.get("/api/PingHistory")
def ping_history(): return handle_ping_history()

@app.get("/api/WhoAmI")
def whoami(): return handle_whoami()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    app.run(host="0.0.0.0", port=port)
