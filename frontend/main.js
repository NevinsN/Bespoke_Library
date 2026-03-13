import { initAppAuth, getUser } from './core/appState.js';
import { route } from './core/router.js';
import { renderFooter } from './components/footer.js';
import { renderNavbar } from './components/navbar.js';
import { renderUsernameInterstitial, renderLinkVerification } from './views/usernameView.js';
import { AuthError } from './core/api.js';
import { loginWithRedirect, isAuthenticated } from './core/auth0Client.js';

window.addEventListener('unhandledrejection', async e => {
  const reason = e.reason;

  // Auth0 SDK throws empty TypeErrors internally on iOS Safari (ITP iframe block).
  // They look like: TypeError { } with no message, originating from the SDK bundle.
  // If the user IS authenticated (token in localStorage), suppress silently —
  // the error is cosmetic and doesn't affect functionality.
  if (reason instanceof TypeError && !reason.message) {
    e.preventDefault();
    const authed = await isAuthenticated().catch(() => false);
    if (!authed) {
      loginWithRedirect().catch(() => {});
    }
    return;
  }

  // Session expired — redirect to login
  if (reason instanceof AuthError) {
    e.preventDefault();
    loginWithRedirect().catch(() => {});
    return;
  }

  // Genuine error — show error boundary
  console.error('Unhandled error:', reason);
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
