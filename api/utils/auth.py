import base64
import json
import os
from flask import request
from repositories.user_repo import upsert_user

ADMIN_LIST = [e.strip() for e in os.getenv("ADMIN_EMAIL", "").split(",") if e]


def extract_user(req=None):
    """
    Reads the x-ms-client-principal header injected by Azure SWA.
    The req parameter is kept for API compatibility but ignored —
    Flask's request context is used directly.
    """
    header = request.headers.get("x-ms-client-principal")
    if not header:
        return None

    try:
        payload = json.loads(base64.b64decode(header).decode("utf-8"))
    except Exception:
        return None

    email    = (payload.get("userDetails") or "").lower() or None
    is_admin = email in ADMIN_LIST

    if email:
        upsert_user(email)
        
    print("ADMIN LIST:", ADMIN_LIST)
    print("CURRENT USER:", email)

    return {
        "id":       payload.get("userId"),
        "email":    email,
        "roles":    payload.get("userRoles", []),
        "is_admin": is_admin,
    }
