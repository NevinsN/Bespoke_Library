import { getNovels, getChapters } from '../services/novelService.js';
import { groupNovels } from '../utils/groupNovels.js';

const containerId = 'main-content';

export async function renderBookshelf(bookId = null) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  // -------------------
  // Show chapters if a book is selected
  // -------------------
  if (bookId) {
    try {
      const chapters = await getChapters(bookId) || [];

      if (!chapters.length) {
        container.innerHTML = `<div class="empty-library">No chapters available for this book.</div>`;
        return;
      }

      const title = document.createElement('h2');
      title.textContent = 'Chapters';
      container.appendChild(title);

      chapters.forEach(ch => {
        const el = document.createElement('div');
        el.textContent = ch.title || 'Untitled Chapter';
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

  // -------------------
  // Show library
  // -------------------
  let novels = [];
  let meta = {};

  try {
    const res = await getNovels();
    // Ensure we always have an array
    if (Array.isArray(res)) {
      novels = res;
    } else if (res?.data) {
      novels = res.data;
      meta = res.meta || {};
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-library">Failed to load library.</div>`;
    console.error(err);
    return;
  }

  // Handle empty library
  if (!novels.length) {
    const containerMessage = document.createElement('div');
    containerMessage.className = 'empty-library';

    if (meta.empty_reason === 'not_logged_in') {
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

    } else if (meta.empty_reason === 'no_access') {
      containerMessage.textContent = "You don't have access to any manuscripts.";
    } else {
      containerMessage.textContent = "No books available.";
    }

    container.appendChild(containerMessage);
    return;
  }

  // -------------------
  // Render grouped library
  // -------------------
  const grouped = groupNovels(novels) || {};

  Object.entries(grouped).forEach(([seriesName, books]) => {
    // Series heading
    const seriesEl = document.createElement('h2');
    seriesEl.textContent = seriesName || 'Untitled Series';
    seriesEl.className = 'series-title';
    container.appendChild(seriesEl);

    Object.entries(books).forEach(([bookName, items]) => {
      // Book heading
      const bookEl = document.createElement('h3');
      bookEl.textContent = bookName || 'Untitled Book';
      bookEl.className = 'book-title';
      container.appendChild(bookEl);

      // Book items
      if (Array.isArray(items)) {
        items.forEach(novel => {
          const el = document.createElement('div');
          el.className = 'book-item';
          el.textContent = novel.display_name || 'Untitled Book';

          // Optional metadata
          if (novel.total_word_count) {
            const metaEl = document.createElement('span');
            metaEl.className = 'book-meta';
            metaEl.textContent = ` — ${novel.total_word_count.toLocaleString()} words`;
            el.appendChild(metaEl);
          }

          el.onclick = () => {
            window.location.search = `?book=${novel._id || novel.id}`;
          };
          container.appendChild(el);
        });
      }
    });
  });
}