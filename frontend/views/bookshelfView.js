import { getNovels, getChapters } from '../services/novelService.js';
import { groupNovels } from '../utils/groupNovels.js';

const containerId = 'main-content';

/**
 * Render the bookshelf.
 * - If bookId is provided, show chapters for that book
 * - Otherwise, show library (public books if anonymous)
 * @param {string|null} bookId
 * @param {Array|null} preloadedNovels optional array of novels to render
 */
export async function renderBookshelf(bookId = null, preloadedNovels = null) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  // --- Show chapters if a book is selected ---
  if (bookId) {
    try {
      const chapters = await getChapters(bookId);

      if (!chapters || chapters.length === 0) {
        container.innerHTML = `<div class="empty-library">No chapters available for this book.</div>`;
        return;
      }

      const title = document.createElement('h2');
      title.textContent = 'Chapters';
      container.appendChild(title);

      chapters.forEach(ch => {
        const el = document.createElement('div');
        el.textContent = ch.title;
        el.className = 'chapter-item';
        el.onclick = () => {
          window.location.search = `?chapter=${ch._id || ch.id}`;
        };
        container.appendChild(el);
      });
    } catch (err) {
      container.innerHTML = `<div class="empty-library">Failed to load chapters.</div>`;
      console.error(err);
    }
    return;
  }

  // --- Show library ---
  let novels = preloadedNovels;
  if (!novels) {
    try {
      novels = await getNovels(); // Will return public books for anonymous
    } catch (err) {
      container.innerHTML = `<div class="empty-library">Failed to load library.</div>`;
      console.error(err);
      return;
    }
  }

  // Handle empty library
  if (!novels || novels.length === 0) {
    const containerMessage = document.createElement('div');
    containerMessage.className = 'empty-library';

    const msg = document.createElement('p');
    msg.textContent = "Sign in to view your library.";
    containerMessage.appendChild(msg);

    const loginBtn = document.createElement('button');
    loginBtn.textContent = "Sign In";
    loginBtn.className = "login-button";
    loginBtn.onclick = () => {
      window.location.href = "/.auth/login/github?post_login_redirect_uri=/";
    };
    containerMessage.appendChild(loginBtn);

    container.appendChild(containerMessage);
    return;
  }

  // --- Normal library rendering ---
  const grouped = groupNovels(novels);

  Object.entries(grouped).forEach(([series, books]) => {
    const seriesEl = document.createElement('h2');
    seriesEl.textContent = series;
    container.appendChild(seriesEl);

    Object.entries(books).forEach(([book, items]) => {
      const bookEl = document.createElement('h3');
      bookEl.textContent = book;
      container.appendChild(bookEl);

      items.forEach(novel => {
        const el = document.createElement('div');
        el.textContent = novel.display_name;
        el.className = 'book-item';
        el.onclick = () => {
          window.location.search = `?book=${novel._id || novel.id}`;
        };
        container.appendChild(el);
      });
    });
  });
}

/**
 * Initial entry point for anonymous users:
 * - Only load public books
 * - No auto-login prompt
 */
export async function loadLibrary() {
  await renderBookshelf(); // will fetch public books only
}