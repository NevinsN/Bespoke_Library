from .db import db, serialize, serialize_list
from datetime import datetime, timedelta


def record_ping(source, db_latency_ms, api_latency_ms, status="ok", error=None):
    """
    Record a health ping. Called by the Health endpoint on every request.
    source: 'keep-warm' | 'dashboard' | 'manual'
    """
    db["health_pings"].insert_one({
        "timestamp":      datetime.utcnow(),
        "source":         source,
        "status":         status,
        "db_latency_ms":  db_latency_ms,
        "api_latency_ms": api_latency_ms,
        "error":          error,
    })


def get_recent_pings(hours=24, limit=500):
    """Fetch recent pings for the dashboard."""
    since = datetime.utcnow() - timedelta(hours=hours)
    results = list(db["health_pings"].find({"timestamp": {"$gt": since}}, {"_id": 0}))
    return sorted(results, key=lambda p: p.get("timestamp", 0), reverse=True)[:limit]


def get_uptime_summary(hours=24):
    """
    Returns uptime percentage and average latencies over a window.
    Designed to be extended with more metrics later.
    """
    since = datetime.utcnow() - timedelta(hours=hours)
    pings = list(db["health_pings"].find({"timestamp": {"$gt": since}}))

    if not pings:
        return {"uptime_pct": None, "avg_db_ms": None, "avg_api_ms": None, "total_pings": 0}

    ok_pings  = [p for p in pings if p["status"] == "ok"]
    uptime    = round(len(ok_pings) / len(pings) * 100, 2)
    avg_db    = round(sum(p["db_latency_ms"]  for p in ok_pings) / max(len(ok_pings), 1))
    avg_api   = round(sum(p["api_latency_ms"] for p in ok_pings) / max(len(ok_pings), 1))

    return {
        "uptime_pct":   uptime,
        "avg_db_ms":    avg_db,
        "avg_api_ms":   avg_api,
        "total_pings":  len(pings),
        "ok_pings":     len(ok_pings),
        "window_hours": hours,
    }
