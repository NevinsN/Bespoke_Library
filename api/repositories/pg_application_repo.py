"""
pg_application_repo.py — Author applications in PostgreSQL.
Replaces mongo application_repo.
"""

from .pg import pg_cursor


def create_application(name, email, background, project_description, links=""):
    """Submit a new author application. Returns application_id."""
    with pg_cursor() as cur:
        cur.execute("""
            INSERT INTO applications (
                name, email, background, project_desc, links
            ) VALUES (%s, %s, %s, %s, %s)
            RETURNING application_id
        """, (
            name.strip(),
            email.strip().lower(),
            background.strip(),
            project_description.strip(),
            links.strip(),
        ))
        return cur.fetchone()["application_id"]


def get_application(application_id):
    """Fetch a single application by ID."""
    with pg_cursor() as cur:
        cur.execute("""
            SELECT a.*,
                   r.username AS reviewer_username
            FROM applications a
            LEFT JOIN dim_users r ON r.user_key = a.reviewed_by
            WHERE a.application_id = %s
        """, (application_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def get_applications(status=None):
    """List applications, optionally filtered by status."""
    with pg_cursor() as cur:
        if status:
            cur.execute("""
                SELECT a.*,
                       r.username AS reviewer_username
                FROM applications a
                LEFT JOIN dim_users r ON r.user_key = a.reviewed_by
                WHERE a.status = %s
                ORDER BY a.created_at DESC
            """, (status,))
        else:
            cur.execute("""
                SELECT a.*,
                       r.username AS reviewer_username
                FROM applications a
                LEFT JOIN dim_users r ON r.user_key = a.reviewed_by
                ORDER BY a.created_at DESC
            """)
        return [dict(r) for r in cur.fetchall()]


def set_application_status(application_id, status, reviewed_by_sub, review_note=None):
    """
    Approve or reject an application.
    reviewed_by_sub: auth0_sub of the admin reviewing.
    """
    with pg_cursor() as cur:
        cur.execute(
            "SELECT user_key FROM dim_users WHERE auth0_sub = %s",
            (reviewed_by_sub,)
        )
        reviewer = cur.fetchone()
        if not reviewer:
            raise ValueError("Reviewer not found")

        cur.execute("""
            UPDATE applications
            SET status      = %s,
                reviewed_by = %s,
                review_note = %s,
                reviewed_at = NOW()
            WHERE application_id = %s
        """, (status, reviewer["user_key"], review_note, application_id))


def link_application_to_user(application_id, auth0_sub):
    """Link an approved application to a registered user."""
    with pg_cursor() as cur:
        cur.execute(
            "SELECT user_key FROM dim_users WHERE auth0_sub = %s", (auth0_sub,)
        )
        user = cur.fetchone()
        if not user:
            return
        cur.execute("""
            UPDATE applications
            SET user_key = %s
            WHERE application_id = %s
        """, (user["user_key"], application_id))


def get_pending_count():
    """Quick count for admin badge."""
    with pg_cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) AS count FROM applications WHERE status = 'pending'"
        )
        return cur.fetchone()["count"]


# ─── Author invite tokens ─────────────────────────────────────────────────────

def create_author_invite_token(application_id):
    """
    Generate a single-use author invite token tied to an approved application.
    Stored in Postgres. Expires in 30 days.
    """
    import secrets
    from datetime import datetime, timezone, timedelta
    token = secrets.token_urlsafe(32)
    with pg_cursor() as cur:
        cur.execute("""
            INSERT INTO author_invite_tokens
                (token, application_id, expires_at, used)
            VALUES (%s, %s, %s, FALSE)
        """, (
            token,
            application_id,
            datetime.now(timezone.utc) + timedelta(days=30),
        ))
    return token


def consume_author_invite_token(token):
    """
    Validate and consume an author invite token.
    Returns application_id or None if invalid/expired/used.
    """
    from datetime import datetime, timezone
    with pg_cursor() as cur:
        cur.execute("""
            SELECT token, application_id, expires_at, used
            FROM author_invite_tokens
            WHERE token = %s
        """, (token,))
        row = cur.fetchone()
        if not row:
            return None
        if row["used"]:
            return None
        if row["expires_at"] < datetime.now(timezone.utc):
            return None

        # Mark used
        cur.execute("""
            UPDATE author_invite_tokens SET used = TRUE, used_at = NOW()
            WHERE token = %s
        """, (token,))
        return row["application_id"]
