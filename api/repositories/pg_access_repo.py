"""
pg_access_repo.py — Access grants in PostgreSQL.
Replaces mongo access_repo.
"""

from .pg import pg_cursor


def grant_access(auth0_sub, scope_type, scope_id, role, granted_by_sub=None):
    """
    Grant a user access to a scope.
    Upserts — if grant already exists, updates the role.
    """
    with pg_cursor() as cur:
        # Resolve user_key
        cur.execute(
            "SELECT user_key FROM dim_users WHERE auth0_sub = %s", (auth0_sub,)
        )
        user = cur.fetchone()
        if not user:
            raise ValueError(f"User not found: {auth0_sub}")

        # Resolve granter key
        granter_key = None
        if granted_by_sub:
            cur.execute(
                "SELECT user_key FROM dim_users WHERE auth0_sub = %s",
                (granted_by_sub,)
            )
            granter = cur.fetchone()
            granter_key = granter["user_key"] if granter else None

        cur.execute("""
            INSERT INTO access_grants (
                user_key, scope_type, mongo_scope_id, role, granted_by
            ) VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (user_key, scope_type, mongo_scope_id)
            DO UPDATE SET
                role       = EXCLUDED.role,
                granted_by = EXCLUDED.granted_by,
                granted_at = NOW(),
                revoked_at = NULL
        """, (user["user_key"], scope_type, str(scope_id), role, granter_key))


def revoke_access(auth0_sub, scope_type, scope_id):
    """Soft-delete a grant by setting revoked_at."""
    with pg_cursor() as cur:
        cur.execute("""
            UPDATE access_grants ag
            SET revoked_at = NOW()
            FROM dim_users u
            WHERE u.user_key        = ag.user_key
              AND u.auth0_sub       = %s
              AND ag.scope_type     = %s
              AND ag.mongo_scope_id = %s
              AND ag.revoked_at     IS NULL
        """, (auth0_sub, scope_type, str(scope_id)))


def get_grants_for_user(auth0_sub):
    """All active grants for a user."""
    with pg_cursor() as cur:
        cur.execute("""
            SELECT ag.grant_id, ag.scope_type, ag.mongo_scope_id,
                   ag.role, ag.granted_at
            FROM access_grants ag
            JOIN dim_users u ON u.user_key = ag.user_key
            WHERE u.auth0_sub   = %s
              AND ag.revoked_at IS NULL
        """, (auth0_sub,))
        return [dict(r) for r in cur.fetchall()]


def get_grants_for_scope(scope_type, scope_id):
    """All active grants for a scope."""
    with pg_cursor() as cur:
        cur.execute("""
            SELECT ag.grant_id, ag.role, ag.granted_at,
                   u.auth0_sub, u.username
            FROM access_grants ag
            JOIN dim_users u ON u.user_key = ag.user_key
            WHERE ag.scope_type     = %s
              AND ag.mongo_scope_id = %s
              AND ag.revoked_at     IS NULL
        """, (scope_type, str(scope_id)))
        return [dict(r) for r in cur.fetchall()]


def get_user_role_for_scope(auth0_sub, scope_type, scope_id):
    """Returns role string or None if no active grant."""
    with pg_cursor() as cur:
        cur.execute("""
            SELECT ag.role
            FROM access_grants ag
            JOIN dim_users u ON u.user_key = ag.user_key
            WHERE u.auth0_sub       = %s
              AND ag.scope_type     = %s
              AND ag.mongo_scope_id = %s
              AND ag.revoked_at     IS NULL
        """, (auth0_sub, scope_type, str(scope_id)))
        row = cur.fetchone()
        return row["role"] if row else None


def get_scope_ids_for_user(auth0_sub, scope_type, role=None):
    """Returns list of mongo_scope_ids the user has access to."""
    with pg_cursor() as cur:
        query = """
            SELECT ag.mongo_scope_id
            FROM access_grants ag
            JOIN dim_users u ON u.user_key = ag.user_key
            WHERE u.auth0_sub   = %s
              AND ag.scope_type = %s
              AND ag.revoked_at IS NULL
        """
        params = [auth0_sub, scope_type]
        if role:
            query += " AND ag.role = %s"
            params.append(role)
        cur.execute(query, params)
        return [r["mongo_scope_id"] for r in cur.fetchall()]
