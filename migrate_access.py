"""
migrate_access.py

One-time migration: reads legacy 'users' collection (authorized_manuscripts format)
and creates corresponding documents in the new 'access' collection.

Also reads legacy 'novels' collection and creates series/manuscripts/drafts/chapters
in the new schema if they don't already exist.

Run with:
    COSMOS_CONNECTION_STRING="..." python migrate_access.py
    DRY_RUN=1 COSMOS_CONNECTION_STRING="..." python migrate_access.py
"""

import os
import sys
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime

DRY_RUN = os.getenv("DRY_RUN", "0") == "1"
CONN    = os.environ["COSMOS_CONNECTION_STRING"]

client = MongoClient(CONN)
db     = client["bespoke"]

def log(msg):
    prefix = "[DRY RUN] " if DRY_RUN else ""
    print(f"{prefix}{msg}")

def insert(collection, doc):
    if DRY_RUN:
        log(f"  Would insert into '{collection}': {doc}")
        return "dry-run-id"
    result = db[collection].insert_one(doc)
    return result.inserted_id


# ─── Step 1: Migrate access grants from users collection ──────────────────────
log("\n=== Step 1: Migrating access grants from users collection ===")

users = list(db["users"].find({"authorized_manuscripts": {"$exists": True}}))
log(f"Found {len(users)} legacy user(s) with authorized_manuscripts")

for user in users:
    email = user.get("email", "").lower()
    if not email:
        log(f"  Skipping user with no email: {user.get('_id')}")
        continue

    for m in user.get("authorized_manuscripts", []):
        manuscript_id = m.get("id")
        if not manuscript_id:
            continue

        # Check if access grant already exists
        existing = db["access"].find_one({
            "email":      email,
            "scope_type": "manuscript",
            "scope_id":   manuscript_id,
        })

        if existing:
            log(f"  Access grant already exists for {email} → {manuscript_id}")
            continue

        doc = {
            "email":      email,
            "scope_type": "manuscript",
            "scope_id":   manuscript_id,
            "role":       "reader",
            "granted_at": datetime.utcnow(),
            "granted_by": "migration",
        }
        insert("access", doc)
        log(f"  Created reader grant: {email} → {manuscript_id}")


# ─── Step 2: Migrate novels → series/manuscripts/drafts/chapters ──────────────
log("\n=== Step 2: Migrating novels collection ===")

novels = list(db["novels"].find({})) if "novels" in db.list_collection_names() else []
log(f"Found {len(novels)} novel(s) in legacy collection")

for novel in novels:
    title        = novel.get("title") or novel.get("name") or "Untitled"
    owner        = novel.get("owner", "").lower()
    old_id       = str(novel.get("_id"))
    display_name = novel.get("display_name") or title

    log(f"\n  Processing novel: '{title}' (old id: {old_id})")

    # ── Series ──
    series = db["series"].find_one({"name": title})
    if series:
        series_id = str(series["_id"])
        log(f"    Series already exists: {series_id}")
    else:
        series_doc = {
            "name":       title,
            "owner":      owner,
            "created_at": datetime.utcnow(),
            "_migration_old_id": old_id,
        }
        series_id = str(insert("series", series_doc))
        log(f"    Created series: {series_id}")

        # Owner access grant
        if owner:
            existing = db["access"].find_one({
                "email": owner, "scope_type": "series", "scope_id": series_id
            })
            if not existing:
                insert("access", {
                    "email":      owner,
                    "scope_type": "series",
                    "scope_id":   series_id,
                    "role":       "owner",
                    "granted_at": datetime.utcnow(),
                    "granted_by": "migration",
                })
                log(f"    Created owner grant for {owner}")

    # ── Manuscript ──
    manuscript = db["manuscripts"].find_one({"_migration_old_id": old_id})
    if manuscript:
        manuscript_id = str(manuscript["_id"])
        log(f"    Manuscript already exists: {manuscript_id}")
    else:
        ms_doc = {
            "series_id":    series_id,
            "display_name": display_name,
            "owner":        owner,
            "created_at":   datetime.utcnow(),
            "_migration_old_id": old_id,
        }
        manuscript_id = str(insert("manuscripts", ms_doc))
        log(f"    Created manuscript: {manuscript_id}")

    # ── Draft ──
    draft = db["drafts"].find_one({"manuscript_id": manuscript_id})
    if draft:
        draft_id = str(draft["_id"])
        log(f"    Draft already exists: {draft_id}")
    else:
        word_count = novel.get("word_count", 0)
        draft_doc  = {
            "manuscript_id": manuscript_id,
            "display_name":  "Draft 1",
            "word_count":    word_count,
            "created_at":    datetime.utcnow(),
            "_migration_old_id": old_id,
        }
        draft_id = str(insert("drafts", draft_doc))
        log(f"    Created draft: {draft_id}")

    # ── Chapters ──
    old_chapters = list(db["chapters"].find({"novel_id": old_id}))
    if not old_chapters:
        # Try alternate field names from old schema
        old_chapters = list(db["chapters"].find({
            "$or": [
                {"novel_id": old_id},
                {"manuscript_id": old_id},
            ]
        }))

    log(f"    Found {len(old_chapters)} chapter(s) to migrate")

    for i, ch in enumerate(sorted(old_chapters, key=lambda x: x.get("order", i))):
        ch_old_id = str(ch["_id"])
        existing_ch = db["chapters"].find_one({"_migration_old_id": ch_old_id})
        if existing_ch:
            log(f"      Chapter already migrated: {ch.get('title')}")
            continue

        new_ch = {
            "draft_id":     draft_id,
            "manuscript_id": manuscript_id,
            "title":        ch.get("title") or f"Chapter {i+1}",
            "content":      ch.get("content") or ch.get("text") or "",
            "order":        ch.get("order", i + 1),
            "created_at":   datetime.utcnow(),
            "_migration_old_id": ch_old_id,
        }
        insert("chapters", new_ch)
        log(f"      Migrated chapter: {new_ch['title']}")


log("\n=== Migration complete ===")
if DRY_RUN:
    log("DRY RUN — no changes were made. Re-run without DRY_RUN=1 to apply.")
