/**
 * appState.js — Auth0-based user state.
 *
 * SESSION (memory only):
 *   user    — { id, username, is_admin, has_username } from /api/GetMe
 *   novels  — cached GetNovels result
 *
 * PERSISTED (localStorage):
 *   reading_progress — keyed by draft_id
 */

import { initAuth, getAuth0User, getAccessToken } from './auth0Client.js';

const PROGRESS_KEY = 'bespoke_reading_progress';

let _auth0Initialized = false;
let _user    = undefined;  // undefined = not fetched, null = anonymous
let _novels  = null;
let _meta    = null;

// ─── Auth init ────────────────────────────────────────────────────────────────
export async function initAppAuth() {
  if (_auth0Initialized) return;
  await initAuth();
  _auth0Initialized = true;
}

// ─── User ─────────────────────────────────────────────────────────────────────
export async function getUser() {
  if (_user !== undefined) return _user;

  try {
    const auth0User = await getAuth0User();
    if (!auth0User) { _user = null; return null; }

    // Fetch our own profile from the backend (includes username, is_admin)
    const token = await getAccessToken();
    if (!token) { _user = null; return null; }

    const res = await fetch('https://bespoke-api.nicholasnevins.org/api/GetMe', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) { _user = null; return null; }

    const data = await res.json();
    _user = data?.data?.user ?? null;
  } catch (e) {
    // Suppress Auth0 SDK's internal empty TypeErrors (iOS Safari ITP)
    if (!(e instanceof TypeError && !e.message)) {
      console.error('getUser error:', e);
    }
    _user = null;
  }

  return _user;
}

export function getCachedUser() {
  return _user ?? null;
}

export function setUser(u) {
  _user = u;
}

export function isAuthor(novels) {
  if (!_user?.username) return false;
  return _user?.is_admin === true;
}

// ─── Novels cache ─────────────────────────────────────────────────────────────
export async function getNovelsCache(fetchFn) {
  if (_novels) return _novels;
  const result = await fetchFn();
  if (result?.novels) {
    _novels = result.novels;
    _meta   = result.meta || {};
  } else {
    _novels = Array.isArray(result) ? result : [];
    _meta   = {};
  }
  return _novels;
}

export function getNovelsMeta() { return _meta || {}; }
export function invalidateNovels() { _novels = null; _meta = null; }

// ─── Reading progress ─────────────────────────────────────────────────────────
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {}; }
  catch { return {}; }
}

function saveProgress(data) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
}

export function getProgress(draftId)        { return loadProgress()[draftId] ?? null; }
export function getNovelsMeta_()            { return _meta || {}; }

export function markChapterRead(draftId, chapterId) {
  const all   = loadProgress();
  const entry = all[draftId] ?? { chapters_read: [] };
  if (!entry.chapters_read.includes(chapterId)) entry.chapters_read.push(chapterId);
  entry.chapter_id = chapterId;
  entry.last_read  = new Date().toISOString();
  all[draftId] = entry;
  saveProgress(all);
}

export function saveScrollPosition(draftId, chapterId, scrollPct) {
  const all   = loadProgress();
  const entry = all[draftId] ?? { chapters_read: [] };
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
