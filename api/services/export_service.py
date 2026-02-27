"""
export_service.py
Assembles a draft's chapters into a downloadable DOCX manuscript.
Authors get all chapters. Readers get published only.
"""

import re
import io
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

from repositories.chapter_repo import get_chapters_for_draft
from repositories.draft_repo import get_draft_by_id
from repositories.manuscript_repo import get_manuscript_by_id
from services.permission_service import can_write


def _strip_markdown(text):
    """Convert markdown to plain text suitable for DOCX."""
    if not text:
        return ""

    # Strip footnote definitions (keep inline refs as plain numbers)
    text = re.sub(r'^\[\^[^\]]+\]:\s*.+$', '', text, flags=re.MULTILINE)

    # Inline footnote refs [^1] → (1)
    text = re.sub(r'\[\^([^\]]+)\]', r'(\1)', text)

    # Headings
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)

    # Bold/italic
    text = re.sub(r'\*\*\*(.+?)\*\*\*', r'\1', text)
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    text = re.sub(r'___(.+?)___', r'\1', text)
    text = re.sub(r'__(.+?)__', r'\1', text)
    text = re.sub(r'_(.+?)_', r'\1', text)

    # Links [text](url) → text
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)

    # Horizontal rules
    text = re.sub(r'^[-*_]{3,}\s*$', '', text, flags=re.MULTILINE)

    # Clean up excess blank lines
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


def build_docx(user_email, draft_id):
    """
    Build and return a DOCX BytesIO for the given draft.
    Returns (bytes_io, filename) or raises on error.
    """
    draft = get_draft_by_id(draft_id)
    if not draft:
        raise ValueError("Draft not found")

    manuscript = get_manuscript_by_id(draft["manuscript_id"])
    if not manuscript:
        raise ValueError("Manuscript not found")

    is_author = can_write(user_email, manuscript_id=draft["manuscript_id"])

    chapters = get_chapters_for_draft(draft_id, include_content=True)
    if not is_author:
        chapters = [c for c in chapters if c.get("status", "published") == "published"]

    if not chapters:
        raise ValueError("No chapters available to export")

    # ── Build document ───────────────────────────────────────────
    doc = Document()

    # Page setup — US Letter, 1" margins
    section = doc.sections[0]
    section.page_width  = Inches(8.5)
    section.page_height = Inches(11)
    section.left_margin = section.right_margin = Inches(1.25)
    section.top_margin  = section.bottom_margin = Inches(1)

    # ── Styles ───────────────────────────────────────────────────
    style = doc.styles['Normal']
    style.font.name = 'Georgia'
    style.font.size = Pt(12)

    # Title page
    title_para = doc.add_paragraph()
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title_para.add_run(manuscript.get("display_name", "Untitled"))
    title_run.font.size = Pt(24)
    title_run.font.bold = True

    subtitle_para = doc.add_paragraph()
    subtitle_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_run = subtitle_para.add_run(draft.get("name", ""))
    sub_run.font.size = Pt(14)
    sub_run.font.color.rgb = RGBColor(0x66, 0x66, 0x66)

    doc.add_paragraph()  # spacer

    # ── Chapters ─────────────────────────────────────────────────
    for i, chapter in enumerate(chapters):
        if i > 0:
            doc.add_page_break()

        title = chapter.get("title", f"Chapter {i + 1}")
        content = chapter.get("content", "")

        # Chapter heading
        heading = doc.add_paragraph()
        heading.alignment = WD_ALIGN_PARAGRAPH.CENTER
        h_run = heading.add_run(title)
        h_run.font.size = Pt(16)
        h_run.font.bold = True

        doc.add_paragraph()  # space after heading

        # Body — split into paragraphs
        plain = _strip_markdown(content)
        paragraphs = [p.strip() for p in plain.split('\n\n') if p.strip()]

        for para_text in paragraphs:
            # Scene breaks (*** or —)
            if re.match(r'^[\*\-#~]+$', para_text) or para_text == '—':
                sep = doc.add_paragraph('* * *')
                sep.alignment = WD_ALIGN_PARAGRAPH.CENTER
                continue

            p = doc.add_paragraph()
            p.paragraph_format.first_line_indent = Inches(0.3)
            p.paragraph_format.space_after = Pt(0)

            # Handle inline italics (*text*) surviving strip
            # Split on remaining * markers and alternate italic
            parts = re.split(r'(\*[^*]+\*)', para_text)
            for part in parts:
                if part.startswith('*') and part.endswith('*') and len(part) > 2:
                    run = p.add_run(part[1:-1])
                    run.italic = True
                else:
                    p.add_run(part)

    # ── Save to buffer ───────────────────────────────────────────
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)

    safe_title = re.sub(r'[^\w\s-]', '', manuscript.get("display_name", "manuscript")).strip()
    safe_draft = re.sub(r'[^\w\s-]', '', draft.get("name", "draft")).strip()
    filename = f"{safe_title} - {safe_draft}.docx".replace(' ', '_')

    return buf, filename
