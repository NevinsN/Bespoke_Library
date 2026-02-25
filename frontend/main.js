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
