"""
pg_audit_repo.py — Immutable admin action audit log in PostgreSQL.
Replaces mongo audit_repo.
"""

from .pg import pg_cursor


def log_action(admin_sub, action, target_type=None, target_id=None, detail=None):
    """
    Record an admin action.
    admin_sub:   auth0_sub of the admin taking the action
    action:      string e.g. 'suspend_user', 'approve_application'
    target_type: 'user' | 'manuscript' | 'draft' | 'application' | 'invite'
    target_id:   string ID of the affected resource
    detail:      dict with any extra context — stored as JSONB
    """
    import json
    with pg_cursor() as cur:
        # Resolve admin user_key
        cur.execute(
            "SELECT user_key FROM dim_users WHERE auth0_sub = %s", (admin_sub,)
        )
        row = cur.fetchone()
        if not row:
            return  # Admin not in DB yet — skip rather than crash
        cur.execute("""
            INSERT INTO audit_log (
                admin_key, action, target_type, target_id, detail
            ) VALUES (%s, %s, %s, %s, %s)
        """, (
            row["user_key"],
            action,
            target_type,
            str(target_id) if target_id else None,
            json.dumps(detail) if detail else None,
        ))


def get_audit_log(limit=200, admin_sub=None, action=None):
    """Fetch audit log entries, most recent first."""
    conditions = []
    params     = []

    if admin_sub:
        conditions.append("u.auth0_sub = %s")
        params.append(admin_sub)
    if action:
        conditions.append("al.action = %s")
        params.append(action)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    params.append(limit)

    with pg_cursor() as cur:
        cur.execute(f"""
            SELECT al.log_id, al.action, al.target_type, al.target_id,
                   al.detail, al.created_at,
                   u.username, u.auth0_sub
            FROM audit_log al
            JOIN dim_users u ON u.user_key = al.admin_key
            {where}
            ORDER BY al.created_at DESC
            LIMIT %s
        """, params)
        return [dict(r) for r in cur.fetchall()]
