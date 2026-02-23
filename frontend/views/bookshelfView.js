// frontend/views/bookshelfView.js
import { getNovels } from '../services/novelService.js';
import { groupNovels } from '../utils/groupNovels.js';
import { bookCard } from '../components/bookCard.js';
import { renderChapterList } from './chapterListView.js';
import { getClientPrincipal } from '../core/state.js'; // assumes this fetches SWA auth info

const containerId = 'main-content';

async function renderAuthMenu() {
  // Create or select persistent auth menu container
  let menu = document.querySelector('.auth-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.className = 'auth-menu';
    document.body.prepend(menu);
  }
  menu.innerHTML = '';

  const user = await getClientPrincipal();

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
      window.location.href = '/.auth/login/aad?post_login_redirect_uri=/';
    };
  }

  menu.appendChild(btn);
}

export async function renderBookshelf() {
  await renderAuthMenu(); // always render auth menu first

  const container = document.getElementById(containerId);
  container.innerHTML = '';

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

  if (!novels.length) {
    container.innerHTML = `<div class="empty-library">No books available.</div>`;
    return;
  }

  const grouped = groupNovels(novels) || {};

  // --- SERIES LOOP ---
  Object.entries(grouped).forEach(([seriesName, books]) => {
    const seriesContainer = document.createElement('div');
    seriesContainer.className = 'series-container';

    const seriesTitle = document.createElement('h2');
    seriesTitle.textContent = seriesName || 'Untitled Series';
    seriesTitle.className = 'series-title';
    seriesContainer.appendChild(seriesTitle);

    // --- BOOK LOOP ---
    Object.entries(books).forEach(([bookName, drafts]) => {
      const bookContainer = document.createElement('div');
      bookContainer.className = 'book-container';

      const bookTitle = document.createElement('h3');
      bookTitle.textContent = bookName || 'Untitled Book';
      bookTitle.className = 'book-title';
      bookContainer.appendChild(bookTitle);

      // --- DRAFT LOOP ---
      if (Array.isArray(drafts)) {
        drafts.forEach(draft => {
          const cardHtml = bookCard(draft); // returns HTML string
          const wrapper = document.createElement('div');
          wrapper.innerHTML = cardHtml;

          // Attach click listener to show chapters for this draft
          wrapper.querySelector('.book-card').onclick = () => {
            renderChapterList(draft._id);
          };

          bookContainer.appendChild(wrapper);
        });
      }

      seriesContainer.appendChild(bookContainer);
    });

    container.appendChild(seriesContainer);
  });
}