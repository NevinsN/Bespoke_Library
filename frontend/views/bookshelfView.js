import { getNovels } from '../services/novelService.js';
import { groupNovels } from '../utils/groupNovels.js';
import { renderSkeleton } from '../components/loading.js';
import {
  getUser, isAuthor, getNovelsCache, invalidateNovels,
  getProgressPercent, getLastChapter
} from '../core/appState.js';

const containerId = 'main-content';

export async function renderBookshelf() {
  const container = document.getElementById(containerId);
  container.innerHTML = '';



  // ── Skeleton — in its own wrapper below auth ──
  const skeletonWrapper = document.createElement('div');
  skeletonWrapper.id = 'skeleton-wrapper';
  container.appendChild(skeletonWrapper);
  renderSkeleton(skeletonWrapper, 'bookshelf');

  // ── Load novels ──
  let novels = [];
  try {
    novels = await getNovelsCache(async () => {
      const res = await getNovels();
      return Array.isArray(res) ? res : (res?.data || []);
    });
  } catch (err) {
    skeletonWrapper.remove();
    const errEl = document.createElement('div');
    errEl.className = 'empty-library';
    errEl.textContent = 'Failed to load library. Please try again.';
    container.appendChild(errEl);
    console.error(err);
    return;
  }

  skeletonWrapper.remove();

  if (!novels.length) {
    const user = await getUser();
    const empty = document.createElement('div');

    if (!user) {
      // Anonymous — show welcome landing
      empty.className = 'welcome-landing';
      empty.innerHTML = `
        <div class="welcome-card">
          <div class="welcome-icon">📖</div>
          <h1 class="welcome-title">Bespoke Library</h1>
          <p class="welcome-subtitle">A private reading platform for works-in-progress.<br>Read early. Give feedback that matters.</p>
          <p class="welcome-note">Manuscripts are currently invite-only.<br>If you have an invite link, log in to redeem it.</p>
          <button class="welcome-login-btn">Log in or create an account</button>
        </div>
      `;
      empty.querySelector('.welcome-login-btn').onclick = () => {
        import('../core/auth0Client.js').then(({ loginWithRedirect }) => loginWithRedirect());
      };
    } else {
      // Logged in but no access yet
      empty.className = 'empty-library';
      empty.innerHTML = `
        <p>You don't have access to any manuscripts yet.</p>
        <p style="font-size:0.85em; color:var(--text-muted); margin-top:8px;">If you received an invite link, open it to gain access.</p>
      `;
    }

    container.appendChild(empty);
    return;
  }

  // ── Wordmark ──
  const user = await getUser();
  if (user?.username) {
    const wordmark = document.createElement('div');
    wordmark.className = 'library-wordmark';
    wordmark.textContent = `${possessive(user.username)} Bespoke Library`;
    container.appendChild(wordmark);
  }

  // ── Continue Reading banner ──
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

// ─── Draft card ───────────────────────────────────────────────────────────────
function renderDraftCard(draft) {
  const totalChapters = draft.chapter_count || 0;
  const progressPct   = getProgressPercent(draft._id, totalChapters);
  const lastChapter   = getLastChapter(draft._id);
  const hasStarted    = progressPct > 0;
  const isComplete    = progressPct >= 1;

  const card = document.createElement('div');
  card.className = 'book-card';
  card.dataset.draftId = draft._id;

  const titleRow = document.createElement('div');
  titleRow.className = 'book-card-title';
  titleRow.textContent = draft.name || draft.display_name || 'Untitled';
  card.appendChild(titleRow);

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
    barMeta.textContent = isComplete ? '✓ Finished' : `${Math.round(progressPct * 100)}% read`;
    if (isComplete) barMeta.style.color = 'var(--success-color)';
    card.appendChild(barMeta);
  }

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

  card.onclick = (e) => {
    if (e.target === actionLink) return;
    window.location.href = `/?book=${draft._id}`;
  };

  return card;
}

// ─── Continue reading banner ──────────────────────────────────────────────────
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

// ─── Most recently read ───────────────────────────────────────────────────────
function getMostRecentRead(novels) {
  let best = null;
  let bestTime = null;
  const progress = JSON.parse(localStorage.getItem('bespoke_reading_progress') || '{}');

  novels.forEach(manuscript => {
    (manuscript.drafts || []).forEach(draft => {
      const entry = progress[draft._id];
      if (!entry?.chapter_id) return;
      const t = new Date(entry.last_read || 0);
      if (!bestTime || t > bestTime) {
        bestTime = t;
        best = { draft, chapterId: entry.chapter_id };
      }
    });
  });

  return best;
}

function possessive(username) {
  // Strip @ if present, apply grammatically correct possessive
  const name = username.replace(/^@/, '');
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}
