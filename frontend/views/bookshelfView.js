import { getNovels } from '../services/novelService.js';
import { groupNovels } from '../utils/groupNovels.js';
import { renderChapterList } from './chapterListView.js';
import { renderAuthButton } from '../components/authButton.js';
import {
  getUser, isAuthor, getNovelsCache, invalidateNovels,
  getProgressPercent, getLastChapter
} from '../core/appState.js';
import { renderSkeleton } from '../components/loading.js';

const containerId = 'main-content';

export async function renderBookshelf() {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  // ── Auth button ──
  const authWrapper = document.createElement('div');
  authWrapper.id = 'auth-container';
  authWrapper.appendChild(await renderAuthButton());
  container.appendChild(authWrapper);

  // ── Skeleton while loading ──
  renderSkeleton(container, 'bookshelf');

  // ── Load novels (from cache if available) ──
  let novels = [];
  try {
    novels = await getNovelsCache(async () => {
      const res = await getNovels();
      return Array.isArray(res) ? res : (res?.data || []);
    });
  } catch (err) {
    const errEl = document.createElement('div');
    errEl.className = 'empty-library';
    errEl.textContent = 'Failed to load library.';
    container.appendChild(errEl);
    console.error(err);
    return;
  }

  container.querySelector('.skeleton-wrap')?.remove();

  if (!novels.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-library';
    empty.textContent = 'No books available.';
    container.appendChild(empty);
    return;
  }

  // ── Continue Reading banner (most recently read draft) ──
  const continueEntry = getMostRecentRead(novels);
  if (continueEntry) {
    container.appendChild(renderContinueBanner(continueEntry));
  }

  // ── Library ──
  const grouped = groupNovels(novels) || {};

  Object.entries(grouped).forEach(([seriesName, books]) => {
    const seriesEl = document.createElement('div');
    seriesEl.className = 'series-container';

    const seriesTitle = document.createElement('h2');
    seriesTitle.className = 'series-title';
    seriesTitle.textContent = seriesName || 'Untitled Series';
    seriesEl.appendChild(seriesTitle);

    Object.entries(books).forEach(([bookName, drafts]) => {
      const bookEl = document.createElement('div');
      bookEl.className = 'book-container';

      const bookTitle = document.createElement('h3');
      bookTitle.className = 'book-title';
      bookTitle.textContent = bookName || 'Untitled Book';
      bookEl.appendChild(bookTitle);

      if (Array.isArray(drafts)) {
        drafts.forEach(draft => {
          bookEl.appendChild(renderDraftCard(draft));
        });
      }

      seriesEl.appendChild(bookEl);
    });

    container.appendChild(seriesEl);
  });

  // ── Refresh after upload ──
  document.addEventListener('chaptersUploaded', async () => {
    invalidateNovels();
    renderBookshelf();
  }, { once: true });
}

// ─── Draft card with progress bar ─────────────────────────────────────────────
function renderDraftCard(draft) {
  const totalChapters = draft.chapter_count || draft.drafts?.length || 0;
  const progressPct   = getProgressPercent(draft._id, totalChapters);
  const lastChapter   = getLastChapter(draft._id);
  const hasStarted    = progressPct > 0;
  const isComplete    = progressPct >= 1;

  const card = document.createElement('div');
  card.className = 'book-card';
  card.dataset.draftId = draft._id;

  // Title row
  const titleRow = document.createElement('div');
  titleRow.className = 'book-card-title';
  titleRow.textContent = draft.display_name || draft.name || 'Untitled';
  card.appendChild(titleRow);

  // Progress bar (only shown if user has started)
  if (hasStarted) {
    const barWrap = document.createElement('div');
    barWrap.className = 'goal-container';

    const bar = document.createElement('div');
    bar.className = 'goal-fill';
    bar.style.width = `${Math.round(progressPct * 100)}%`;
    if (isComplete) bar.style.background = 'var(--success-color)';
    barWrap.appendChild(bar);
    card.appendChild(barWrap);

    const barMeta = document.createElement('div');
    barMeta.className = 'book-card-meta';
    barMeta.textContent = isComplete
      ? '✓ Finished'
      : `${Math.round(progressPct * 100)}% read`;
    if (isComplete) barMeta.style.color = 'var(--success-color)';
    card.appendChild(barMeta);
  }

  // Continue / Start link
  const actionLink = document.createElement('a');
  actionLink.className = 'book-card-action';
  if (hasStarted && lastChapter && !isComplete) {
    actionLink.href = `/?id=${lastChapter}`;
    actionLink.textContent = 'Continue reading →';
  } else if (isComplete) {
    actionLink.href = `/?book=${draft._id}`;
    actionLink.textContent = 'Read again →';
  } else {
    actionLink.href = `/?book=${draft._id}`;
    actionLink.textContent = 'Start reading →';
  }
  card.appendChild(actionLink);

  // Whole card also navigates to chapter list
  card.onclick = (e) => {
    if (e.target === actionLink) return; // let the link handle it
    window.location.href = `/?book=${draft._id}`;
  };

  return card;
}

// ─── Continue reading banner ───────────────────────────────────────────────────
function renderContinueBanner({ draft, chapterId }) {
  const banner = document.createElement('div');
  banner.className = 'continue-banner';

  const label = document.createElement('span');
  label.className = 'continue-label';
  label.textContent = 'Continue reading';
  banner.appendChild(label);

  const title = document.createElement('span');
  title.className = 'continue-title';
  title.textContent = draft.display_name || draft.name || 'Untitled';
  banner.appendChild(title);

  const btn = document.createElement('a');
  btn.href = `/?id=${chapterId}`;
  btn.className = 'reader-nav-btn';
  btn.textContent = 'Pick up where you left off →';
  banner.appendChild(btn);

  return banner;
}

// ─── Find most recently read draft across all novels ──────────────────────────
function getMostRecentRead(novels) {
  let best = null;
  let bestTime = null;

  novels.forEach(manuscript => {
    (manuscript.drafts || []).forEach(draft => {
      const progress = JSON.parse(localStorage.getItem('bespoke_reading_progress') || '{}')[draft._id];
      if (!progress?.chapter_id) return;
      const t = new Date(progress.last_read || 0);
      if (!bestTime || t > bestTime) {
        bestTime = t;
        best = { draft, chapterId: progress.chapter_id };
      }
    });
  });

  return best;
}
