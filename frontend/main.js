import { getUser } from './core/appState.js';
import { route } from './core/router.js';
import { renderFooter } from './components/footer.js';

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
  // ── Warmup check ─────────────────────────────────────────────────────────
  // Render free tier cold starts take 30–60s. Show a message while waiting.
  const warmupBanner = document.createElement('div');
  warmupBanner.id = 'warmup-banner';
  warmupBanner.innerHTML = `
    <div class="warmup-spinner"></div>
    <p>Loading the library&hellip;</p>
  `;
  document.getElementById('main-content').appendChild(warmupBanner);

  const API = 'https://bespoke-api.nicholasnevins.org/api/Health';
  const waitForBackend = async () => {
    for (let i = 0; i < 24; i++) { // max ~2 min
      try {
        const r = await fetch(API + '?source=warmup', { cache: 'no-store' });
        if (r.ok) return true;
      } catch (_) {}
      await new Promise(r => setTimeout(r, 5000));
    }
    return false;
  };

  const ready = await waitForBackend();
  warmupBanner.remove();
  if (!ready) {
    const errEl = document.createElement('div');
    errEl.className = 'empty-library';
    errEl.textContent = 'The library is taking longer than usual to start. Please refresh.';
    document.getElementById('main-content').appendChild(errEl);
    return;
  }
  // ── End warmup check ─────────────────────────────────────────────────────

  const user = await getUser();

  if (!user) {
    console.log('Anonymous user — showing public content.');
  } else {
    console.log(`Logged in as: ${user.userDetails}`);
  }

  // Route first so content loads, then render footer
  await route();
  renderFooter(); // Non-blocking — footer loads after main content
});
