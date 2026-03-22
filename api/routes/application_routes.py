"""
application_routes.py — Public author application submission.
"""

from flask import request
from utils.auth import extract_user
from utils.response import ok, error
from utils.email import send_application_received
from repositories.pg_application_repo import create_application
import os

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "nevins.nicholas@gmail.com")


def handle_submit_application():
    try:
        body = request.get_json(silent=True) or {}

        name        = (body.get("name")                or "").strip()
        email       = (body.get("email")               or "").strip()
        background  = (body.get("background")          or "").strip()
        project     = (body.get("project_description") or "").strip()
        links       = (body.get("links")               or "").strip()

        if not name:
            return error("Name is required", 400)
        if not email or "@" not in email:
            return error("Valid email is required", 400)
        if len(background) < 50:
            return error("Background too short", 400)
        if len(project) < 50:
            return error("Project description too short", 400)
        if len(name) > 128:
            return error("Name too long", 400)
        if len(background) > 2000:
            return error("Background too long", 400)
        if len(project) > 2000:
            return error("Project description too long", 400)

        application_id = create_application(
            name=name,
            email=email,
            background=background,
            project_description=project,
            links=links,
        )

        # Notify admin
        try:
            send_application_received(ADMIN_EMAIL, name, email, project)
        except Exception:
            pass

        return ok({"application_id": application_id})
    except Exception as e:
        return error(str(e))
