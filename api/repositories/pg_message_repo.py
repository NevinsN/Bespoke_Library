"""
pg_message_repo.py — Support messages in PostgreSQL.
Replaces mongo message_repo.
"""

from .pg import pg_cursor


def create_message(auth0_sub, subject, body):
    """Submit a support message. Returns message_id."""
    with pg_cursor() as cur:
        cur.execute(
            "SELECT user_key FROM dim_users WHERE auth0_sub = %s", (auth0_sub,)
        )
        user = cur.fetchone()
        if not user:
            raise ValueError("User not found")

        cur.execute("""
            INSERT INTO messages (user_key, subject, body)
            VALUES (%s, %s, %s)
            RETURNING message_id
        """, (user["user_key"], subject.strip(), body.strip()))
        return cur.fetchone()["message_id"]


def get_messages(status=None):
    """List messages for admin panel."""
    with pg_cursor() as cur:
        if status:
            cur.execute("""
                SELECT m.*,
                       u.username    AS from_username,
                       u.auth0_sub   AS from_sub,
                       r.username    AS resolved_by_username
                FROM messages m
                JOIN dim_users u ON u.user_key = m.user_key
                LEFT JOIN dim_users r ON r.user_key = m.resolved_by
                WHERE m.status = %s
                ORDER BY m.created_at DESC
            """, (status,))
        else:
            cur.execute("""
                SELECT m.*,
                       u.username    AS from_username,
                       u.auth0_sub   AS from_sub,
                       r.username    AS resolved_by_username
                FROM messages m
                JOIN dim_users u ON u.user_key = m.user_key
                LEFT JOIN dim_users r ON r.user_key = m.resolved_by
                ORDER BY m.created_at DESC
            """)
        return [dict(r) for r in cur.fetchall()]


def get_message(message_id):
    """Fetch a single message."""
    with pg_cursor() as cur:
        cur.execute("""
            SELECT m.*,
                   u.username  AS from_username,
                   u.auth0_sub AS from_sub
            FROM messages m
            JOIN dim_users u ON u.user_key = m.user_key
            WHERE m.message_id = %s
        """, (message_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def resolve_message(message_id, admin_sub, admin_note=None):
    """Mark a message resolved."""
    with pg_cursor() as cur:
        cur.execute(
            "SELECT user_key FROM dim_users WHERE auth0_sub = %s", (admin_sub,)
        )
        admin = cur.fetchone()
        if not admin:
            raise ValueError("Admin not found")

        cur.execute("""
            UPDATE messages
            SET status      = 'resolved',
                resolved_by = %s,
                admin_note  = %s,
                resolved_at = NOW()
            WHERE message_id = %s
        """, (admin["user_key"], admin_note, message_id))


def mark_read(message_id):
    """Mark a message as read."""
    with pg_cursor() as cur:
        cur.execute("""
            UPDATE messages
            SET status = 'read'
            WHERE message_id = %s AND status = 'unread'
        """, (message_id,))


def get_unread_count():
    """Quick count for admin badge."""
    with pg_cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) AS count FROM messages WHERE status = 'unread'"
        )
        return cur.fetchone()["count"]
