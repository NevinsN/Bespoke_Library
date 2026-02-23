import { getNovels, getChapters } from '../services/novelService.js';
import { groupNovels } from '../utils/groupNovels.js';

const containerId = 'main-content';

export async function renderBookshelf(bookId = null) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  // 📖 If a book is selected → show chapters
  if (bookId) {
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
        window.location.search = `?chapter=${ch.id}`;
      };
      container.appendChild(el);
    });

    return;
  }

  // 📚 Otherwise → show library
  const novels = await getNovels();
  const reason = novels.meta?.empty_reason;

  if (!novels || novels.length === 0) {
    const containerMessage = document.createElement('div');
    containerMessage.className = 'empty-library';

    if (reason === "not_logged_in") {
      // Message
      const msg = document.createElement('p');
      msg.textContent = "Sign in to view your library.";
      containerMessage.appendChild(msg);

      // Login button
      const loginBtn = document.createElement('button');
      loginBtn.textContent = "Sign In";
      loginBtn.className = "login-button";
      loginBtn.onclick = () => {
        // Use the Azure SWA login endpoint for your provider (GitHub here)
        window.location.href = "/.auth/login/github?post_login_redirect_uri=/";
      };

      containerMessage.appendChild(loginBtn);
    } else if (reason === "no_access") {
      containerMessage.textContent = "You don't have access to any manuscripts.";
    } else {
      containerMessage.textContent = "No books available.";
    }

    container.appendChild(containerMessage);
    return;
  }

  // 📦 Normal library rendering
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