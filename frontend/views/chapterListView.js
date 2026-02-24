import { getChapters } from '../services/novelService.js';

export async function renderChapterList(draftId) {
  const container = document.getElementById('main-content');
  container.innerHTML = '<div class="loading">Loading table of contents...</div>';

  let chapters = [];
  try {
    chapters = await getChapters(draftId) || [];
  } catch (err) {
    container.innerHTML = '';
    const errEl = document.createElement('div');
    errEl.className = 'empty-library';
    errEl.textContent = 'Failed to load chapters.';
    container.appendChild(errEl);
    console.error(err);
    return;
  }

  container.innerHTML = '';

  // ── Floating back button → library ──
  const backBtn = document.createElement('a');
  backBtn.href = '/';
  backBtn.className = 'floating-back';
  backBtn.textContent = '← Library';
  document.body.appendChild(backBtn);

  window.addEventListener('popstate', () => backBtn.remove(), { once: true });

  if (!chapters.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-library';
    empty.textContent = 'No chapters found for this draft.';
    container.appendChild(empty);
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'chapter-list-wrap';

  const titleEl = document.createElement('h1');
  titleEl.className = 'chapter-list-title';
  titleEl.textContent = chapters[0]?.manuscript_display_name || 'Untitled Manuscript';
  wrap.appendChild(titleEl);

  const totalWords = chapters.reduce((sum, ch) => sum + (ch.word_count || 0), 0);
  const progressEl = document.createElement('p');
  progressEl.className = 'chapter-list-meta';
  progressEl.textContent = `${totalWords.toLocaleString()} words across ${chapters.length} chapter${chapters.length !== 1 ? 's' : ''}`;
  wrap.appendChild(progressEl);

  const ul = document.createElement('ul');
  ul.className = 'chapter-list';

  chapters.forEach(ch => {
    const li = document.createElement('li');
    li.className = 'chapter-list-item';

    const a = document.createElement('a');
    a.href = `/?id=${ch._id}`;
    a.className = 'chapter-list-link';
    a.textContent = ch.title || 'Untitled Chapter';
    li.appendChild(a);

    const meta = document.createElement('span');
    meta.className = 'ch-metadata';
    meta.textContent = `${(ch.word_count || 0).toLocaleString()} words`;
    li.appendChild(meta);

    ul.appendChild(li);
  });

  wrap.appendChild(ul);
  container.appendChild(wrap);
}
