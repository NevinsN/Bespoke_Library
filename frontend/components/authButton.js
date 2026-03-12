/**
 * authButton.js — Nav bar with three zones:
 *   Left:   Home + Theme toggle
 *   Center: @username
 *   Right:  Studio + Logout
 *
 * Anonymous: bar is rendered but empty (hidden on welcome page via CSS class)
 */

import { getUser, getNovelsCache, getNovelsMeta } from '../core/appState.js';
import { loginWithRedirect, logout } from '../core/auth0Client.js';
import { getUnreadCommentCount } from '../services/commentService.js';
import { getNovels } from '../services/novelService.js';

export async function renderAuthButton() {
  const nav = document.createElement('nav');
  nav.className = 'site-nav';

  const user = await getUser();

  // ── Left zone ─────────────────────────────────────────────────────────────
  const left = document.createElement('div');
  left.className = 'nav-left';

  // Home button
  const homeBtn = document.createElement('button');
  homeBtn.className = 'nav-icon-btn';
  homeBtn.title = 'Library';
  homeBtn.innerHTML = '𝔅';
  homeBtn.style.fontSize = '1.4em';
  homeBtn.style.fontWeight = 'bold';
  homeBtn.style.color = 'var(--accent-color)';
  homeBtn.onclick = () => { window.location.href = '/'; };
  left.appendChild(homeBtn);

  // Theme toggle
  const themeBtn = document.createElement('button');
  themeBtn.className = 'nav-icon-btn';
  const savedTheme = localStorage.getItem('bespoke-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme === 'sepia' ? 'sepia' : '');
  themeBtn.innerHTML   = savedTheme === 'sepia' ? '🌙' : '📜';
  themeBtn.title = savedTheme === 'sepia' ? 'Switch to dark' : 'Switch to sepia';
  themeBtn.onclick = () => {
    const current = localStorage.getItem('bespoke-theme') || 'dark';
    const next = current === 'sepia' ? 'dark' : 'sepia';
    localStorage.setItem('bespoke-theme', next);
    document.documentElement.setAttribute('data-theme', next === 'sepia' ? 'sepia' : '');
    themeBtn.innerHTML   = next === 'sepia' ? '🌙' : '📜';
    themeBtn.title = next === 'sepia' ? 'Switch to dark' : 'Switch to sepia';
  };
  left.appendChild(themeBtn);

  // ── Center zone ───────────────────────────────────────────────────────────
  const center = document.createElement('div');
  center.className = 'nav-center';

  if (user?.username) {
    const nameEl = document.createElement('span');
    nameEl.className = 'nav-username';
    nameEl.textContent = `@${user.username}`;
    center.appendChild(nameEl);
  }

  // ── Right zone ────────────────────────────────────────────────────────────
  const right = document.createElement('div');
  right.className = 'nav-right';

  if (!user) {
    // Anonymous — right zone empty, welcome page handles login CTA
  } else {
    // Check admin
    let isAdmin = !!user?.is_admin;
    try {
      await getNovelsCache(async () => {
        const res = await getNovels();
        if (res?.data) return { novels: res.data, meta: res.meta || {} };
        return Array.isArray(res) ? res : [];
      });
      const meta = getNovelsMeta();
      isAdmin = isAdmin || !!meta?.is_admin;
    } catch {}

    // Studio
    if (isAdmin) {
      const studioBtn = document.createElement('button');
      studioBtn.className = 'nav-btn';
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

      right.appendChild(studioBtn);
    }

    // Logout
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'nav-btn';
    logoutBtn.textContent = 'Logout';
    logoutBtn.onclick = () => {
      document.getElementById('main-content').innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:40vh;color:var(--text-subtle);font-size:0.9em;">Logging out…</div>';
      setTimeout(() => logout(), 300);
    };
    right.appendChild(logoutBtn);
  }

  nav.appendChild(left);
  nav.appendChild(center);
  nav.appendChild(right);

  return nav;
}
