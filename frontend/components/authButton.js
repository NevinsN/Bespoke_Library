import { getUser, getNovelsCache, getNovelsMeta } from '../core/appState.js';
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
