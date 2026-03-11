"""
auth.py — Auth0 JWT verification.

Replaces the old x-ms-client-principal / Azure SWA approach.
Every request sends:  Authorization: Bearer <access_token>

The token is verified against Auth0's public JWKS, then we look up
or create the user record by auth0_sub.
"""

import os
import requests as http_requests
from flask import request
from jose import jwt, JWTError
from repositories.user_repo import upsert_user_by_sub, get_user_by_sub

AUTH0_DOMAIN   = os.getenv("AUTH0_DOMAIN", "")
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "")
ADMIN_LIST     = [e.strip() for e in os.getenv("ADMIN_EMAIL", "").split(",") if e]

# Cache JWKS so we don't fetch on every request
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
                "kty": key["kty"],
                "kid": key["kid"],
                "use": key["use"],
                "n":   key["n"],
                "e":   key["e"],
            }
            break
    if not rsa_key:
        raise JWTError("Unable to find matching key")
    payload = jwt.decode(
        token,
        rsa_key,
        algorithms=["RS256"],
        audience=AUTH0_AUDIENCE,
        issuer=f"https://{AUTH0_DOMAIN}/",
    )
    return payload


def extract_user(req=None):
    """
    Extract and verify Auth0 JWT from Authorization: Bearer header.
    Returns user dict or None if unauthenticated.

    Shape matches old system so all routes stay identical:
    {
        "id":           auth0_sub,
        "email":        email or None,
        "username":     username or None,
        "roles":        [],
        "is_admin":     bool,
        "has_username": bool,
    }
    """
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

    sub   = payload.get("sub")
    email = (payload.get("email") or "").lower() or None
    is_admin = email in ADMIN_LIST if email else False

    if sub:
        upsert_user_by_sub(sub, email)
        user_doc = get_user_by_sub(sub)
        username = user_doc.get("username") if user_doc else None
    else:
        username = None

    return {
        "id":           sub,
        "email":        email,
        "username":     username,
        "roles":        [],
        "is_admin":     is_admin,
        "has_username": bool(username),
    }
