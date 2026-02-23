// frontend/views/bookshelfView.js
import { getNovels, getChapters } from '../services/novelService.js';
import { groupNovels } from '../utils/groupNovels.js';
import { bookCard } from '../components/bookCard.js';
import { chapterItem } from '../components/chapterItem.js';
import { getClientPrincipal } from '../core/state.js';

const containerId = 'main-content';

export async function renderBookshelf(selectedBookId = null) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  // -----------------------------
  // Setup Auth Menu
  // -----------------------------
  const user = await getClientPrincipal();
  renderAuthMenu(user);

  // -----------------------------
  // Show chapters if a book is selected
  // -----------------------------
  if (selectedBookId) {
    try {
      const chapters = await getChapters(selectedBookId) || [];
      if (!chapters.length) {
        container.innerHTML = `<div class="empty-library">No chapters available for this book.</div>`;
        return;
      }

      const title = document.createElement('h2');
      title.textContent = 'Chapters';
      container.appendChild(title);

      const list = document.createElement('ul');
      chapters.forEach(ch => {
        list.innerHTML += chapterItem(ch);
      });
      container.appendChild(list);

    } catch (err) {
      container.innerHTML = `<div class="empty-library">Failed to load chapters.</div>`;
      console.error(err);
    }
    return;
  }

  // -----------------------------
  // Show library (grouped by series)
  // -----------------------------
  let novels = [];
  let meta = {};
  try {
    const res = await getNovels();
    if (Array.isArray(res)) {
      novels = res;
    } else {
      novels = res?.data || [];
      meta = res?.meta || {};
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-library">Failed to load library.</div>`;
    console.error(err);
    return;
  }

  if (!novels.length) {
    const containerMessage = document.createElement('div');
    containerMessage.className = 'empty-library';

    if (meta.empty_reason === 'not_logged_in') {
      const msg = document.createElement('p');
      msg.textContent = "Sign in to view your library.";
      containerMessage.appendChild(msg);

    } else if (meta.empty_reason === 'no_access') {
      containerMessage.textContent = "You don't have access to any manuscripts.";
    } else {
      containerMessage.textContent = "No books available.";
    }

    container.appendChild(containerMessage);
    return;
  }

  // -----------------------------
  // Render grouped library
  // -----------------------------
  const grouped = groupNovels(novels) || {};
  Object.entries(grouped).forEach(([seriesName, books]) => {
    const seriesEl = document.createElement('h2');
    seriesEl.textContent = seriesName || 'Untitled Series';
    seriesEl.className = 'series-title';
    container.appendChild(seriesEl);

    Object.entries(books).forEach(([bookName, items]) => {
      const bookEl = document.createElement('h3');
      bookEl.textContent = bookName || 'Untitled Book';
      bookEl.className = 'book-title';
      container.appendChild(bookEl);

      if (Array.isArray(items)) {
        items.forEach(novel => {
          container.innerHTML += bookCard(novel);
        });
      }
    });
  });
}

// -----------------------------
// Auth Menu Rendering
// -----------------------------
function renderAuthMenu(user) {
  let menu = document.querySelector('.auth-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.className = 'auth-menu';
    document.body.appendChild(menu);
  }
  menu.innerHTML = '';

  const btn = document.createElement('button');
  btn.className = 'auth-button';

  if (user) {
    btn.textContent = 'Logout';
    btn.onclick = () => {
      window.location.href = '/.auth/logout?post_logout_redirect_uri=/';
    };
  } else {
    btn.textContent = 'Login';
    btn.onclick = () => {
      window.location.href = "/.auth/login/aad?post_login_redirect_uri=/";
    };
  }

  menu.appendChild(btn);
}