/**
 * authButton.js — Auth0-powered nav buttons.
 * Login/logout via Auth0, theme toggle, Studio access for admins.
 */

import { getUser, getNovelsCache, getNovelsMeta } from '../core/appState.js';
import { loginWithRedirect, logout } from '../core/auth0Client.js';
import { getUnreadCommentCount } from '../services/commentService.js';
import { getNovels } from '../services/novelService.js';

export async function renderAuthButton() {
  const wrapper = document.createElement('div');
  wrapper.className = 'auth-menu';

  const user = await getUser();

  if (!user) {
    const loginBtn = document.createElement('button');
    loginBtn.className = 'auth-button';
    loginBtn.textContent = 'Login';
    loginBtn.onclick = () => loginWithRedirect();
    wrapper.appendChild(loginBtn);
    return wrapper;
  }

  // ── Load novels for meta ───────────────────────────────────────────────────
  let isAdmin = false;
  try {
    await getNovelsCache(async () => {
      const res = await getNovels();
      if (res?.data) return { novels: res.data, meta: res.meta || {} };
      return Array.isArray(res) ? res : [];
    });
    const meta = getNovelsMeta();
    isAdmin = !!meta?.is_admin || !!user?.is_admin;
  } catch (err) {
    console.error('Error checking role:', err);
  }

  // ── Studio button ─────────────────────────────────────────────────────────
  if (isAdmin) {
    const studioBtn = document.createElement('button');
    studioBtn.className = 'auth-button';
    studioBtn.textContent = 'Studio';
    studioBtn.onclick = () => { window.location.href = '/?studio=1'; };

    getUnreadCommentCount().then(count => {
      if (count > 0) {
        const badge = document.createElement('span');
        badge.className = 'comment-badge';
        badge.textContent = count > 99 ? '99+' : count;
        studioBtn.style.position = 'relative';
        studioBtn.appendChild(badge);
      }
    }).catch(() => {});

    wrapper.appendChild(studioBtn);
  }

  // ── Username display ───────────────────────────────────────────────────────
  if (user.username) {
    const nameEl = document.createElement('span');
    nameEl.className = 'auth-username';
    nameEl.textContent = `@${user.username}`;
    wrapper.appendChild(nameEl);
  }

  // ── Theme toggle ───────────────────────────────────────────────────────────
  const themeBtn = document.createElement('button');
  themeBtn.className = 'auth-button';
  themeBtn.style.marginLeft = '8px';
  const savedTheme = localStorage.getItem('bespoke-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme === 'sepia' ? 'sepia' : '');
  themeBtn.textContent = savedTheme === 'sepia' ? '🌙' : '📜';
  themeBtn.title = savedTheme === 'sepia' ? 'Switch to dark' : 'Switch to sepia';
  themeBtn.onclick = () => {
    const current = localStorage.getItem('bespoke-theme') || 'dark';
    const next = current === 'sepia' ? 'dark' : 'sepia';
    localStorage.setItem('bespoke-theme', next);
    document.documentElement.setAttribute('data-theme', next === 'sepia' ? 'sepia' : '');
    themeBtn.textContent = next === 'sepia' ? '🌙' : '📜';
    themeBtn.title = next === 'sepia' ? 'Switch to dark' : 'Switch to sepia';
  };
  wrapper.appendChild(themeBtn);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'auth-button';
  logoutBtn.style.marginLeft = '8px';
  logoutBtn.textContent = 'Logout';
  logoutBtn.onclick = () => {
    document.getElementById('main-content').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:40vh;color:var(--text-subtle);font-size:0.9em;">Logging out…</div>';
    setTimeout(() => logout(), 300);
  };
  wrapper.appendChild(logoutBtn);

  return wrapper;
}
