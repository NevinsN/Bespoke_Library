import { getChapter } from '../services/novelService.js';
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
  renderSkeleton(container, 'reader');

  let chapter;
  try {
    chapter = await getChapter(chapterId);
  } catch (err) {
    const errEl = document.createElement('div');
    errEl.className = 'empty-library';
    errEl.textContent = 'Failed to load chapter.';
    container.appendChild(errEl);
    return;
  }

  container.querySelector('.skeleton-wrap')?.remove();

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
  }, { once: true });
}
