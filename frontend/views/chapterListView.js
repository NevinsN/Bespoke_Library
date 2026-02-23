// frontend/views/renderChapterList.js
import { getChapters } from '../services/novelService.js';

export async function renderChapterList(bookId) {
  const container = document.getElementById('main-content');
  container.innerHTML = `<div class="loading">Loading table of contents...</div>`;

  let chapters = [];
  try {
    chapters = await getChapters(bookId) || [];
  } catch (err) {
    container.innerHTML = `<div class="empty-library">Failed to load chapters.</div>`;
    console.error(err);
    return;
  }

  if (!chapters.length) {
    container.innerHTML = `<div class="empty-library">No chapters found for this draft.</div>`;
    return;
  }

  const manuscriptName = chapters[0].manuscript_display_name || 'Untitled Manuscript';
  const totalWords = chapters.reduce((sum, ch) => sum + (ch.word_count || 0), 0);

  const chapterListEl = document.createElement('div');
  chapterListEl.id = 'chapter-view';

  const backLink = document.createElement('a');
  backLink.href = '/';
  backLink.textContent = '← Back to Library';
  backLink.className = 'back-link';
  chapterListEl.appendChild(backLink);

  const titleEl = document.createElement('h1');
  titleEl.textContent = manuscriptName;
  chapterListEl.appendChild(titleEl);

  const progressEl = document.createElement('p');
  progressEl.innerHTML = `Total Progress: <strong>${totalWords.toLocaleString()} words</strong>`;
  chapterListEl.appendChild(progressEl);

  const ul = document.createElement('ul');
  ul.className = 'chapter-list';

  chapters.forEach(ch => {
    const li = document.createElement('li');

    const a = document.createElement('a');
    a.href = `/?id=${ch._id}`;
    a.textContent = ch.title || 'Untitled Chapter';
    li.appendChild(a);

    const metaSpan = document.createElement('span');
    metaSpan.className = 'ch-metadata';
    metaSpan.textContent = `${(ch.word_count || 0).toLocaleString()} words`;
    li.appendChild(metaSpan);

    ul.appendChild(li);
  });

  chapterListEl.appendChild(ul);
  container.innerHTML = ''; // clear loading
  container.appendChild(chapterListEl);
}