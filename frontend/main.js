import { initAppAuth, getUser } from './core/appState.js';
import { route } from './core/router.js';
import { renderFooter } from './components/footer.js';
import { renderNavbar } from './components/navbar.js';
import { renderUsernameInterstitial, renderLinkVerification } from './views/usernameView.js';
import { AuthError } from './core/api.js';
import { loginWithRedirect, isAuthenticated } from './core/auth0Client.js';
import { getUnreadCommentCount } from './services/commentService.js';

window.addEventListener('unhandledrejection', async e => {
  const reason = e.reason;

  // Auth0 SDK throws empty TypeErrors internally on iOS Safari (ITP iframe block).
  if (reason instanceof TypeError && !reason.message) {
    e.preventDefault();
    const authed = await isAuthenticated().catch(() => false);
    if (!authed) loginWithRedirect().catch(() => {});
    return;
  }

  // Session expired — redirect to login
  if (reason instanceof AuthError) {
    e.preventDefault();
    loginWithRedirect().catch(() => {});
    return;
  }

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

// ── Lazy badge — fires after nav is mounted and page is fully ready ───────────
async function refreshCommentBadge() {
  const studioBtn = document.getElementById('nav-studio-btn');
  if (!studioBtn) return;
  try {
    const count = await getUnreadCommentCount();
    studioBtn.querySelector('.comment-badge')?.remove();
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'comment-badge';
      badge.textContent = count > 99 ? '99+' : count;
      studioBtn.style.position = 'relative';
      studioBtn.appendChild(badge);
    }
  } catch {
    // Silent — badge is non-critical
  }
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
      refreshCommentBadge();
    });
    return;
  }

  const user = await getUser();

  // Set authenticated user context for Application Insights
  if (user?.username && window.appInsights) {
    window.appInsights.setAuthenticatedUserContext(user.username);
  }

  // Fire session_start once per browser session
  if (user && !sessionStorage.getItem('bespoke_session_started')) {
    sessionStorage.setItem('bespoke_session_started', '1');
    import('./services/novelService.js').then(({ recordEvent }) => {
      recordEvent('session_start');
    }).catch(() => {});
  }

  if (user && !user.has_username) {
    renderUsernameInterstitial(async () => {
      await mountNav();
      await route();
      renderFooter();
      refreshCommentBadge();
    });
    return;
  }

  await route();
  renderFooter();

  // Lazy-load the comment badge after page is rendered and token is warm
  refreshCommentBadge();
});
