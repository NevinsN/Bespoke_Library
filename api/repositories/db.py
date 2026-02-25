from pymongo import MongoClient, ASCENDING, DESCENDING
import os

COSMOS_CONN = os.environ.get("COSMOS_CONNECTION_STRING")

client = MongoClient(COSMOS_CONN)
db = client.get_database("bespoke")


def ensure_indexes():
    """
    Create all indexes on cold start.
    Idempotent — safe to call every startup.
    Each index is wrapped individually so one failure doesn't abort the rest.
    """
    # series
    try:
        db["series"].create_index([("owner", ASCENDING)])
    except Exception as e:
        print(f"Index warning: {e}")
    try:
        db["series"].create_index([("name", ASCENDING)])
    except Exception as e:
        print(f"Index warning: {e}")

    # manuscripts
    try:
        db["manuscripts"].create_index([("series_id", ASCENDING)])
    except Exception as e:
        print(f"Index warning: {e}")
    try:
        db["manuscripts"].create_index([("owner", ASCENDING)])
    except Exception as e:
        print(f"Index warning: {e}")

    # drafts
    try:
        db["drafts"].create_index([("manuscript_id", ASCENDING)])
    except Exception as e:
        print(f"Index warning: {e}")

    # chapters
    try:
        db["chapters"].create_index([("draft_id", ASCENDING), ("order", ASCENDING)])
    except Exception as e:
        print(f"Index warning: {e}")
    try:
        db["chapters"].create_index([("manuscript_id", ASCENDING)])
    except Exception as e:
        print(f"Index warning: {e}")

    # access
    try:
        db["access"].create_index([("email", ASCENDING), ("scope_type", ASCENDING)])
    except Exception as e:
        print(f"Index warning: {e}")
    try:
        db["access"].create_index([("scope_id", ASCENDING)])
    except Exception as e:
        print(f"Index warning: {e}")
    try:
        db["access"].create_index([("email", ASCENDING), ("role", ASCENDING)])
    except Exception as e:
        print(f"Index warning: {e}")

    # users
    try:
        db["users"].create_index([("email", ASCENDING)])
    except Exception as e:
        print(f"Index warning: {e}")

    # invites
    try:
        db["invites"].create_index([("token", ASCENDING)], unique=True)
    except Exception as e:
        print(f"Index warning: {e}")
    try:
        db["invites"].create_index([("scope_type", ASCENDING), ("scope_id", ASCENDING)])
    except Exception as e:
        print(f"Index warning: {e}")
    try:
        db["invites"].create_index([("expires_at", ASCENDING)])
    except Exception as e:
        print(f"Index warning: {e}")

    # chapters — composite indexes for filter+sort queries (required by Cosmos)
    try:
        db["chapters"].create_index([("draft_id", ASCENDING), ("order", ASCENDING)])
    except Exception as e:
        print(f"Index warning: {e}")
    try:
        db["chapters"].create_index([("draft_id", ASCENDING), ("order", DESCENDING)])
    except Exception as e:
        print(f"Index warning: {e}")

    # health_pings — time-series, queried by recency
    try:
        db["health_pings"].create_index([("timestamp", ASCENDING)])
    except Exception as e:
        print(f"Index warning: {e}")
    try:
        db["health_pings"].create_index([("source", ASCENDING), ("timestamp", ASCENDING)])
    except Exception as e:
        print(f"Index warning: {e}")


ensure_indexes()
