import { initAppAuth, getUser } from './core/appState.js';
import { route } from './core/router.js';
import { renderFooter } from './components/footer.js';
import { renderNavbar } from './components/navbar.js';
import { renderUsernameInterstitial, renderLinkVerification } from './views/usernameView.js';

window.addEventListener('unhandledrejection', e => {
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
  // Render nav once into a dedicated slot above main-content
  let navSlot = document.getElementById('nav-slot');
  if (!navSlot) {
    navSlot = document.createElement('div');
    navSlot.id = 'nav-slot';
    document.body.insertBefore(navSlot, document.body.firstChild);
  }
  navSlot.innerHTML = '';
  const nav = await renderAuthButton();
  nav.id = 'site-nav';
  navSlot.appendChild(nav);
}

window.addEventListener('load', async () => {
  await initAppAuth();

  // ── Persistent nav — rendered once, stays across all views ───────────────
  await mountNav();

  // ── Account link verification ─────────────────────────────────────────────
  const params    = new URLSearchParams(window.location.search);
  const linkToken = params.get('link_token');

  if (linkToken) {
    window.history.replaceState({}, '', '/');
    renderLinkVerification(linkToken, async () => {
      const { setUser } = await import('./core/appState.js');
      setUser(undefined);
      await mountNav(); // refresh nav with updated user
      await route();
      renderFooter();
    });
    return;
  }

  // ── Normal auth flow ──────────────────────────────────────────────────────
  const user = await getUser();

  if (user && !user.has_username) {
    renderUsernameInterstitial(async () => {
      await mountNav(); // refresh nav with new username
      await route();
      renderFooter();
    });
    return;
  }

  await route();
  renderFooter();
});
