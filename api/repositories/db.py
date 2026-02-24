from pymongo import MongoClient, ASCENDING
import os

COSMOS_CONN = os.environ.get("COSMOS_CONNECTION_STRING")

client = MongoClient(COSMOS_CONN)
db = client.get_database("bespoke")


def ensure_indexes():
    """
    Create all indexes on cold start.
    Idempotent — safe to call every startup.
    """
    # series
    db["series"].create_index([("owner", ASCENDING)])
    db["series"].create_index([("name", ASCENDING)])

    # manuscripts
    db["manuscripts"].create_index([("series_id", ASCENDING)])
    db["manuscripts"].create_index([("owner", ASCENDING)])

    # drafts
    db["drafts"].create_index([("manuscript_id", ASCENDING)])

    # chapters
    db["chapters"].create_index([("draft_id", ASCENDING), ("order", ASCENDING)])
    db["chapters"].create_index([("manuscript_id", ASCENDING)])

    # access — the most query-critical collection
    db["access"].create_index([("email", ASCENDING), ("scope_type", ASCENDING)])
    db["access"].create_index([("scope_id", ASCENDING)])
    db["access"].create_index([("email", ASCENDING), ("role", ASCENDING)])

    # users
    db["users"].create_index([("email", ASCENDING)], unique=True)


ensure_indexes()
