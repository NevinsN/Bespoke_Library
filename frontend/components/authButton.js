import { getUser, getNovelsCache, getNovelsMeta } from '../core/appState.js';
import { getUnreadCommentCount } from '../services/commentService.js';
import { getNovels } from '../services/novelService.js';

export async function renderAuthButton() {
  const wrapper = document.createElement('div');
  wrapper.className = 'auth-menu';

  const user = await getUser();

  if (!user?.userDetails) {
    const loginBtn = document.createElement('button');
    loginBtn.className = 'auth-button';
    loginBtn.textContent = 'Login';
    loginBtn.onclick = () => {
      window.location.href = '/.auth/login/aad?post_login_redirect_uri=/';
    };
    wrapper.appendChild(loginBtn);
    return wrapper;
  }

  // ── Load novels to get meta (is_admin, etc.) ──────────────────────────────
  let isAdmin = false;
  let isAuthorOrAbove = false;

  try {
    await getNovelsCache(async () => {
      const res = await getNovels();
      if (res?.data) return { novels: res.data, meta: res.meta || {} };
      return Array.isArray(res) ? res : [];
    });
    const meta = getNovelsMeta();
    isAdmin = !!meta?.is_admin;
    isAuthorOrAbove = isAdmin; // expand when author grants are queryable
  } catch (err) {
    console.error('Error checking user role:', err);
  }

  // ── Studio button (authors + admins) ──────────────────────────────────────
  if (isAuthorOrAbove) {
    const studioBtn = document.createElement('button');
    studioBtn.className = 'auth-button';
    studioBtn.textContent = 'Studio';
    studioBtn.onclick = () => { window.location.href = '/?studio=1'; };

  // ── Unread comment badge ──
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

  // ── Logout ────────────────────────────────────────────────────────────────
  const logoutBtn = document.createElement('button');
  logoutBtn.className = 'auth-button';
  logoutBtn.style.marginLeft = '8px';
  logoutBtn.textContent = 'Logout';
  // ── Theme toggle ──
  const themeBtn = document.createElement('button');
  themeBtn.className = 'auth-button';
  themeBtn.style.marginLeft = '8px';
  const savedTheme = localStorage.getItem('bespoke-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme === 'sepia' ? 'sepia' : '');
  themeBtn.textContent = savedTheme === 'sepia' ? '🌙' : '📜';
  themeBtn.title = savedTheme === 'sepia' ? 'Switch to dark mode' : 'Switch to sepia mode';
  themeBtn.onclick = () => {
    const current = localStorage.getItem('bespoke-theme') || 'dark';
    const next = current === 'sepia' ? 'dark' : 'sepia';
    localStorage.setItem('bespoke-theme', next);
    document.documentElement.setAttribute('data-theme', next === 'sepia' ? 'sepia' : '');
    themeBtn.textContent = next === 'sepia' ? '🌙' : '📜';
    themeBtn.title = next === 'sepia' ? 'Switch to dark mode' : 'Switch to sepia mode';
  };
  wrapper.appendChild(themeBtn);

  logoutBtn.onclick = () => {
    // Clear the page before the AAD redirect hop so it doesn't flash
    document.getElementById('main-content').innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:40vh;color:#555;font-size:0.9em;">Logging out…</div>';
    setTimeout(() => {
      window.location.href = '/.auth/logout?post_logout_redirect_uri=/';
    }, 300);
  };
  wrapper.appendChild(logoutBtn);

  return wrapper;
}
