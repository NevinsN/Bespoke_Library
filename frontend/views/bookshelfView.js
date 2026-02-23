// frontend/views/bookshelfView.js
import { getNovels } from '../services/novelService.js';
import { bookCard } from '../components/bookCard.js';
import { groupNovels } from '../utils/groupNovels.js';

const containerId = 'main-content';
const authMenuId = 'auth-menu';

// ---------------------------
// Persistent login/logout menu
// ---------------------------
export async function renderAuthMenu() {
  let menu = document.getElementById(authMenuId);
  if (!menu) {
    menu = document.createElement('div');
    menu.id = authMenuId;
    menu.className = 'auth-menu';
    document.body.appendChild(menu);
  }
  menu.innerHTML = '';

  // Azure SWA client principal endpoint
  const res = await fetch('/.auth/me');
  const data = await res.json();
  const user = data?.clientPrincipal;

  const button = document.createElement('button');
  button.className = 'auth-button';

  if (user) {
    button.textContent = 'Logout';
    button.onclick = () => {
      window.location.href = '/.auth/logout?post_logout_redirect_uri=/';
    };
  } else {
    button.textContent = 'Login';
    // Default to Azure AD login
    button.onclick = () => {
      window.location.href = '/.auth/login/aad?post_login_redirect_uri=/';
    };
  }

  menu.appendChild(button);
}

// ---------------------------
// Main bookshelf render
// ---------------------------
export async function renderBookshelf() {
  await renderAuthMenu(); // show menu first

  const container = document.getElementById(containerId);
  container.innerHTML = '';

  let novels = [];
  let meta = {};

  try {
    const res = await getNovels();
    novels = Array.isArray(res) ? res : res?.data || [];
    meta = res?.meta || {};
  } catch (err) {
    container.innerHTML = `<div class="empty-library">Failed to load library.</div>`;
    console.error(err);
    return;
  }

  if (!novels.length) {
    const msg = document.createElement('div');
    msg.className = 'empty-library';
    msg.textContent =
      meta.empty_reason === 'not_logged_in'
        ? 'Sign in to view your library.'
        : meta.empty_reason === 'no_access'
        ? "You don't have access to any manuscripts."
        : 'No books available.';
    container.appendChild(msg);
    return;
  }

  const grouped = groupNovels(novels);

  // --- SERIES LOOP ---
  Object.entries(grouped).forEach(([seriesName, books]) => {
    const seriesCard = document.createElement('div');
    seriesCard.className = 'series-card';

    const seriesTitle = document.createElement('h2');
    seriesTitle.textContent = seriesName || 'Untitled Series';
    seriesTitle.className = 'series-title';
    seriesCard.appendChild(seriesTitle);

    // --- BOOK LOOP ---
    Object.entries(books).forEach(([bookName, drafts]) => {
      const bookCardEl = document.createElement('div');
      bookCardEl.className = 'book-card-wrapper';

      const bookTitle = document.createElement('h3');
      bookTitle.textContent = bookName || 'Untitled Book';
      bookTitle.className = 'book-title';
      bookCardEl.appendChild(bookTitle);

      // --- DRAFT LOOP ---
      if (Array.isArray(drafts)) {
        drafts.forEach(draft => {
          const draftHtml = bookCard(draft);
          const draftWrapper = document.createElement('div');
          draftWrapper.innerHTML = draftHtml;
          bookCardEl.appendChild(draftWrapper.firstChild);
        });
      }

      seriesCard.appendChild(bookCardEl);
    });

    container.appendChild(seriesCard);
  });
}