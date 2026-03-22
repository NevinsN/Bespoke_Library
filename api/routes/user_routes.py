"""
user_routes.py — Username management and profile endpoints.
"""

import re
from flask import request
from utils.auth import extract_user
from utils.response import ok, error
from repositories.pg_user_repo import get_user_by_sub, set_username, check_username_available

USERNAME_RE = re.compile(r'^[a-zA-Z0-9_]{3,20}$')


def handle_set_username():
    """Set or update the username for the authenticated user."""
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)

        body    = request.get_json(silent=True) or {}
        username = (body.get("username") or "").strip()

        if not username:
            return error("Username is required", 400)

        if not USERNAME_RE.match(username):
            return error("Username must be 3-20 characters, letters/numbers/underscores only", 400)

        # Reserved words
        reserved = {"admin", "bespoke", "library", "author", "reader", "system", "support"}
        if username.lower() in reserved:
            return error("That username is reserved", 400)

        success = set_username(user["id"], username)
        if not success:
            return error("Username already taken", 409)

        return ok({"username": username})

    except Exception as e:
        return error(str(e))


def handle_check_username():
    try:
        username = request.args.get("username", "").strip()
        if not username:
            return error("username is required", 400)
        available = check_username_available(username)
        return ok({"available": available})
    except Exception as e:
        return error(str(e))


def handle_get_me():
    """Return current user's profile."""
    try:
        user = extract_user()
        if not user:
            return ok({"user": None})

        return ok({
            "user": {
                "id":           user["id"],
                "username":     user["username"],
                "is_admin":     user["is_admin"],
                "has_username": user["has_username"],
            }
        })

    except Exception as e:
        return error(str(e))
