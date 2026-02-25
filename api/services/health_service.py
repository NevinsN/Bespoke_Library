"""
health_service.py

Checks system health, records ping history, and returns structured status.
Designed to grow — add new service checks here as the platform expands.
"""

import time
from datetime import datetime, timezone
from repositories.health_repo import record_ping, get_recent_pings, get_uptime_summary
from repositories.db import db

VERSION = "1.0.0"


def check_health(source="dashboard"):
    """
    Run all health checks, record the result, return structured status.
    """
    status  = "ok"
    error   = None
    db_ms   = None
    api_start = time.time()

    # ── Database check ──────────────────────────────────────────────────────
    try:
        db_start = time.time()
        db.command("ping")
        db_ms = round((time.time() - db_start) * 1000)
        db_status = "ok"
    except Exception as e:
        db_ms     = None
        db_status = "error"
        status    = "degraded"
        error     = str(e)

    api_ms = round((time.time() - api_start) * 1000)

    # ── Record this ping ─────────────────────────────────────────────────────
    try:
        record_ping(
            source=source,
            db_latency_ms=db_ms or 0,
            api_latency_ms=api_ms,
            status=status,
            error=error,
        )
    except Exception:
        pass  # Don't let recording failure break the health check itself

    # ── Summary for dashboard ────────────────────────────────────────────────
    try:
        summary_24h = get_uptime_summary(hours=24)
        summary_1h  = get_uptime_summary(hours=1)
    except Exception:
        summary_24h = {}
        summary_1h  = {}

    return {
        "status":    status,
        "version":   VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {
            "database": {
                "status":     db_status,
                "latency_ms": db_ms,
            },
            "api": {
                "status":     "ok",
                "latency_ms": api_ms,
            },
        },
        "uptime": {
            "last_1h":  summary_1h,
            "last_24h": summary_24h,
        },
        "source": source,
    }


def get_ping_history(hours=24):
    """Returns raw ping history for charting on the dashboard."""
    pings = get_recent_pings(hours=hours)
    # Convert datetimes to ISO strings for JSON serialisation
    for p in pings:
        if isinstance(p.get("timestamp"), datetime):
            p["timestamp"] = p["timestamp"].isoformat()
    return pings
