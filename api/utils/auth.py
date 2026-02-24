import base64
import json
import os
from repositories.user_repo import upsert_user


def extract_user(req):
    header = req.headers.get("x-ms-client-principal")
    if not header:
        return None

    payload = json.loads(base64.b64decode(header).decode('utf-8'))

    email = payload.get("userDetails")

    admin_secrets = os.getenv("ADMIN_EMAIL", "")
    admin_list = [e.strip() for e in admin_secrets.split(",") if e]
    is_admin = email in admin_list

    # Ensure a user record exists — no-op after first login
    if email:
        upsert_user(email)

    return {
        "id": payload.get("userId"),
        "email": email,
        "roles": payload.get("userRoles", []),
        "is_admin": is_admin
    }
