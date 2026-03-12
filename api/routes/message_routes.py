"""
message_routes.py — Public endpoint for users to send support messages.
"""

from flask import request
from utils.auth import extract_user
from utils.response import ok, error
from repositories.message_repo import create_message


def handle_send_message():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)

        body    = request.get_json(silent=True) or {}
        subject = (body.get("subject") or "").strip()
        msg_body = (body.get("body") or "").strip()

        if not subject or not msg_body:
            return error("subject and body are required", 400)
        if len(subject) > 120:
            return error("Subject too long (max 120 chars)", 400)
        if len(msg_body) > 4000:
            return error("Message too long (max 4000 chars)", 400)

        message_id = create_message(
            user_id=user["id"],
            username=user.get("username") or "unknown",
            subject=subject,
            body=msg_body,
        )
        return ok({"message_id": message_id})
    except Exception as e:
        return error(str(e))
