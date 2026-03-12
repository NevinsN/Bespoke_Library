"""
audit_repo.py — Immutable admin action audit log.
Every action an admin takes is recorded here.
"""

from .db import db, serialize_list
from datetime import datetime


def log_action(admin_id, action, target_type=None, target_id=None, detail=None):
    """
    Record an admin action.
    action:      string e.g. 'suspend_user', 'approve_application', 'force_hide_draft'
    target_type: 'user' | 'manuscript' | 'draft' | 'application' | 'invite'
    target_id:   the _id of the affected document
    detail:      dict with any extra context
    """
    db["audit_log"].insert_one({
        "admin_id":    admin_id,
        "action":      action,
        "target_type": target_type,
        "target_id":   str(target_id) if target_id else None,
        "detail":      detail or {},
        "created_at":  datetime.utcnow(),
    })


def get_audit_log(limit=200, admin_id=None, action=None):
    query = {}
    if admin_id: query["admin_id"] = admin_id
    if action:   query["action"]   = action
    return serialize_list(
        db["audit_log"].find(query).sort("created_at", -1).limit(limit)
    )
