// frontend/views/bookshelfView.js
import { getNovels } from '../services/novelService.js';
import { groupNovels } from '../utils/groupNovels.js';
import { bookCard } from '../components/bookCard.js';
import { renderChapterList } from './chapterListView.js';

const containerId = 'main-content';

export async function renderBookshelf() {
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