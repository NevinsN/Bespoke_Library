import azure.functions as func
import os
from services.invite_service import (
    create_invite_link,
    redeem_invite_link,
    revoke_invite_link,
    list_invites,
)
from utils.auth import extract_user
from utils.response import ok, error

BASE_URL = os.getenv("APP_BASE_URL", "https://nicholasnevins.org")


def handle_create_invite(req: func.HttpRequest) -> func.HttpResponse:
    """
    POST — Create an invite link.
    Body (JSON):
      { scope_type, scope_id, expires_days?, max_uses? }
    """
    try:
        user = extract_user(req)
        if not user:
            return error("Unauthorized", 401)

        body = req.get_json()
        scope_type  = body.get("scope_type")
        scope_id    = body.get("scope_id")
        expires     = int(body.get("expires_days", 7))
        max_uses    = int(body.get("max_uses", 1))

        if not scope_type or not scope_id:
            return error("scope_type and scope_id are required", 400)

        if scope_type not in ("series", "manuscript", "draft"):
            return error("scope_type must be series, manuscript, or draft", 400)

        if max_uses < 1 or max_uses > 500:
            return error("max_uses must be between 1 and 500", 400)

        if expires < 1 or expires > 30:
            return error("expires_days must be between 1 and 30", 400)

        token = create_invite_link(
            owner_email=user["email"],
            scope_type=scope_type,
            scope_id=scope_id,
            expires_days=expires,
            max_uses=max_uses,
        )

        invite_url = f"{BASE_URL}/?invite={token}"
        return ok({"token": token, "url": invite_url})

    except PermissionError as e:
        return error(str(e), 403)
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(str(e))


def handle_redeem_invite(req: func.HttpRequest) -> func.HttpResponse:
    """
    POST — Redeem an invite token.
    Body (JSON): { token }
    Must be authenticated.
    """
    try:
        user = extract_user(req)
        if not user:
            return error("Unauthorized", 401)

        body  = req.get_json()
        token = body.get("token")
        if not token:
            return error("token is required", 400)

        grant = redeem_invite_link(token, user["email"])
        return ok(grant)

    except PermissionError as e:
        return error(str(e), 403)
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(str(e))


def handle_revoke_invite(req: func.HttpRequest) -> func.HttpResponse:
    """
    POST — Revoke an invite.
    Body (JSON): { token }
    """
    try:
        user = extract_user(req)
        if not user:
            return error("Unauthorized", 401)

        body  = req.get_json()
        token = body.get("token")
        if not token:
            return error("token is required", 400)

        revoke_invite_link(token, user["email"])
        return ok({"revoked": True})

    except PermissionError as e:
        return error(str(e), 403)
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(str(e))


def handle_list_invites(req: func.HttpRequest) -> func.HttpResponse:
    """
    GET — List active invites for a scope.
    Expects ?scope_type=<type>&scope_id=<id>
    """
    try:
        user = extract_user(req)
        if not user:
            return error("Unauthorized", 401)

        scope_type = req.params.get("scope_type")
        scope_id   = req.params.get("scope_id")

        if not scope_type or not scope_id:
            return error("scope_type and scope_id are required", 400)

        invites = list_invites(user["email"], scope_type, scope_id)
        return ok(invites)

    except PermissionError as e:
        return error(str(e), 403)
    except Exception as e:
        return error(str(e))
