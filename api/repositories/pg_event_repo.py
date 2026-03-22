"""
pg_event_repo.py — Analytics events in PostgreSQL.
"""

from .pg import pg_cursor
from datetime import datetime, timezone


def get_or_create_date_key(cur, dt):
    date_only = dt.date()
    cur.execute("SELECT date_key FROM dim_date WHERE full_date = %s", (date_only,))
    row = cur.fetchone()
    if row:
        return row["date_key"]
    cur.execute("""
        INSERT INTO dim_date (
            full_date, day_of_week, day_name, day_of_month,
            day_of_year, week_of_year, month_num, month_name,
            quarter, year, is_weekend
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (full_date) DO UPDATE SET full_date = EXCLUDED.full_date
        RETURNING date_key
    """, (
        date_only,
        dt.weekday(),
        dt.strftime("%A"),
        dt.day,
        dt.timetuple().tm_yday,
        dt.isocalendar()[1],
        dt.month,
        dt.strftime("%B"),
        (dt.month - 1) // 3 + 1,
        dt.year,
        dt.weekday() >= 5,
    ))
    return cur.fetchone()["date_key"]


def get_or_create_user_key(cur, auth0_sub):
    if not auth0_sub:
        return None
    cur.execute("SELECT user_key FROM dim_users WHERE auth0_sub = %s", (auth0_sub,))
    row = cur.fetchone()
    return row["user_key"] if row else None


def record_event(event_type, user_id=None, manuscript_id=None,
                 draft_id=None, chapter_id=None, meta=None):
    """Write a platform event to the fact table."""
    now = datetime.now(timezone.utc)
    try:
        with pg_cursor() as cur:
            date_key = get_or_create_date_key(cur, now)
            user_key = get_or_create_user_key(cur, user_id)
            cur.execute("""
                INSERT INTO fact_events (
                    user_key, date_key,
                    mongo_manuscript_id, mongo_draft_id, mongo_chapter_id,
                    event_type, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                user_key, date_key,
                str(manuscript_id) if manuscript_id else None,
                str(draft_id)      if draft_id      else None,
                str(chapter_id)    if chapter_id    else None,
                event_type,
                now,
            ))
    except Exception:
        pass  # Never let analytics break the main request


def has_completed_chapter(user_id, chapter_id):
    """
    Returns True if this user has already completed this chapter.
    Used to distinguish first reads from rereads.
    """
    try:
        with pg_cursor() as cur:
            cur.execute("""
                SELECT 1 FROM fact_events f
                JOIN dim_users u ON u.user_key = f.user_key
                WHERE u.auth0_sub          = %s
                  AND f.mongo_chapter_id   = %s
                  AND f.event_type         IN ('chapter_completed', 'chapter_reread')
                LIMIT 1
            """, (user_id, str(chapter_id)))
            return cur.fetchone() is not None
    except Exception:
        return False


def get_platform_stats(since_days=30):
    """Overview numbers for the admin panel."""
    with pg_cursor() as cur:
        cur.execute("""
            SELECT
                COUNT(*) FILTER (WHERE event_type = 'chapter_opened')      AS chapters_opened,
                COUNT(*) FILTER (WHERE event_type = 'chapter_completed')   AS chapters_completed,
                COUNT(*) FILTER (WHERE event_type = 'chapter_reread')      AS chapters_reread,
                COUNT(*) FILTER (WHERE event_type = 'chapter_navigation')  AS chapter_navigations,
                COUNT(*) FILTER (WHERE event_type = 'comment_created')     AS comments_created,
                COUNT(*) FILTER (WHERE event_type = 'invite_redeemed')     AS invites_redeemed,
                COUNT(*) FILTER (WHERE event_type = 'draft_published')     AS drafts_published,
                COUNT(*) FILTER (WHERE event_type = 'manuscript_created')  AS manuscripts_created,
                COUNT(*) FILTER (WHERE event_type = 'chapters_uploaded')   AS upload_sessions,
                COUNT(*) FILTER (WHERE event_type = 'user_registered')     AS new_registrations,
                COUNT(*) FILTER (WHERE event_type = 'session_start')       AS sessions,
                COUNT(DISTINCT user_key) FILTER (
                    WHERE event_type = 'chapter_opened'
                )                                                           AS active_readers
            FROM fact_events
            WHERE created_at >= NOW() - INTERVAL '%s days'
        """, (since_days,))
        stats = dict(cur.fetchone())

        cur.execute("SELECT COUNT(*) AS total_users FROM dim_users")
        stats["total_users"] = cur.fetchone()["total_users"]

        cur.execute("SELECT COUNT(*) AS total_manuscripts FROM manuscripts")
        try:
            stats["total_manuscripts"] = cur.fetchone()["total_manuscripts"]
        except Exception:
            stats["total_manuscripts"] = 0

        stats["period_days"] = since_days
        return stats


def get_events_by_day(event_type, since_days=30):
    """Daily counts for charting."""
    with pg_cursor() as cur:
        cur.execute("""
            SELECT
                d.full_date AS date,
                COUNT(*)    AS count
            FROM fact_events f
            JOIN dim_date d ON d.date_key = f.date_key
            WHERE f.event_type = %s
              AND f.created_at >= NOW() - INTERVAL '%s days'
            GROUP BY d.full_date
            ORDER BY d.full_date
        """, (event_type, since_days))
        return [dict(r) for r in cur.fetchall()]


def get_events(event_type=None, user_id=None, manuscript_id=None,
               draft_id=None, since_days=30, limit=500):
    """Filtered event log."""
    conditions = ["f.created_at >= NOW() - INTERVAL '%s days'"]
    params     = [since_days]

    if event_type:
        conditions.append("f.event_type = %s")
        params.append(event_type)
    if manuscript_id:
        conditions.append("f.mongo_manuscript_id = %s")
        params.append(str(manuscript_id))
    if draft_id:
        conditions.append("f.mongo_draft_id = %s")
        params.append(str(draft_id))
    if user_id:
        conditions.append("u.auth0_sub = %s")
        params.append(user_id)

    where = " AND ".join(conditions)
    params.append(limit)

    with pg_cursor() as cur:
        cur.execute(f"""
            SELECT f.*, u.username, u.auth0_sub,
                   d.full_date AS event_date
            FROM fact_events f
            LEFT JOIN dim_users u ON u.user_key = f.user_key
            LEFT JOIN dim_date  d ON d.date_key  = f.date_key
            WHERE {where}
            ORDER BY f.created_at DESC
            LIMIT %s
        """, params)
        return [dict(r) for r in cur.fetchall()]


def get_completion_rate_by_chapter(draft_id, since_days=90):
    """
    Per-chapter: opens vs completions vs rereads.
    Useful for identifying drop-off points.
    """
    with pg_cursor() as cur:
        cur.execute("""
            SELECT
                f.mongo_chapter_id                                          AS chapter_id,
                COUNT(*) FILTER (WHERE event_type = 'chapter_opened')      AS opens,
                COUNT(*) FILTER (WHERE event_type = 'chapter_completed')   AS completions,
                COUNT(*) FILTER (WHERE event_type = 'chapter_reread')      AS rereads,
                COUNT(DISTINCT f.user_key) FILTER (
                    WHERE event_type = 'chapter_opened'
                )                                                           AS unique_readers
            FROM fact_events f
            WHERE f.mongo_draft_id = %s
              AND f.created_at >= NOW() - INTERVAL '%s days'
              AND f.mongo_chapter_id IS NOT NULL
            GROUP BY f.mongo_chapter_id
            ORDER BY opens DESC
        """, (str(draft_id), since_days))
        return [dict(r) for r in cur.fetchall()]
