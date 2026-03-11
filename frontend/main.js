import { initAppAuth, getUser } from './core/appState.js';
import { route } from './core/router.js';
import { renderFooter } from './components/footer.js';
import { renderUsernameInterstitial } from './views/usernameView.js';

// Global error boundary
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
  // ── Init Auth0 (handles redirect callback if returning from login) ─────────
  await initAppAuth();

  const user = await getUser();

  if (!user) {
    console.log('Anonymous user — showing public content.');
  } else {
    console.log(`Logged in as: ${user.username || '(no username yet)'}`);

    // ── Username interstitial — blocks until username is set ────────────────
    if (!user.has_username) {
      renderUsernameInterstitial(async () => {
        // Username set — proceed to normal app
        await route();
        renderFooter();
      });
      return;
    }
  }

  await route();
  renderFooter();
});
