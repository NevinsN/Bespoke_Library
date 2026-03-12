/**
 * navbar.js — Nav bar
 *   Left:   𝔅 (home) · theme toggle · profile icon (with dropdown)
 *   Center: empty
 *   Right:  Studio
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

  // 𝔅 home
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
  themeBtn.title = 'Toggle theme';
  themeBtn.style.color = 'var(--accent-color)';
  themeBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
      <path d="M8 1a7 7 0 0 1 0 14V1z" fill="currentColor"/>
    </svg>
  `;
  const savedTheme = localStorage.getItem('bespoke-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme === 'sepia' ? 'sepia' : '');
  themeBtn.onclick = () => {
    const current = localStorage.getItem('bespoke-theme') || 'dark';
    const next = current === 'sepia' ? 'dark' : 'sepia';
    localStorage.setItem('bespoke-theme', next);
    document.documentElement.setAttribute('data-theme', next === 'sepia' ? 'sepia' : '');
  };
  left.appendChild(themeBtn);

  // Profile button + dropdown
  if (user) {
    const profileWrap = document.createElement('div');
    profileWrap.className = 'nav-profile-wrap';

    const profileBtn = document.createElement('button');
    profileBtn.className = 'nav-icon-btn';
    profileBtn.title = `@${user.username}`;
    profileBtn.style.color = 'var(--accent-color)';
    profileBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.4"/>
        <path d="M2.5 13.5c0-2.485 2.462-4.5 5.5-4.5s5.5 2.015 5.5 4.5"
              stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
    `;

    const dropdown = document.createElement('div');
    dropdown.className = 'nav-profile-dropdown';
    dropdown.innerHTML = `
      <div class="nav-dropdown-username">@${user.username}</div>
      <button class="nav-dropdown-item" id="nav-logout-btn">Log out</button>
    `;

    profileBtn.onclick = (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    };

    dropdown.querySelector('#nav-logout-btn').onclick = () => {
      document.getElementById('main-content').innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:40vh;color:var(--text-subtle);font-size:0.9em;">Logging out…</div>';
      setTimeout(() => logout(), 300);
    };

    // Close on outside click
    document.addEventListener('click', () => dropdown.classList.remove('open'));

    profileWrap.appendChild(profileBtn);
    profileWrap.appendChild(dropdown);
    left.appendChild(profileWrap);
  }

  // ── Center zone (empty) ───────────────────────────────────────────────────
  const center = document.createElement('div');
  center.className = 'nav-center';

  // ── Right zone ────────────────────────────────────────────────────────────
  const right = document.createElement('div');
  right.className = 'nav-right';

  if (user) {
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

      const adminBtn = document.createElement('button');
      adminBtn.className = 'nav-btn';
      adminBtn.textContent = 'Admin';
      adminBtn.onclick = () => { window.location.href = '/?admin=1'; };
      right.appendChild(adminBtn);
    }
  }

  nav.appendChild(left);
  nav.appendChild(center);
  nav.appendChild(right);

  return nav;
}
