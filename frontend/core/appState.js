/**
 * appState.js — Single source of truth for all frontend state.
 *
 * SESSION (memory only, lost on page close):
 *   user      — cached /.auth/me result
 *   novels    — cached GetNovels result
 *
 * PERSISTED (localStorage, survives sessions):
 *   reading_progress  — keyed by draft_id
 *     {
 *       chapter_id:    string,
 *       scroll_pct:    number (0–1),
 *       last_read:     ISO string,
 *       chapters_read: string[]  (array of chapter_ids)
 *     }
 */

const PROGRESS_KEY = 'bespoke_reading_progress';

// ─── Session state (memory) ───────────────────────────────────────────────────
let _user = undefined;   // undefined = not yet fetched, null = anonymous
let _novels = null;      // null = not yet fetched

// ─── User ─────────────────────────────────────────────────────────────────────
export async function getUser() {
  if (_user !== undefined) return _user;
  try {
    const res = await fetch('/.auth/me');
    if (!res.ok) { _user = null; return null; }
    const data = await res.json();
    _user = data.clientPrincipal ?? null;
  } catch {
    _user = null;
  }
  return _user;
}

export function getCachedUser() {
  return _user ?? null;
}

export function isAuthor(novels) {
  if (!_user?.userDetails) return false;
  const email = _user.userDetails;
  return novels.some(m =>
    m.owner === email ||
    (Array.isArray(m.access) && m.access.some(a => a.email === email && ['owner','author'].includes(a.role)))
  );
}

// ─── Novels cache ─────────────────────────────────────────────────────────────
let _meta = null;

export async function getNovelsCache(fetchFn) {
  if (_novels) return _novels;
  const result = await fetchFn();
  // fetchFn may return { novels, meta } or just novels array
  if (result?.novels) {
    _novels = result.novels;
    _meta   = result.meta || {};
  } else {
    _novels = result;
    _meta   = {};
  }
  return _novels;
}

export function getNovelsMeta() {
  return _meta || {};
}

export function invalidateNovels() {
  _novels = null;
  _meta   = null;
}



// ─── Reading progress ─────────────────────────────────────────────────────────
function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress(data) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
}

export function getProgress(draftId) {
  return loadProgress()[draftId] ?? null;
}

export function markChapterRead(draftId, chapterId) {
  const all = loadProgress();
  const entry = all[draftId] ?? { chapters_read: [] };
  if (!entry.chapters_read.includes(chapterId)) {
    entry.chapters_read.push(chapterId);
  }
  entry.chapter_id = chapterId;
  entry.last_read = new Date().toISOString();
  all[draftId] = entry;
  saveProgress(all);
}

export function saveScrollPosition(draftId, chapterId, scrollPct) {
  const all = loadProgress();
  const entry = all[draftId] ?? { chapters_read: [] };
  // Only save if this is the current chapter
  if (entry.chapter_id === chapterId) {
    entry.scroll_pct = scrollPct;
    all[draftId] = entry;
    saveProgress(all);
  }
}

export function getScrollPosition(draftId, chapterId) {
  const entry = loadProgress()[draftId];
  if (!entry || entry.chapter_id !== chapterId) return null;
  return entry.scroll_pct ?? null;
}

export function getProgressPercent(draftId, totalChapters) {
  if (!totalChapters) return 0;
  const entry = loadProgress()[draftId];
  if (!entry?.chapters_read?.length) return 0;
  return Math.min(entry.chapters_read.length / totalChapters, 1);
}

export function getLastChapter(draftId) {
  return loadProgress()[draftId]?.chapter_id ?? null;
}
