import base64
import json
import os

def extract_user(req):
    header = req.headers.get("x-ms-client-principal")
    if not header:
        return None  # Return None so the route can decide how to handle it

    # Decode the Azure SWA principal header
    payload = json.loads(base64.b64decode(header).decode('utf-8'))
    
    email = payload.get("userDetails")
    
    # Check if user is in the ADMIN_EMAIL list from your settings
    admin_secrets = os.getenv("ADMIN_EMAIL", "")
    admin_list = [e.strip() for e in admin_secrets.split(",") if e]
    is_admin = email in admin_list

    return {
        "id": payload.get("userId"),
        "email": email,
        "roles": payload.get("userRoles", []),
        "is_admin": is_admin
    }