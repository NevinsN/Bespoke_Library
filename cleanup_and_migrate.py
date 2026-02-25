"""
cleanup_and_migrate.py

1. Removes bad access/manuscript/draft/series documents created by migrate_access.py
2. Runs the correct migration from the original migrate.py logic

Run with:
    COSMOS_CONNECTION_STRING="..." ADMIN_EMAIL="you@example.com" python cleanup_and_migrate.py
    DRY_RUN=1 ... python cleanup_and_migrate.py
"""

from pymongo import MongoClient
from bson.objectid import ObjectId
from datetime import datetime
import os

CONN     = os.environ["COSMOS_CONNECTION_STRING"]
ADMIN    = os.environ.get("ADMIN_EMAIL", "")
DRY_RUN  = os.environ.get("DRY_RUN", "").lower() in ("1", "true", "yes")

client = MongoClient(CONN)
db     = client.get_database("bespoke")

def log(msg): print(f"{'[DRY RUN] ' if DRY_RUN else ''}{msg}")
def do(collection, op, *args, **kwargs):
    if DRY_RUN:
        log(f"  Would {op} in '{collection}'")
        return None
    return getattr(db[collection], op)(*args, **kwargs)


# ─── Step 1: Clean up bad data from migrate_access.py ─────────────────────────
log("=== Step 1: Cleaning up bad migration data ===")

# Remove access grants pointing to slug IDs (not ObjectIds)
bad_access = list(db["access"].find({"scope_id": "slick-the-sly-b1-d2"}))
log(f"Found {len(bad_access)} bad access grant(s) to remove")
for doc in bad_access:
    log(f"  Removing access: {doc.get('email')} → {doc.get('scope_id')}")
    do("access", "delete_one", {"_id": doc["_id"]})

# Remove manuscripts created by bad migration (they have _migration_old_id as a novel _id string)
# Good manuscripts have _migration_old_id matching a novels manuscript_id slug
bad_manuscripts = list(db["manuscripts"].find({"_migration_old_id": {"$exists": True}}))
log(f"Found {len(bad_manuscripts)} manuscript(s) from previous migration to remove")
for doc in bad_manuscripts:
    log(f"  Removing manuscript: {doc.get('display_name')} ({doc.get('_migration_old_id')})")
    mid = str(doc["_id"])
    do("manuscripts", "delete_one", {"_id": doc["_id"]})
    # Remove associated drafts and chapters
    drafts = list(db["drafts"].find({"manuscript_id": mid}))
    for d in drafts:
        did = str(d["_id"])
        do("chapters", "delete_many", {"draft_id": did})
        do("drafts", "delete_one", {"_id": d["_id"]})
        log(f"    Removed draft and its chapters: {d.get('name', did)}")

# Remove series created by bad migration
bad_series = list(db["series"].find({"_migration_old_id": {"$exists": True}}))
log(f"Found {len(bad_series)} series from previous migration to remove")
for doc in bad_series:
    log(f"  Removing series: {doc.get('name')}")
    do("series", "delete_one", {"_id": doc["_id"]})
    # Remove owner access grants for this series
    do("access", "delete_many", {"scope_type": "series", "scope_id": str(doc["_id"]), "granted_by": "migration"})


# ─── Step 2: Run correct migration ────────────────────────────────────────────
log("\n=== Step 2: Running correct migration from novels collection ===")

old_docs = list(db["novels"].find({}))
log(f"Found {len(old_docs)} documents in novels collection")

series_map     = {}
manuscript_map = {}
draft_map      = {}
migrated = skipped = 0

for doc in old_docs:
    old_man_id   = doc.get("manuscript_id", "unknown")
    draft_name   = doc.get("draft_name", "Draft One")
    display_name = doc.get("manuscript_display_name") or doc.get("display_name") or old_man_id
    series_name  = doc.get("series", "Standalone")
    book         = doc.get("book", display_name)
    owner        = doc.get("owner", ADMIN)

    # ── Series ────────────────────────────────────────────────────────────────
    if series_name not in series_map:
        existing = db["series"].find_one({"_migration_name": series_name})
        if existing:
            series_map[series_name] = existing["_id"]
        else:
            if not DRY_RUN:
                res = db["series"].insert_one({
                    "name": series_name,
                    "owner": owner,
                    "created_at": datetime.utcnow(),
                    "_migration_name": series_name,
                })
                series_map[series_name] = res.inserted_id
                log(f"  Created series: {series_name}")
            else:
                log(f"  Would create series: {series_name}")
                series_map[series_name] = "dry-run-id"

    series_id = series_map[series_name]

    # ── Manuscript ────────────────────────────────────────────────────────────
    if old_man_id not in manuscript_map:
        existing = db["manuscripts"].find_one({"_migration_old_id": old_man_id})
        if existing:
            manuscript_map[old_man_id] = existing["_id"]
        else:
            if not DRY_RUN:
                res = db["manuscripts"].insert_one({
                    "series_id":    str(series_id),
                    "book":         book,
                    "display_name": display_name,
                    "owner":        owner,
                    "created_at":   datetime.utcnow(),
                    "_migration_old_id": old_man_id,
                })
                manuscript_map[old_man_id] = res.inserted_id
                log(f"  Created manuscript: {display_name}")

                # Owner access
                for scope_type, scope_id in [("series", str(series_id)), ("manuscript", str(res.inserted_id))]:
                    db["access"].update_one(
                        {"email": owner, "scope_type": scope_type, "scope_id": scope_id},
                        {"$setOnInsert": {
                            "email": owner, "scope_type": scope_type,
                            "scope_id": scope_id, "role": "owner",
                            "granted_by": "migration", "granted_at": datetime.utcnow(),
                        }},
                        upsert=True
                    )

                # Reader access from old users collection
                for user_doc in db["users"].find({"authorized_manuscripts.id": old_man_id}):
                    reader_email = user_doc.get("email", "").lower()
                    if reader_email:
                        db["access"].update_one(
                            {"email": reader_email, "scope_type": "manuscript", "scope_id": str(res.inserted_id)},
                            {"$setOnInsert": {
                                "email": reader_email, "scope_type": "manuscript",
                                "scope_id": str(res.inserted_id), "role": "reader",
                                "granted_by": "migration", "granted_at": datetime.utcnow(),
                            }},
                            upsert=True
                        )
                        log(f"    Migrated reader: {reader_email}")
            else:
                log(f"  Would create manuscript: {display_name}")
                manuscript_map[old_man_id] = "dry-run-id"

    manuscript_id = manuscript_map[old_man_id]

    # ── Draft ─────────────────────────────────────────────────────────────────
    draft_key = (old_man_id, draft_name)
    if draft_key not in draft_map:
        existing = db["drafts"].find_one({"manuscript_id": str(manuscript_id), "name": draft_name})
        if existing:
            draft_map[draft_key] = existing["_id"]
        else:
            if not DRY_RUN:
                res = db["drafts"].insert_one({
                    "manuscript_id": str(manuscript_id),
                    "name":         draft_name,
                    "created_at":   datetime.utcnow(),
                })
                draft_map[draft_key] = res.inserted_id
                log(f"  Created draft: {draft_name}")
            else:
                log(f"  Would create draft: {draft_name}")
                draft_map[draft_key] = "dry-run-id"

    draft_id = draft_map[draft_key]

    # ── Chapter ───────────────────────────────────────────────────────────────
    if db["chapters"].find_one({"_migration_old_id": doc["_id"]}):
        skipped += 1
        continue

    if not DRY_RUN:
        content = doc.get("content", "")
        db["chapters"].insert_one({
            "draft_id":      str(draft_id),
            "manuscript_id": str(manuscript_id),
            "title":         doc.get("title", "Untitled"),
            "filename":      doc.get("filename", ""),
            "content":       content,
            "word_count":    doc.get("word_count") or len(content.split()),
            "order":         doc.get("order", 0),
            "date_added":    doc.get("date_added", datetime.utcnow()),
            "_migration_old_id": doc["_id"],
        })
    migrated += 1

log(f"\n✓ Chapters migrated: {migrated}, skipped: {skipped}")
log("The novels collection has NOT been deleted — verify data before dropping it.")
