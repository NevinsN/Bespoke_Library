# utils/auth.py

import base64
import json

def extract_user(req):
    header = req.headers.get("x-ms-client-principal")

    if not header:
        raise ValueError("Missing auth header")

    payload = json.loads(base64.b64decode(header))
    
    return {
        "id": payload.get("userId"),
        "email": payload.get("userDetails"),
        "roles": payload.get("userRoles", [])
    }