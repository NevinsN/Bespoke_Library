from flask import request
from services.health_service import check_health, get_ping_history
from utils.auth import extract_user
from utils.response import ok, error


def handle_health():
    try:
        source = request.args.get("source", "dashboard")
        result = check_health(source=source)
        return ok(result)
    except Exception as e:
        return error(str(e))


def handle_ping_history():
    try:
        user = extract_user()
        if not user or not user.get("is_admin"):
            return error("Unauthorized", 401)
        hours = int(request.args.get("hours", 24))
        hours = min(max(hours, 1), 168)
        pings = get_ping_history(hours=hours)
        return ok(pings)
    except Exception as e:
        return error(str(e))


def handle_whoami():
    """Debug endpoint — returns what the API sees for the current user."""
    from flask import request as flask_request
    user = extract_user()
    # Also show raw header for debugging
    raw_header = flask_request.headers.get("x-ms-client-principal", "NOT PRESENT")
    return ok({
        "user": user,
        "header_present": raw_header != "NOT PRESENT",
        "header_length": len(raw_header) if raw_header != "NOT PRESENT" else 0,
        "all_headers": dict(flask_request.headers),
    })
