import { initAppAuth, getUser } from './core/appState.js';
import { route } from './core/router.js';
import { renderFooter } from './components/footer.js';
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

window.addEventListener('load', async () => {
  await initAppAuth();

  // ── Account link verification ─────────────────────────────────────────────
  const params     = new URLSearchParams(window.location.search);
  const linkToken  = params.get('link_token');

  if (linkToken) {
    window.history.replaceState({}, '', '/');
    renderLinkVerification(linkToken, async () => {
      // Re-fetch user after linking so new sub/username is loaded
      const { setUser } = await import('./core/appState.js');
      setUser(undefined);
      const user = await getUser();
      await route();
      renderFooter();
    });
    return;
  }

  // ── Normal auth flow ──────────────────────────────────────────────────────
  const user = await getUser();

  if (!user) {
    console.log('Anonymous user — showing public content.');
  } else {
    console.log(`Logged in as: ${user.username || '(no username yet)'}`);

    if (!user.has_username) {
      renderUsernameInterstitial(async () => {
        await route();
        renderFooter();
      });
      return;
    }
  }

  await route();
  renderFooter();
});
