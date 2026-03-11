"""
link_routes.py — Account linking endpoints.
"""

from flask import request
from utils.auth import extract_user
from utils.email import send_link_verification
from utils.response import ok, error
from repositories.user_repo import get_user_by_username, link_sub_to_user, get_decrypted_email
from repositories.link_repo import create_link_token, consume_link_token


def handle_request_account_link():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)

        body     = request.get_json(silent=True) or {}
        username = (body.get("username") or "").strip().lower()

        if not username:
            return error("Username is required", 400)

        existing = get_user_by_username(username)
        if not existing:
            return error("Account not found", 404)

        existing_subs = existing.get("auth0_subs") or []
        if user["id"] in existing_subs:
            return error("This is already your account", 400)

        # Decrypt email in memory — never returned to client
        existing_email = get_decrypted_email(existing.get("auth0_subs", [None])[0])
        if not existing_email:
            return error(
                "That account has no email on file. Please contact support to link manually.", 400
            )

        token = create_link_token(new_sub=user["id"], target_username=username)
        sent  = send_link_verification(existing_email, username, token)

        if not sent:
            return error("Failed to send verification email. Please try again.", 500)

        # Respond with masked email so user knows where to look
        masked = _mask_email(existing_email)
        return ok({"message": f"Verification email sent to {masked}."})

    except Exception as e:
        return error(str(e))


def handle_verify_account_link():
    try:
        token_str = request.args.get("token", "").strip()
        if not token_str:
            return error("Missing token", 400)

        token_doc = consume_link_token(token_str)
        if not token_doc:
            return error("This link is invalid or has expired.", 400)

        success = link_sub_to_user(
            username=token_doc["target_username"],
            new_sub=token_doc["new_sub"],
        )
        if not success:
            return error("Account not found. It may have been deleted.", 404)

        return ok({
            "username": token_doc["target_username"],
            "message":  "Accounts linked successfully.",
        })

    except Exception as e:
        return error(str(e))


def _mask_email(email):
    """Return n****@domain.com style masked email."""
    try:
        local, domain = email.split("@")
        masked_local = local[0] + "*" * min(len(local) - 1, 4)
        return f"{masked_local}@{domain}"
    except Exception:
        return "your email"
