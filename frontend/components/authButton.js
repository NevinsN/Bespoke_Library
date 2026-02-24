// frontend/components/authButton.js

import { getClientPrincipal } from '../core/state.js';
import { getNovels } from '../services/novelService.js';

/**
 * Renders a logged‑in/out button and adds an Author Studio button
 * only if the user owns or co‑authors any manuscript in the library.
 * Returns a DOM element ready to append.
 */
export async function renderAuthButton() {
  const wrapper = document.createElement('div');
  wrapper.className = 'auth-menu';

  const user = await getClientPrincipal(); 
  // getClientPrincipal returns null if not logged in

  // — Login / Logout button
  const authBtn = document.createElement('button');
  authBtn.className = 'auth-button';

  if (user && user.userDetails) {
    authBtn.textContent = 'Logout';
    authBtn.onclick = () => {
      window.location.href = '/.auth/logout?post_logout_redirect_uri=/';
    };

    // — Check author access
    try {
      const res = await getNovels();
      const novels = Array.isArray(res) ? res : res?.data || [];
      const email = user.userDetails;

      const authored = novels.some(novel =>
        Array.isArray(novel.authors) && novel.authors.includes(email) ||
        novel.owner === email
      );

      if (authored) {
        const studioBtn = document.createElement('button');
        studioBtn.className = 'auth-button';
        studioBtn.style.marginLeft = '10px';
        studioBtn.textContent = 'Author Studio';
        studioBtn.onclick = () => {
          import('../views/authorStudioView.js').then(mod => {
            mod.renderAuthorStudio();
          });
        };
        wrapper.appendChild(studioBtn);
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