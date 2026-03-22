/**
 * profileView.js — Reader profile page.
 * Private — only visible to the logged-in user.
 * Accessible at /?profile=1 via the profile dropdown in the nav.
 */

import { apiFetch } from '../core/api.js';
import { getUser } from '../core/appState.js';
import { renderSpinner } from '../components/loading.js';
import { getNovels } from '../services/novelService.js';
import { getNovelsCache } from '../core/appState.js';

export async function renderProfileView() {
  const container = document.getElementById('main-content');
  container.innerHTML = '';
  renderSpinner(container, 'Loading profile…');

  let stats, novels;
  try {
    [stats, novels] = await Promise.all([
      apiFetch('/GetProfile'),
      getNovelsCache(async () => {
        const res = await getNovels();
        if (res?.data) return { novels: res.data, meta: res.meta || {} };
        return Array.isArray(res) ? res : [];
      }),
    ]);
  } catch (e) {
    container.innerHTML = `<div class="empty-library">Failed to load profile: ${e.message}</div>`;
    return;
  }

  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'profile-wrap';
  container.appendChild(wrap);

  // ── Header ────────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'profile-header';
  header.innerHTML = `
    <div class="profile-avatar">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="11" r="5" stroke="currentColor" stroke-width="2"/>
        <path d="M5 27c0-5 4.925-9 11-9s11 4 11 9"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <div class="profile-header-text">
      <h1 class="profile-username">@${stats.username || 'Reader'}</h1>
      <p class="profile-since">Member since ${fmtDate(stats.registered_at)}</p>
    </div>
  `;
  wrap.appendChild(header);

  // ── Stat cards ────────────────────────────────────────────────────────────
  const cards = document.createElement('div');
  cards.className = 'profile-stat-cards';

  const statDefs = [
    { label: 'Chapters Read',     value: stats.chapters_opened    ?? 0 },
    { label: 'Completed',         value: stats.chapters_completed ?? 0 },
    { label: 'Rereads',           value: stats.rereads            ?? 0 },
    { label: 'Comments Left',     value: stats.comments_left      ?? 0 },
    { label: 'Books Explored',    value: stats.manuscripts_read   ?? 0 },
    { label: 'Sessions',          value: stats.sessions           ?? 0 },
  ];

  statDefs.forEach(s => {
    const card = document.createElement('div');
    card.className = 'profile-stat-card';
    card.innerHTML = `
      <div class="profile-stat-value">${s.value}</div>
      <div class="profile-stat-label">${s.label}</div>
    `;
    cards.appendChild(card);
  });
  wrap.appendChild(cards);

  // ── Reading history ───────────────────────────────────────────────────────
  const histSection = document.createElement('div');
  histSection.className = 'profile-section';

  const histHeader = document.createElement('div');
  histHeader.className = 'profile-section-header';
  histHeader.innerHTML = '<h2>Reading History</h2>';
  histSection.appendChild(histHeader);

  if (!stats.manuscripts?.length) {
    const empty = document.createElement('p');
    empty.className = 'profile-empty';
    empty.textContent = 'No reading activity yet.';
    histSection.appendChild(empty);
  } else {
    // Build a map of manuscript_id -> display info from novels cache
    const novelMap = {};
    (Array.isArray(novels) ? novels : []).forEach(m => {
      novelMap[m._id] = m;
      (m.drafts || []).forEach(d => { novelMap[d._id] = m; });
    });

    stats.manuscripts.forEach(m => {
      const novel = novelMap[m.manuscript_id] || novelMap[m.draft_id];
      const title = novel?.display_name || novel?.book || 'Unknown Manuscript';
      const draftName = novel?.drafts?.find(d => d._id === m.draft_id)?.name || '';

      const row = document.createElement('div');
      row.className = 'profile-history-row';

      const completionPct = m.chapters_opened > 0
        ? Math.round((m.chapters_completed / m.chapters_opened) * 100)
        : 0;

      row.innerHTML = `
        <div class="profile-history-main">
          <a href="/?book=${m.draft_id}" class="profile-history-title">${title}</a>
          ${draftName ? `<span class="profile-history-draft">${draftName}</span>` : ''}
        </div>
        <div class="profile-history-meta">
          <span class="profile-history-stat">${m.chapters_opened} chapters opened</span>
          <span class="profile-history-dot">·</span>
          <span class="profile-history-stat">${completionPct}% completed</span>
          ${m.rereads > 0 ? `<span class="profile-history-dot">·</span>
          <span class="profile-history-stat">${m.rereads} rereads</span>` : ''}
          <span class="profile-history-dot">·</span>
          <span class="profile-history-date">Last read ${fmtDate(m.last_read)}</span>
        </div>
        <div class="profile-progress-bar-wrap">
          <div class="profile-progress-bar" style="width: ${completionPct}%"></div>
        </div>
      `;
      histSection.appendChild(row);
    });
  }

  wrap.appendChild(histSection);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });
}
