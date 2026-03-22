"""
pg_user_repo.py — User management in PostgreSQL.
Replaces mongo user_repo for all user reads/writes.
"""

from .pg import pg_cursor
from datetime import datetime, timezone


def upsert_user(auth0_sub, username=None, is_admin=False):
    """
    Create or update a user record.
    Returns the user_key.
    """
    now = datetime.now(timezone.utc)
    with pg_cursor() as cur:
        cur.execute("""
            INSERT INTO dim_users (auth0_sub, username, is_admin, registered_at, updated_at)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (auth0_sub) DO UPDATE SET
                updated_at = EXCLUDED.updated_at,
                is_admin   = EXCLUDED.is_admin
            RETURNING user_key, (xmax = 0) AS inserted
        """, (auth0_sub, username, is_admin, now, now))
        row = cur.fetchone()
        user_key = row["user_key"]

        if row["inserted"]:
            try:
                from repositories.pg_event_repo import record_event
                record_event("user_registered", user_id=auth0_sub)
            except Exception:
                pass

    return user_key


def get_user_by_sub(auth0_sub):
    """Fetch a user by auth0 sub. Returns dict or None."""
    with pg_cursor() as cur:
        cur.execute("""
                        SELECT user_key, auth0_sub, username, is_admin, is_author,
                   suspended, registered_at, updated_at
            FROM dim_users
            WHERE auth0_sub = %s
        """, (auth0_sub,))
        row = cur.fetchone()
        return dict(row) if row else None


def get_user_by_username(username):
    """Fetch a user by username. Returns dict or None."""
    with pg_cursor() as cur:
        cur.execute("""
                        SELECT user_key, auth0_sub, username, is_admin, is_author,
                   suspended, registered_at, updated_at
            FROM dim_users
            WHERE username = %s
        """, (username,))
        row = cur.fetchone()
        return dict(row) if row else None


def set_username(auth0_sub, new_username):
    """
    Update username and record the change in username_history.
    Returns True on success, False if username taken.
    """
    with pg_cursor() as cur:
        # Check availability
        cur.execute(
            "SELECT user_key FROM dim_users WHERE username = %s AND auth0_sub != %s",
            (new_username, auth0_sub)
        )
        if cur.fetchone():
            return False

        # Get current username for history
        cur.execute(
            "SELECT user_key, username FROM dim_users WHERE auth0_sub = %s",
            (auth0_sub,)
        )
        user = cur.fetchone()
        if not user:
            return False

        old_username = user["username"]

        # Update
        cur.execute("""
            UPDATE dim_users
            SET username = %s, updated_at = NOW()
            WHERE auth0_sub = %s
        """, (new_username, auth0_sub))

        # Record history if it was a change
        if old_username and old_username != new_username:
            cur.execute("""
                INSERT INTO username_history (user_key, old_username, new_username)
                VALUES (%s, %s, %s)
            """, (user["user_key"], old_username, new_username))

        return True


def get_all_users():
    """Full user list for admin panel."""
    with pg_cursor() as cur:
        cur.execute("""
                        SELECT user_key, auth0_sub, username, is_admin, is_author,
                   suspended, registered_at, updated_at
            FROM dim_users
            ORDER BY registered_at DESC
        """)
        return [dict(r) for r in cur.fetchall()]


def set_suspended(auth0_sub, suspended):
    """Suspend or unsuspend a user."""
    with pg_cursor() as cur:
        cur.execute("""
            UPDATE dim_users
            SET suspended = %s, updated_at = NOW()
            WHERE auth0_sub = %s
        """, (suspended, auth0_sub))


def check_username_available(username):
    """Returns True if username is available."""
    with pg_cursor() as cur:
        cur.execute(
            "SELECT 1 FROM dim_users WHERE username = %s", (username,)
        )
        return cur.fetchone() is None


def set_is_author(auth0_sub, is_author=True):
    """Grant or revoke author status."""
    with pg_cursor() as cur:
        cur.execute("""
            UPDATE dim_users
            SET is_author = %s, updated_at = NOW()
            WHERE auth0_sub = %s
        """, (is_author, auth0_sub))


def get_user_by_email_decrypted(email):
    """
    Find a user whose decrypted email matches.
    Used during application approval to link applicant to account.
    Returns user dict or None.
    """
    from repositories.user_repo import get_decrypted_email
    from repositories.db import db

    # Get all users from Mongo that have email_enc
    users_with_email = list(db["users"].find({"email_enc": {"$exists": True}}))
    for u in users_with_email:
        subs = u.get("auth0_subs") or []
        if not subs:
            continue
        decrypted = get_decrypted_email(subs[0])
        if decrypted and decrypted.lower() == email.lower():
            # Found match — return their pg_user record
            return get_user_by_sub(subs[0])
    return None
