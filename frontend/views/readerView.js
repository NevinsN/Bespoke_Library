import { getChapter } from '../services/novelService.js';
import { initCommentPanel, destroyCommentPanel } from '../components/commentPanel.js';
import {
  markChapterRead,
  saveScrollPosition,
  getScrollPosition
} from '../core/appState.js';
import { renderMarkdown } from '../utils/markdown.js';
import { renderSkeleton } from '../components/loading.js';

const containerId = 'main-content';

// Debounce helper
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

export async function renderReader(chapterId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const skeletonWrapper = document.createElement('div');
  skeletonWrapper.id = 'skeleton-wrapper';
  container.appendChild(skeletonWrapper);
  renderSkeleton(skeletonWrapper, 'reader');

  let chapter;
  try {
    chapter = await getChapter(chapterId);
  } catch (err) {
    document.getElementById('skeleton-wrapper')?.remove();
    const errEl = document.createElement('div');
    errEl.className = 'empty-library';
    errEl.textContent = 'Failed to load chapter.';
    container.appendChild(errEl);
    return;
  }

  document.getElementById('skeleton-wrapper')?.remove();

  const draftId = chapter.draft_id;

  // ── Mark as read immediately on open ──
  markChapterRead(draftId, chapterId);

  // ── Floating back → chapter list ──
  // Remove any existing floating back button first
  document.querySelector('.floating-back')?.remove();
  const backBtn = document.createElement('a');
  backBtn.href = `/?book=${draftId}`;
  backBtn.className = 'floating-back';
  backBtn.textContent = '← Chapters';
  document.body.appendChild(backBtn);
  window.addEventListener('popstate', () => backBtn.remove(), { once: true });

  // ── Article ──
  const article = document.createElement('article');
  article.className = 'reader-article';

  const title = document.createElement('h1');
  title.className = 'reader-title';
  title.textContent = chapter.title;
  article.appendChild(title);

  const content = document.createElement('div');
  content.className = 'reader-content';
  content.innerHTML = await renderMarkdown(chapter.content);
  article.appendChild(content);

  // ── Footnote popups ──────────────────────────────────────────────────────
  initFootnotePopups(content);

  // ── Comment panel ─────────────────────────────────────────────────────────
  destroyCommentPanel();
  if (chapter.comments_enabled !== false) {
    initCommentPanel(chapter._id, chapter.draft_id);
  }

  // ── Bottom nav ──
  if (chapter.prev_id || chapter.next_id) {
    const bottomNav = document.createElement('div');
    bottomNav.className = 'reader-bottom-nav';

    if (chapter.prev_id) {
      const prev = document.createElement('a');
      prev.href = `/?id=${chapter.prev_id}`;
      prev.className = 'reader-nav-btn';
      prev.textContent = '← Previous Chapter';
      bottomNav.appendChild(prev);
    }

    if (chapter.next_id) {
      const next = document.createElement('a');
      next.href = `/?id=${chapter.next_id}`;
      next.className = 'reader-nav-btn';
      next.textContent = 'Next Chapter →';
      bottomNav.appendChild(next);
    }

    article.appendChild(bottomNav);
  }

  container.appendChild(article);

  // ── Restore scroll position ──
  const savedPct = getScrollPosition(draftId, chapterId);
  if (savedPct !== null) {
    // Wait for layout to settle before scrolling
    requestAnimationFrame(() => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: savedPct * maxScroll, behavior: 'smooth' });
    });
  } else {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ── Save scroll position on scroll (debounced) ──
  const onScroll = debounce(() => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return;
    const pct = window.scrollY / maxScroll;
    saveScrollPosition(draftId, chapterId, pct);
  }, 300);

  window.addEventListener('scroll', onScroll);

  // Clean up scroll listener when navigating away
  window.addEventListener('popstate', () => {
    window.removeEventListener('scroll', onScroll);
    destroyCommentPanel();
  }, { once: true });
}


// ─── Footnote popup ───────────────────────────────────────────────────────────

function initFootnotePopups(container) {
  // marked.js renders footnotes as:
  //   reference: <sup><a href="#fn-1" id="fnref-1">1</a></sup>
  //   definition: <li id="fn-1"><p>Text <a href="#fnref-1">↩</a></p></li>
  // We intercept reference clicks and show a popup instead.

  // Hide the footnotes section at the bottom
  const fnSection = container.querySelector('.footnotes, section.footnotes, ol.footnotes');
  if (fnSection) fnSection.style.display = 'none';

  // Also hide any <hr> immediately before footnotes
  if (fnSection?.previousElementSibling?.tagName === 'HR') {
    fnSection.previousElementSibling.style.display = 'none';
  }

  // Build a map of id → text content from footnote items
  const fnMap = {};
  container.querySelectorAll('li[id^="fn"]').forEach(li => {
    const id = li.getAttribute('id');
    // Clone and remove the back-link (↩) for clean display
    const clone = li.cloneNode(true);
    clone.querySelectorAll('a[href^="#fnref"]').forEach(a => a.remove());
    fnMap[id] = clone.textContent.trim();
  });

  // Create singleton popup element
  const popup = document.createElement('div');
  popup.className = 'footnote-popup';
  popup.setAttribute('role', 'tooltip');
  document.body.appendChild(popup);

  let activeRef = null;

  function showPopup(anchor, fnId) {
    const text = fnMap[fnId];
    if (!text) return;
    popup.textContent = text;
    popup.classList.add('visible');
    activeRef = anchor;

    // Position above the anchor
    const rect = anchor.getBoundingClientRect();
    const popupW = 280;
    let left = rect.left + window.scrollX - popupW / 2 + rect.width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - popupW - 12));
    const top = rect.top + window.scrollY - popup.offsetHeight - 10;

    popup.style.left = left + 'px';
    popup.style.top  = (top < window.scrollY + 60 
      ? rect.bottom + window.scrollY + 8   // flip below if no room above
      : top) + 'px';
  }

  function hidePopup() {
    popup.classList.remove('visible');
    activeRef = null;
  }

  // Intercept footnote reference clicks
  container.querySelectorAll('a[href^="#fn"]').forEach(anchor => {
    const href = anchor.getAttribute('href');
    // Only reference links (not back-links which go to #fnref)
    if (href.startsWith('#fnref')) return;

    anchor.addEventListener('click', e => {
      e.preventDefault();
      const fnId = href.slice(1); // strip leading #
      if (activeRef === anchor && popup.classList.contains('visible')) {
        hidePopup();
      } else {
        showPopup(anchor, fnId);
      }
    });
  });

  // Click outside to dismiss
  document.addEventListener('click', e => {
    if (!popup.contains(e.target) && e.target !== activeRef) {
      hidePopup();
    }
  }, { capture: true });
}
