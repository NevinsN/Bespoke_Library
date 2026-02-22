# routes/get_books.py

from utils.auth import extract_user
from utils.response import ok, error
from services.novel_service import get_authorized_novels, get_manuscript_toc, get_full_chapter

def handle_get_novels(req):
    try:
        user = extract_user(req)
        data = get_authorized_novels(user)
        return ok(data)
    except Exception as e:
        return error(str(e))

def handle_get_chapters(req):
    m_id = req.params.get('manuscript_id')
    if not m_id:
        return error("Missing manuscript_id parameter", 400) #
    
    chapters = get_manuscript_toc(m_id)
    return ok(chapters)

def handle_get_content(req):
    ch_id = req.params.get('id')
    if not ch_id: return error("Missing ID", 400)
    
    chapter = get_full_chapter(ch_id)
    return ok(chapter) if chapter else error("Not Found", 404)