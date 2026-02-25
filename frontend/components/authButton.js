import { getUser, isAuthor, getNovelsCache } from '../core/appState.js';
import { getNovels } from '../services/novelService.js';

export async function renderAuthButton() {
  const wrapper = document.createElement('div');
  wrapper.className = 'auth-menu';

  const user = await getUser();
  const authBtn = document.createElement('button');
  authBtn.className = 'auth-button';

  if (user?.userDetails) {
    authBtn.textContent = 'Logout';
    authBtn.onclick = () => {
      window.location.href = '/.auth/logout?post_logout_redirect_uri=/';
    };

    // Show Author Studio button if user has author/owner grants
    try {
      const novels = await getNovelsCache(async () => {
        const res = await getNovels();
        return Array.isArray(res) ? res : (res?.data || []);
      });

      if (isAuthor(novels)) {
        const studioBtn = document.createElement('button');
        studioBtn.className = 'auth-button';
        studioBtn.style.marginLeft = '10px';
        studioBtn.textContent = 'Author Studio';
        studioBtn.onclick = () => { window.location.href = '/?studio=1'; };
        wrapper.appendChild(studioBtn);
      }

    if (user?.is_admin) {
        const healthBtn = document.createElement('button');
        healthBtn.className = 'auth-button';
        healthBtn.style.marginLeft = '10px';
        healthBtn.textContent = '⬤ Health';
        healthBtn.onclick = () => { window.location.href = '/?health=1'; };
        wrapper.appendChild(healthBtn);
      }
    } catch (err) {
      console.error('Error checking author status:', err);
    }
  } else {
    authBtn.textContent = 'Login';
    authBtn.onclick = () => {
      window.location.href = '/.auth/login/aad?post_login_redirect_uri=/';
    };
  }

  wrapper.appendChild(authBtn);
  return wrapper;
}
