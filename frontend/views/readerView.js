import { getChapter, getChapters } from '../services/novelService.js';
import { toggleRole } from '../core/state.js';

const containerId = 'main-content';

export async function renderReader(chapterId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  const chapter = await getChapter(chapterId);

  const title = document.createElement('h1');
  title.textContent = chapter.title;

  const content = document.createElement('div');
  content.innerHTML = chapter.content;

  // 🔁 Role toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = 'Switch Role';
  toggleBtn.onclick = toggleRole;

  container.appendChild(toggleBtn);
  container.appendChild(title);
  container.appendChild(content);

  // ⬅️➡️ Navigation
  const chapters = await getChapters(chapter.manuscript_id);
  const index = chapters.findIndex(c => c._id === chapterId);

  const nav = document.createElement('div');

  if (index > 0) {
    const prev = document.createElement('button');
    prev.textContent = 'Previous';
    prev.onclick = () => {
      window.location.search = `?id=${chapters[index - 1]._id}`;
    };
    nav.appendChild(prev);
  }

  if (index < chapters.length - 1) {
    const next = document.createElement('button');
    next.textContent = 'Next';
    next.onclick = () => {
      window.location.search = `?id=${chapters[index + 1]._id}`;
    };
    nav.appendChild(next);
  }

  container.appendChild(nav);
}