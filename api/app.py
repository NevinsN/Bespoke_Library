import os
from flask import Flask
from flask_cors import CORS
from utils.telemetry import init_telemetry

from routes.novel_routes  import handle_get_novels, handle_get_chapters, handle_get_chapter_content, handle_record_event
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
from routes.message_routes import handle_send_message
from routes.admin_routes  import (
    handle_admin_stats, handle_admin_events_by_day,
    handle_admin_list_users, handle_admin_get_user,
    handle_admin_suspend_user, handle_admin_grant_access, handle_admin_revoke_access,
    handle_admin_list_applications, handle_admin_review_application,
    handle_admin_list_manuscripts, handle_admin_flag_manuscript, handle_admin_force_hide_draft,
    handle_admin_list_invites, handle_admin_revoke_invite,
    handle_admin_list_messages, handle_admin_resolve_message,
    handle_admin_audit_log,
)

app = Flask(__name__)

CORS(app, origins=[
    "https://bespoke.nicholasnevins.org",
    "https://purple-moss-00a59f61e.azurestaticapps.net",
    "http://localhost:4280",
    "http://localhost:3000",
], supports_credentials=True, allow_headers=["Authorization", "Content-Type"],
   methods=["GET", "POST", "OPTIONS"])

# ── Azure Application Insights ────────────────────────────────────────────────
init_telemetry(app)

# ── Reader routes ─────────────────────────────────────────────────────────────
@app.get("/api/GetNovels")
def get_novels(): return handle_get_novels()

@app.get("/api/GetChapters")
def get_chapters(): return handle_get_chapters()

@app.get("/api/GetChapterContent")
def get_chapter_content(): return handle_get_chapter_content()

@app.post("/api/RecordEvent")
def record_event_route(): return handle_record_event()

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

# ── Messaging ─────────────────────────────────────────────────────────────────
@app.post("/api/SendMessage")
def send_message(): return handle_send_message()

# ── Admin routes ──────────────────────────────────────────────────────────────
@app.get("/api/admin/Stats")
def admin_stats(): return handle_admin_stats()

@app.get("/api/admin/EventsByDay")
def admin_events_by_day(): return handle_admin_events_by_day()

@app.get("/api/admin/Users")
def admin_list_users(): return handle_admin_list_users()

@app.get("/api/admin/User")
def admin_get_user(): return handle_admin_get_user()

@app.post("/api/admin/SuspendUser")
def admin_suspend_user(): return handle_admin_suspend_user()

@app.post("/api/admin/GrantAccess")
def admin_grant_access(): return handle_admin_grant_access()

@app.post("/api/admin/RevokeAccess")
def admin_revoke_access(): return handle_admin_revoke_access()

@app.get("/api/admin/Applications")
def admin_list_applications(): return handle_admin_list_applications()

@app.post("/api/admin/ReviewApplication")
def admin_review_application(): return handle_admin_review_application()

@app.get("/api/admin/Manuscripts")
def admin_list_manuscripts(): return handle_admin_list_manuscripts()

@app.post("/api/admin/FlagManuscript")
def admin_flag_manuscript(): return handle_admin_flag_manuscript()

@app.post("/api/admin/ForceHideDraft")
def admin_force_hide_draft(): return handle_admin_force_hide_draft()

@app.get("/api/admin/Invites")
def admin_list_invites(): return handle_admin_list_invites()

@app.post("/api/admin/RevokeInvite")
def admin_revoke_invite(): return handle_admin_revoke_invite()

@app.get("/api/admin/Messages")
def admin_list_messages(): return handle_admin_list_messages()

@app.post("/api/admin/ResolveMessage")
def admin_resolve_message(): return handle_admin_resolve_message()

@app.get("/api/admin/AuditLog")
def admin_audit_log(): return handle_admin_audit_log()

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
