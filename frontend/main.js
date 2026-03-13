import { initAppAuth, getUser } from './core/appState.js';
import { route } from './core/router.js';
import { renderFooter } from './components/footer.js';
import { renderNavbar } from './components/navbar.js';
import { renderUsernameInterstitial, renderLinkVerification } from './views/usernameView.js';
import { AuthError } from './core/api.js';
import { loginWithRedirect } from './core/auth0Client.js';

window.addEventListener('unhandledrejection', e => {
  // Session expired — redirect to login instead of showing error boundary
  if (e.reason instanceof AuthError) {
    e.preventDefault();
    loginWithRedirect().catch(() => {});
    return;
  }

  console.error('Unhandled error:', e.reason);
  const container = document.getElementById('main-content');
  if (container && !container.querySelector('.error-boundary')) {
    const msg = document.createElement('div');
    msg.className = 'error-boundary';
    msg.innerHTML = `
      <div class="error-boundary-icon">⚠</div>
      <p>Something went wrong. <a href="/">Return to library</a></p>
    `;
    container.appendChild(msg);
  }
});

async function mountNav() {
  let navSlot = document.getElementById('nav-slot');
  if (!navSlot) {
    navSlot = document.createElement('div');
    navSlot.id = 'nav-slot';
    document.body.insertBefore(navSlot, document.body.firstChild);
  }
  navSlot.innerHTML = '';
  const nav = await renderNavbar();
  nav.id = 'site-nav';
  navSlot.appendChild(nav);
}

window.addEventListener('load', async () => {
  await initAppAuth();

  await mountNav();

  const params    = new URLSearchParams(window.location.search);
  const linkToken = params.get('link_token');

  if (linkToken) {
    window.history.replaceState({}, '', '/');
    renderLinkVerification(linkToken, async () => {
      const { setUser } = await import('./core/appState.js');
      setUser(undefined);
      await mountNav();
      await route();
      renderFooter();
    });
    return;
  }

  const user = await getUser();

  if (user && !user.has_username) {
    renderUsernameInterstitial(async () => {
      await mountNav();
      await route();
      renderFooter();
    });
    return;
  }

  await route();
  renderFooter();
});
