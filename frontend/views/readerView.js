import { getChapter } from '../services/novelService.js';

const containerId = 'main-content';

export async function renderReader(chapterId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

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

  // ── Floating back button → chapter list ──
  const backBtn = document.createElement('a');
  backBtn.href = `/?book=${chapter.draft_id}`;
  backBtn.className = 'floating-back';
  backBtn.textContent = '← Chapters';
  document.body.appendChild(backBtn);

  // Remove when navigating away
  window.addEventListener('popstate', () => backBtn.remove(), { once: true });

  // ── Chapter content ──
  const article = document.createElement('article');
  article.className = 'reader-article';

  const title = document.createElement('h1');
  title.className = 'reader-title';
  title.textContent = chapter.title;
  article.appendChild(title);

  const content = document.createElement('div');
  content.className = 'reader-content';
  content.innerHTML = chapter.content;
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
}
