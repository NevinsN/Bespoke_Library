import os
from flask import request
from services.invite_service import (
    create_invite_link,
    redeem_invite_link,
    revoke_invite_link,
    list_invites,
)
from utils.auth import extract_user
from utils.response import ok, error

BASE_URL = os.getenv("APP_BASE_URL", "https://bespoke.nicholasnevins.org")


def handle_create_invite():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)
        body       = request.get_json(silent=True) or {}
        scope_type = body.get("scope_type")
        scope_id   = body.get("scope_id")
        expires    = int(body.get("expires_days", 7))
        max_uses   = int(body.get("max_uses", 1))
        if not scope_type or not scope_id:
            return error("scope_type and scope_id are required", 400)
        if scope_type not in ("series", "manuscript", "draft"):
            return error("scope_type must be series, manuscript, or draft", 400)
        token      = create_invite_link(user["id"], scope_type, scope_id, expires, max_uses)
        invite_url = f"{BASE_URL}/?invite={token}"
        return ok({"token": token, "url": invite_url})
    except PermissionError as e:
        return error(str(e), 403)
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(str(e))


def handle_redeem_invite():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)
        body  = request.get_json(silent=True) or {}
        token = body.get("token")
        if not token:
            return error("token is required", 400)
        grant = redeem_invite_link(token, user["id"])
        return ok(grant)
    except PermissionError as e:
        return error(str(e), 403)
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(str(e))


def handle_revoke_invite():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)
        body  = request.get_json(silent=True) or {}
        token = body.get("token")
        if not token:
            return error("token is required", 400)
        revoke_invite_link(token, user["id"])
        return ok({"revoked": True})
    except PermissionError as e:
        return error(str(e), 403)
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(str(e))


def handle_list_invites():
    try:
        user = extract_user()
        if not user:
            return error("Unauthorized", 401)
        scope_type = request.args.get("scope_type")
        scope_id   = request.args.get("scope_id")
        if not scope_type or not scope_id:
            return error("scope_type and scope_id are required", 400)
        invites = list_invites(user["id"], scope_type, scope_id)
        return ok(invites)
    except PermissionError as e:
        return error(str(e), 403)
    except Exception as e:
        return error(str(e))
