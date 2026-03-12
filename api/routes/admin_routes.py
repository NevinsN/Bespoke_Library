"""
admin_routes.py — All admin API endpoints.
Every handler checks is_admin before proceeding.
"""

from flask import request
from utils.auth import extract_user
from utils.response import ok, error
from repositories.event_repo import get_platform_stats, get_events, get_events_by_day
from repositories.audit_repo import log_action, get_audit_log
from repositories.application_repo import (
    get_applications, get_application,
    set_application_status, link_application_to_user, create_application,
)
from repositories.message_repo import (
    get_messages, get_message, resolve_message,
    mark_message_read, get_unread_count,
)
from repositories.user_repo import (
    get_user_by_sub, get_user_by_username,
)
from repositories.access_repo import (
    get_grants_for_user, grant_access, revoke_access, get_grants_for_scope,
)
from repositories.invite_repo import get_invites_for_scope, revoke_invite
from repositories.manuscript_repo import get_all_manuscripts, get_manuscript_by_id
from repositories.draft_repo import get_drafts_for_manuscript, set_draft_visibility
from repositories.db import db, serialize_list
from bson.objectid import ObjectId
from datetime import datetime


def _require_admin():
    user = extract_user()
    if not user or not user.get("is_admin"):
        return None, error("Forbidden", 403)
    return user, None


# ─── Stats ────────────────────────────────────────────────────────────────────

def handle_admin_stats():
    try:
        user, err = _require_admin()
        if err: return err
        days  = int(request.args.get("days", 30))
        stats = get_platform_stats(since_days=days)
        return ok(stats)
    except Exception as e:
        return error(str(e))


def handle_admin_events_by_day():
    try:
        user, err = _require_admin()
        if err: return err
        event_type = request.args.get("event_type", "chapter_opened")
        days       = int(request.args.get("days", 30))
        data       = get_events_by_day(event_type, since_days=days)
        return ok(data)
    except Exception as e:
        return error(str(e))


# ─── Users ────────────────────────────────────────────────────────────────────

def handle_admin_list_users():
    try:
        user, err = _require_admin()
        if err: return err
        users = serialize_list(db["users"].find().sort("created_at", -1))
        # Strip encrypted email — return only username, subs, created_at
        for u in users:
            u.pop("email_enc", None)
        return ok(users)
    except Exception as e:
        return error(str(e))


def handle_admin_get_user():
    try:
        user, err = _require_admin()
        if err: return err
        sub = request.args.get("sub")
        if not sub:
            return error("sub is required", 400)
        target = get_user_by_sub(sub)
        if not target:
            return error("User not found", 404)
        target.pop("email_enc", None)
        grants = get_grants_for_user(sub)
        return ok({"user": target, "grants": grants})
    except Exception as e:
        return error(str(e))


def handle_admin_suspend_user():
    try:
        admin, err = _require_admin()
        if err: return err
        body      = request.get_json(silent=True) or {}
        target_sub = body.get("user_id")
        suspended  = body.get("suspended", True)
        if not target_sub:
            return error("user_id is required", 400)

        db["users"].update_one(
            {"auth0_subs": target_sub},
            {"$set": {"suspended": suspended}}
        )
        log_action(
            admin_id=admin["id"],
            action="suspend_user" if suspended else "unsuspend_user",
            target_type="user",
            target_id=target_sub,
        )
        return ok({"user_id": target_sub, "suspended": suspended})
    except Exception as e:
        return error(str(e))


def handle_admin_grant_access():
    try:
        admin, err = _require_admin()
        if err: return err
        body       = request.get_json(silent=True) or {}
        user_id    = body.get("user_id")
        scope_type = body.get("scope_type")
        scope_id   = body.get("scope_id")
        role       = body.get("role", "reader")

        if not all([user_id, scope_type, scope_id]):
            return error("user_id, scope_type, scope_id required", 400)

        grant_access(user_id, scope_type, scope_id, role, granted_by=admin["id"])
        log_action(
            admin_id=admin["id"], action="grant_access",
            target_type="user", target_id=user_id,
            detail={"scope_type": scope_type, "scope_id": scope_id, "role": role},
        )
        return ok({"granted": True})
    except Exception as e:
        return error(str(e))


def handle_admin_revoke_access():
    try:
        admin, err = _require_admin()
        if err: return err
        body       = request.get_json(silent=True) or {}
        user_id    = body.get("user_id")
        scope_type = body.get("scope_type")
        scope_id   = body.get("scope_id")

        if not all([user_id, scope_type, scope_id]):
            return error("user_id, scope_type, scope_id required", 400)

        revoke_access(user_id, scope_type, scope_id)
        log_action(
            admin_id=admin["id"], action="revoke_access",
            target_type="user", target_id=user_id,
            detail={"scope_type": scope_type, "scope_id": scope_id},
        )
        return ok({"revoked": True})
    except Exception as e:
        return error(str(e))


# ─── Applications ─────────────────────────────────────────────────────────────

def handle_admin_list_applications():
    try:
        user, err = _require_admin()
        if err: return err
        status = request.args.get("status")  # pending | approved | rejected
        apps   = get_applications(status=status)
        return ok(apps)
    except Exception as e:
        return error(str(e))


def handle_admin_review_application():
    try:
        admin, err = _require_admin()
        if err: return err
        body           = request.get_json(silent=True) or {}
        application_id = body.get("application_id")
        status         = body.get("status")  # approved | rejected
        review_note    = body.get("review_note", "")

        if not application_id or status not in ("approved", "rejected"):
            return error("application_id and status (approved|rejected) required", 400)

        app = get_application(application_id)
        if not app:
            return error("Application not found", 404)

        set_application_status(application_id, status, admin["id"], review_note)

        # On approval, grant studio author access if user exists
        if status == "approved":
            target_user = get_user_by_username(app["email"].split("@")[0]) or \
                          serialize_list(db["users"].find({"email_enc": {"$exists": True}})[:1])
            # Best effort — admin can manually grant access via handle_admin_grant_access
            # if user hasn't registered yet

        log_action(
            admin_id=admin["id"],
            action=f"application_{status}",
            target_type="application",
            target_id=application_id,
            detail={"review_note": review_note, "applicant_email": app.get("email")},
        )
        return ok({"application_id": application_id, "status": status})
    except Exception as e:
        return error(str(e))


# ─── Manuscripts ──────────────────────────────────────────────────────────────

def handle_admin_list_manuscripts():
    try:
        user, err = _require_admin()
        if err: return err
        manuscripts = get_all_manuscripts()
        result = []
        for m in manuscripts:
            m["_id"] = str(m["_id"])
            drafts = get_drafts_for_manuscript(m["_id"])
            m["drafts"] = [{"_id": str(d["_id"]), "name": d["name"],
                            "public": d.get("public", False),
                            "flagged": d.get("flagged", False)} for d in drafts]
            result.append(m)
        return ok(result)
    except Exception as e:
        return error(str(e))


def handle_admin_flag_manuscript():
    try:
        admin, err = _require_admin()
        if err: return err
        body      = request.get_json(silent=True) or {}
        draft_id  = body.get("draft_id")
        flagged   = body.get("flagged", True)
        reason    = body.get("reason", "")

        if not draft_id:
            return error("draft_id required", 400)

        db["drafts"].update_one(
            {"_id": ObjectId(draft_id)},
            {"$set": {
                "flagged":        flagged,
                "flag_reason":    reason,
                "flagged_at":     datetime.utcnow() if flagged else None,
                "flagged_by":     admin["id"] if flagged else None,
            }}
        )
        log_action(
            admin_id=admin["id"],
            action="flag_draft" if flagged else "unflag_draft",
            target_type="draft",
            target_id=draft_id,
            detail={"reason": reason},
        )
        return ok({"draft_id": draft_id, "flagged": flagged})
    except Exception as e:
        return error(str(e))


def handle_admin_force_hide_draft():
    try:
        admin, err = _require_admin()
        if err: return err
        body     = request.get_json(silent=True) or {}
        draft_id = body.get("draft_id")
        hidden   = body.get("hidden", True)

        if not draft_id:
            return error("draft_id required", 400)

        db["drafts"].update_one(
            {"_id": ObjectId(draft_id)},
            {"$set": {"admin_hidden": hidden}}
        )
        log_action(
            admin_id=admin["id"],
            action="force_hide_draft" if hidden else "force_show_draft",
            target_type="draft",
            target_id=draft_id,
        )
        return ok({"draft_id": draft_id, "admin_hidden": hidden})
    except Exception as e:
        return error(str(e))


# ─── Invites ──────────────────────────────────────────────────────────────────

def handle_admin_list_invites():
    try:
        user, err = _require_admin()
        if err: return err
        invites = serialize_list(
            db["invites"].find({"active": True}).sort("created_at", -1)
        )
        return ok(invites)
    except Exception as e:
        return error(str(e))


def handle_admin_revoke_invite():
    try:
        admin, err = _require_admin()
        if err: return err
        body  = request.get_json(silent=True) or {}
        token = body.get("token")
        if not token:
            return error("token required", 400)

        db["invites"].update_one({"token": token}, {"$set": {"active": False}})
        log_action(
            admin_id=admin["id"], action="revoke_invite",
            target_type="invite", target_id=token,
        )
        return ok({"revoked": True})
    except Exception as e:
        return error(str(e))


# ─── Messages ─────────────────────────────────────────────────────────────────

def handle_admin_list_messages():
    try:
        user, err = _require_admin()
        if err: return err
        status   = request.args.get("status")
        messages = get_messages(status=status)
        unread   = get_unread_count()
        return ok(messages, meta={"unread": unread})
    except Exception as e:
        return error(str(e))


def handle_admin_resolve_message():
    try:
        admin, err = _require_admin()
        if err: return err
        body       = request.get_json(silent=True) or {}
        message_id = body.get("message_id")
        admin_note = body.get("admin_note", "")
        if not message_id:
            return error("message_id required", 400)
        resolve_message(message_id, admin["id"], admin_note)
        log_action(
            admin_id=admin["id"], action="resolve_message",
            target_type="message", target_id=message_id,
        )
        return ok({"resolved": True})
    except Exception as e:
        return error(str(e))


# ─── Audit log ────────────────────────────────────────────────────────────────

def handle_admin_audit_log():
    try:
        user, err = _require_admin()
        if err: return err
        limit  = int(request.args.get("limit", 200))
        action = request.args.get("action")
        log    = get_audit_log(limit=limit, action=action)
        return ok(log)
    except Exception as e:
        return error(str(e))
