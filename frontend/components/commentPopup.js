/**
 * commentPopup.js
 * Handles text selection in the reader and shows a comment submission popup.
 * Readers highlight text → pick category → write note → submit → popup disappears.
 */

import { COMMENT_CATEGORIES, createComment } from '../services/commentService.js';

let popup = null;
let currentChapterId = null;
let currentDraftId   = null;

export function initCommentSystem(chapterId, draftId) {
  currentChapterId = chapterId;
  currentDraftId   = draftId;

  // Remove any existing popup
  popup?.remove();
  popup = buildPopup();
  document.body.appendChild(popup);

  document.addEventListener('mouseup',  onSelectionEnd);
  document.addEventListener('touchend', onSelectionEnd);
}

export function destroyCommentSystem() {
  popup?.remove();
  popup = null;
  document.removeEventListener('mouseup',  onSelectionEnd);
  document.removeEventListener('touchend', onSelectionEnd);
}

function onSelectionEnd(e) {
  // Ignore clicks inside the popup itself
  if (popup && popup.contains(e.target)) return;

  setTimeout(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      hidePopup();
      return;
    }

    const selectedText = sel.toString().trim();

    // Only trigger inside reader content
    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const readerContent = document.querySelector('.reader-content');
    if (!readerContent || !readerContent.contains(container)) {
      hidePopup();
      return;
    }

    // Find paragraph index
    const paragraphs = Array.from(readerContent.querySelectorAll('p'));
    let paragraphIndex = 0;
    for (let i = 0; i < paragraphs.length; i++) {
      if (paragraphs[i].contains(container)) {
        paragraphIndex = i;
        break;
      }
    }

    showPopup(selectedText, paragraphIndex, range);
  }, 10);
}

function showPopup(selectedText, paragraphIndex, range) {
  // Position near the selection
  const rect = range.getBoundingClientRect();
  const x = rect.left + window.scrollX + rect.width / 2;
  const y = rect.bottom + window.scrollY + 10;

  popup.style.left = Math.max(10, Math.min(x - 160, window.innerWidth - 340)) + 'px';
  popup.style.top  = y + 'px';

  // Store context
  popup.dataset.text  = selectedText;
  popup.dataset.para  = paragraphIndex;

  // Reset form
  popup.querySelector('.comment-note').value = '';
  popup.querySelector('.comment-category').value = 'general';
  popup.querySelector('.comment-submit').textContent = 'Submit';
  popup.querySelector('.comment-submit').disabled = false;
  popup.querySelector('.comment-error').textContent = '';

  popup.classList.add('visible');
}

function hidePopup() {
  popup?.classList.remove('visible');
}

function buildPopup() {
  const el = document.createElement('div');
  el.className = 'comment-popup';

  el.innerHTML = `
    <div class="comment-popup-header">
      <span class="comment-popup-title">Leave a note</span>
      <button class="comment-popup-close">✕</button>
    </div>
    <select class="comment-category">
      ${COMMENT_CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
    </select>
    <textarea class="comment-note" placeholder="What's on your mind?" rows="3"></textarea>
    <div class="comment-error"></div>
    <button class="comment-submit studio-btn small">Submit</button>
  `;

  el.querySelector('.comment-popup-close').onclick = () => {
    hidePopup();
    window.getSelection()?.removeAllRanges();
  };

  el.querySelector('.comment-submit').onclick = async () => {
    const note     = el.querySelector('.comment-note').value.trim();
    const category = el.querySelector('.comment-category').value;
    const errEl    = el.querySelector('.comment-error');
    const btn      = el.querySelector('.comment-submit');

    if (!note) {
      errEl.textContent = 'Please write something first.';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Sending…';
    errEl.textContent = '';

    try {
      await createComment({
        chapter_id:       currentChapterId,
        highlighted_text: el.dataset.text,
        paragraph_index:  parseInt(el.dataset.para) || 0,
        category,
        note,
      });

      // Confirm and vanish — reader sees nothing after this
      btn.textContent = '✓ Sent';
      setTimeout(() => {
        hidePopup();
        window.getSelection()?.removeAllRanges();
      }, 800);
    } catch (err) {
      errEl.textContent = 'Failed to send. Try again.';
      btn.disabled = false;
      btn.textContent = 'Submit';
    }
  };

  return el;
}
