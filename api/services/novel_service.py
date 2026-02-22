# services/novel_service.py

import os
import logging
from repositories.novel_repo import get_aggregated_novels, get_user_record, get_chapters_by_manuscript, get_chapter_by_id, get_neighboring_chapter

ADMIN_EMAILS = [e.strip() for e in os.getenv("ADMIN_EMAIL", "").split(",") if e]

def get_authorized_novels(user):
    user_email = user.get('email')
    all_novels = get_aggregated_novels()
    
    # Admin bypass
    if user_email in ADMIN_EMAILS:
        return all_novels

    # Standard User filtering
    user_record = get_user_record(user_email)
    if not user_record:
        return []
    
    allowed_ids = [m['id'] for m in user_record.get('authorized_manuscripts', [])]
    return [n for n in all_novels if n['_id'] in allowed_ids]

def get_manuscript_toc(m_id):
    chapters = get_chapters_by_manuscript(m_id)
    for c in chapters: 
        c['_id'] = str(c['_id'])
    return chapters

def get_full_chapter(ch_id):
    chapter = get_chapter_by_id(ch_id)
    if not chapter:
        return None

    # Logic for navigation IDs
    prev_ch = get_neighboring_chapter(chapter['manuscript_id'], chapter['order'] - 1)
    next_ch = get_neighboring_chapter(chapter['manuscript_id'], chapter['order'] + 1)

    chapter['_id'] = str(chapter['_id'])
    chapter['prev_id'] = str(prev_ch.get('_id')) if prev_ch else None
    chapter['next_id'] = str(next_ch.get('_id')) if next_ch else None
    
    return chapter