"""
migrate.py — One-time migration to the 5-collection schema.

Old: single 'novels' collection (chapters with metadata on every row)
New: series / manuscripts / drafts / chapters / access / users

Run with:
  COSMOS_CONNECTION_STRING="..." ADMIN_EMAIL="you@example.com" python migrate.py

Safe to re-run — all inserts use _migration_old_id to skip already-migrated docs.
The old 'novels' collection is NOT dropped automatically — verify first.
"""

from pymongo import MongoClient
from bson.objectid import ObjectId
from datetime import datetime
import os

CONN = os.environ.get("COSMOS_CONNECTION_STRING")
ADMIN = os.environ.get("ADMIN_EMAIL", "")
if not CONN:
    raise RuntimeError("COSMOS_CONNECTION_STRING not set")

DRY_RUN = os.environ.get("DRY_RUN", "").lower() in ("1", "true", "yes")
if DRY_RUN:
    print("⚠ DRY RUN MODE — no writes will be made.\n")

client = MongoClient(CONN)
db = client.get_database("bespoke")

old_docs = list(db["novels"].find({}))
print(f"Found {len(old_docs)} documents in old 'novels' collection.\n")

series_map = {}      # series name string → new ObjectId
manuscript_map = {}  # old manuscript_id string → new ObjectId
draft_map = {}       # (old manuscript_id, draft_name) → new ObjectId
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
            if DRY_RUN: print(f"  [dry-run] Would create series: {series_name}"); series_map[series_name] = "dry-run-id"; continue
    res = db["series"].insert_one({
                "name": series_name,
                "owner": owner,
                "created_at": datetime.utcnow(),
                "_migration_name": series_name,
            })
            series_map[series_name] = res.inserted_id
            print(f"  Created series: {series_name}")

    series_id = series_map[series_name]

    # ── Manuscript ────────────────────────────────────────────────────────────
    if old_man_id not in manuscript_map:
        existing = db["manuscripts"].find_one({"_migration_old_id": old_man_id})
        if existing:
            manuscript_map[old_man_id] = existing["_id"]
        else:
            res = db["manuscripts"].insert_one({
                "series_id": str(series_id),
                "book": book,
                "display_name": display_name,
                "owner": owner,
                "created_at": datetime.utcnow(),
                "_migration_old_id": old_man_id,
            })
            manuscript_map[old_man_id] = res.inserted_id
            print(f"  Created manuscript: {display_name}")

            # Grant owner access on series and manuscript
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

            # Migrate authorized_manuscripts readers from old user records
            for user_doc in db["users"].find({"authorized_manuscripts.id": old_man_id}):
                reader_email = user_doc.get("email")
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
                    print(f"    Migrated reader access: {reader_email}")

    manuscript_id = manuscript_map[old_man_id]

    # ── Draft ─────────────────────────────────────────────────────────────────
    draft_key = (old_man_id, draft_name)
    if draft_key not in draft_map:
        existing = db["drafts"].find_one({
            "manuscript_id": str(manuscript_id), "name": draft_name
        })
        if existing:
            draft_map[draft_key] = existing["_id"]
        else:
            res = db["drafts"].insert_one({
                "manuscript_id": str(manuscript_id),
                "name": draft_name,
                "created_at": datetime.utcnow(),
            })
            draft_map[draft_key] = res.inserted_id
            print(f"  Created draft: {draft_name}")

    draft_id = draft_map[draft_key]

    # ── Chapter ───────────────────────────────────────────────────────────────
    if db["chapters"].find_one({"_migration_old_id": doc["_id"]}):
        skipped += 1
        continue

    content = doc.get("content", "")
    db["chapters"].insert_one({
        "draft_id": str(draft_id),
        "manuscript_id": str(manuscript_id),
        "title": doc.get("title", "Untitled"),
        "filename": doc.get("filename", ""),
        "content": content,
        "word_count": doc.get("word_count") or len(content.split()),
        "order": doc.get("order", 0),
        "date_added": doc.get("date_added", datetime.utcnow()),
        "_migration_old_id": doc["_id"],
    })
    migrated += 1

print(f"\n✓ Migrated: {migrated} chapters. Skipped (already done): {skipped}.")
print("The old 'novels' collection has NOT been deleted.")
print("Once you've verified the migration, drop it with: db.novels.drop()")
