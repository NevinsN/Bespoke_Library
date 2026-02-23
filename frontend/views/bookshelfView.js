// bookshelfView.js
import { getNovels, getChapters } from '../services/novelService.js';
import { groupNovels } from '../utils/groupNovels.js';
import { bookCard } from '../components/bookCard.js';
import { chapterItem } from '../components/chapterItem.js';
import { getClientPrincipal } from './core/state.js';

const containerId = 'main-content';
const headerId = 'bookshelf-header';

export async function renderBookshelf(bookId = null) {
  const container = document.getElementById(containerId);
  const header = document.getElementById(headerId);
  container.innerHTML = '';
  header.innerHTML = '';

  // --- LOGIN / LOGOUT BUTTON ---
  const user = await getClientPrincipal();
  const loginBtn = document.createElement('button');
  loginBtn.className = 'login-button';
  if (user) {
    loginBtn.textContent = 'Logout';
    loginBtn.onclick = () => {
      window.location.href = "/.auth/logout?post_logout_redirect_uri=/";
    };
  } else {
    loginBtn.textContent = 'Login';
    loginBtn.onclick = () => {
      window.location.href = "/.auth/login/github?post_login_redirect_uri=/";
    };
  }
  header.appendChild(loginBtn);

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

      const listEl = document.createElement('ul');
      chapters.forEach(ch => {
        listEl.innerHTML += chapterItem(ch);
      });
      container.appendChild(listEl);
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

      const btn = document.createElement('button');
      btn.textContent = "Sign In";
      btn.className = "login-button";
      btn.onclick = () => {
        window.location.href = "/.auth/login/github?post_login_redirect_uri=/";
      };
      containerMessage.appendChild(btn);
    } else if (meta.empty_reason === 'no_access') {
      containerMessage.textContent = "You don't have access to any manuscripts.";
    } else {
      containerMessage.textContent = "No books available.";
    }

    container.appendChild(containerMessage);
    return;
  }

  // -------------------
  // Render grouped library with cards
  // -------------------
  const grouped = groupNovels(novels) || {};

  Object.entries(grouped).forEach(([seriesName, books]) => {
    const seriesEl = document.createElement('h2');
    seriesEl.textContent = seriesName || 'Untitled Series';
    seriesEl.className = 'series-title';
    container.appendChild(seriesEl);

    Object.entries(books).forEach(([bookName, items]) => {
      if (Array.isArray(items)) {
        items.forEach(novel => {
          container.innerHTML += bookCard(novel);
        });
      }
    });
  });
}