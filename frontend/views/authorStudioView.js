import { getNovels } from '../services/novelService.js';

const containerId = 'app';

export async function renderAuthorStudio() {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  const title = document.createElement('h1');
  title.textContent = 'Author Studio';

  const novels = await getNovels();

  novels.forEach(novel => {
    const el = document.createElement('div');
    el.textContent = novel.title;
    el.className = 'studio-item';

    // Future: edit click
    container.appendChild(el);
  });

  // ➕ New project button
  const newBtn = document.createElement('button');
  newBtn.textContent = 'New Project';
  newBtn.onclick = () => {
    console.log('Create new project');
  };

  container.appendChild(title);
  container.appendChild(newBtn);
}