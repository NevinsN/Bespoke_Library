/**
 * commentPanel.js
 * Persistent comment button in the reader + slide-in panel.
 *
 * - A 💬 button sits fixed in the reader chrome
 * - Clicking opens a panel
 * - If the reader has text selected, the panel shows it and notes
 *   the comment will reference that passage
 * - Category selection + free text note
 * - Submit → panel closes, selection cleared, reader sees nothing after
 */

import { COMMENT_CATEGORIES, createComment } from '../services/commentService.js';

let panel       = null;
let triggerBtn  = null;
let chapterId   = null;
let draftId     = null;
let pendingSelection = null; // { text, paragraphIndex } | null

export function initCommentPanel(chapId, drftId) {
  chapterId = chapId;
  draftId   = drftId;
  pendingSelection = null;

  // Clean up previous instances
  destroyCommentPanel();

  // ── Trigger button ─────────────────────────────────────────────
  triggerBtn = document.createElement('button');
  triggerBtn.className = 'comment-trigger-btn';
  triggerBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v8A1.5 1.5 0 0 1 15.5 14H7l-4 3V4.5z"
            stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
    </svg>
  `;
  triggerBtn.title = 'Leave a comment';
  triggerBtn.setAttribute('aria-label', 'Leave a comment');
  triggerBtn.onclick = openPanel;
  document.body.appendChild(triggerBtn);

  // ── Panel ──────────────────────────────────────────────────────
  panel = buildPanel();
  document.body.appendChild(panel);

  // Capture selection when reader content is interacted with
  document.addEventListener('mouseup',  captureSelection);
  document.addEventListener('touchend', captureSelection);
}

export function destroyCommentPanel() {
  panel?.remove();
  triggerBtn?.remove();
  panel = null;
  triggerBtn = null;
  document.removeEventListener('mouseup',  captureSelection);
  document.removeEventListener('touchend', captureSelection);
}

// ── Selection capture ───────────────────────────────────────────

function captureSelection(e) {
  // Don't capture if clicking panel or trigger button
  if (panel?.contains(e.target) || triggerBtn?.contains(e.target)) return;

  setTimeout(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) return;

    const range     = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const content   = document.querySelector('.reader-content');
    if (!content || !content.contains(container)) return;

    const text = sel.toString().trim();
    const paragraphs = Array.from(content.querySelectorAll('p'));
    let paragraphIndex = 0;
    for (let i = 0; i < paragraphs.length; i++) {
      if (paragraphs[i].contains(container)) { paragraphIndex = i; break; }
    }

    pendingSelection = { text, paragraphIndex };

    // Pulse the trigger button to hint there's a selection ready
    triggerBtn?.classList.add('has-selection');
  }, 10);
}

// ── Panel open/close ────────────────────────────────────────────

function openPanel() {
  // Snapshot current selection state
  const sel = pendingSelection;
  pendingSelection = null;
  triggerBtn?.classList.remove('has-selection');

  // Reset form
  panel.querySelector('.cp-note').value = '';
  panel.querySelector('.cp-category').value = 'general';
  panel.querySelector('.cp-error').textContent = '';
  panel.querySelector('.cp-submit').textContent = 'Submit';
  panel.querySelector('.cp-submit').disabled = false;

  // Selection context
  const selectionBlock = panel.querySelector('.cp-selection-block');
  const selectionText  = panel.querySelector('.cp-selection-text');
  const selectionHint  = panel.querySelector('.cp-selection-hint');

  if (sel?.text) {
    panel.dataset.selText  = sel.text;
    panel.dataset.selPara  = sel.paragraphIndex ?? 0;
    selectionText.textContent = `"${sel.text.length > 120 ? sel.text.slice(0, 120) + '…' : sel.text}"`;
    selectionHint.textContent = 'Your comment will reference this passage.';
    selectionBlock.style.display = 'block';
  } else {
    delete panel.dataset.selText;
    delete panel.dataset.selPara;
    selectionBlock.style.display = 'none';
  }

  panel.classList.add('open');

  // Focus textarea
  setTimeout(() => panel.querySelector('.cp-note')?.focus(), 50);
}

function closePanel() {
  panel?.classList.remove('open');
  window.getSelection()?.removeAllRanges();
}

// ── Build panel DOM ─────────────────────────────────────────────

function buildPanel() {
  const el = document.createElement('div');
  el.className = 'comment-panel';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Leave a comment');

  el.innerHTML = `
    <div class="cp-header">
      <span class="cp-title">Leave a comment</span>
      <button class="cp-close" aria-label="Close">✕</button>
    </div>

    <div class="cp-selection-block" style="display:none">
      <div class="cp-selection-text"></div>
      <div class="cp-selection-hint"></div>
    </div>

    <div class="cp-field">
      <label class="cp-label">Type</label>
      <select class="cp-category">
        ${COMMENT_CATEGORIES.map(c =>
          `<option value="${c.value}">${c.label}</option>`
        ).join('')}
      </select>
      <div class="cp-category-hints">
        <span class="cp-cat-hint" data-cat="typo">Spotted a spelling or punctuation error.</span>
        <span class="cp-cat-hint" data-cat="grammar">Something feels grammatically off.</span>
        <span class="cp-cat-hint" data-cat="flow">The pacing or transitions feel awkward.</span>
        <span class="cp-cat-hint" data-cat="question">Something confused me here.</span>
        <span class="cp-cat-hint" data-cat="suggestion">I have an idea for this section.</span>
        <span class="cp-cat-hint" data-cat="general">General thought or reaction.</span>
      </div>
    </div>

    <div class="cp-field">
      <label class="cp-label">Note</label>
      <textarea class="cp-note" placeholder="What's on your mind?" rows="4"></textarea>
    </div>

    <div class="cp-error"></div>
    <button class="cp-submit">Submit</button>
  `;

  // Close button
  el.querySelector('.cp-close').onclick = closePanel;

  // Click outside to close
  document.addEventListener('mousedown', e => {
    if (panel?.classList.contains('open') &&
        !panel.contains(e.target) &&
        !triggerBtn?.contains(e.target)) {
      closePanel();
    }
  });

  // Category hint updates
  const categorySelect = el.querySelector('.cp-category');
  const hints = el.querySelectorAll('.cp-cat-hint');

  function updateHint(val) {
    hints.forEach(h => {
      h.style.display = h.dataset.cat === val ? 'block' : 'none';
    });
  }
  categorySelect.addEventListener('change', () => updateHint(categorySelect.value));
  updateHint('general');

  // Submit
  el.querySelector('.cp-submit').onclick = async () => {
    const note     = el.querySelector('.cp-note').value.trim();
    const category = el.querySelector('.cp-category').value;
    const errEl    = el.querySelector('.cp-error');
    const btn      = el.querySelector('.cp-submit');

    if (!note) {
      errEl.textContent = 'Please write something before submitting.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending…';
    errEl.textContent = '';

    try {
      await createComment({
        chapter_id:       chapterId,
        highlighted_text: el.dataset.selText || '',
        paragraph_index:  parseInt(el.dataset.selPara) || 0,
        category,
        note,
      });

      btn.textContent = '✓ Sent — thank you!';
      setTimeout(closePanel, 1000);
    } catch (err) {
      errEl.textContent = 'Something went wrong. Please try again.';
      btn.disabled = false;
      btn.textContent = 'Submit';
    }
  };

  return el;
}
