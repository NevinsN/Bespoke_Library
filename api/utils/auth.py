import os
import requests as http_requests
from flask import request
from jose import jwt, JWTError
from repositories.user_repo import upsert_user_by_sub, get_user_by_sub

AUTH0_DOMAIN   = os.getenv("AUTH0_DOMAIN", "")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "")
ADMIN_LIST     = [s.strip() for s in os.getenv("ADMIN_SUB", "").split(",") if s]

_jwks_cache = None

def _get_jwks():
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    resp = http_requests.get(url, timeout=10)
    resp.raise_for_status()
    _jwks_cache = resp.json()
    return _jwks_cache

def _verify_token(token):
    jwks = _get_jwks()
    unverified_header = jwt.get_unverified_header(token)
    rsa_key = {}
    for key in jwks.get("keys", []):
        if key.get("kid") == unverified_header.get("kid"):
            rsa_key = {
                "kty": key["kty"], "kid": key["kid"],
                "use": key["use"], "n": key["n"], "e": key["e"],
            }
            break
    if not rsa_key:
        raise JWTError("Unable to find matching key")
    return jwt.decode(
        token, rsa_key, algorithms=["RS256"],
        audience=AUTH0_AUDIENCE,
        issuer=f"https://{AUTH0_DOMAIN}/",
    )


def extract_user(req=None):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:]
    if not token:
        return None

    try:
        payload = _verify_token(token)
    except Exception:
        return None

    sub = payload.get("sub")
    if not sub:
        return None

    # Email from token (only present if Auth0 Action injects it)
    email_from_token = (payload.get("email") or "").lower() or None

    # Upsert — encrypts and stores email if present
    upsert_user_by_sub(sub, email_from_token)

    user_doc = get_user_by_sub(sub)
    username = user_doc.get("username") if user_doc else None
    is_admin = sub in ADMIN_LIST

    # Note: email is NOT included in the returned user dict.
    # It is stored encrypted and only accessed via get_decrypted_email()
    # in the account linking flow.
    return {
        "id":           sub,
        "username":     username,
        "roles":        [],
        "is_admin":     is_admin,
        "has_username": bool(username),
    }
