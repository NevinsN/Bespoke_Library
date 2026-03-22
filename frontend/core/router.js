import { getUser, isAuthor, getNovelsCache } from './appState.js';
import { getNovels } from '../services/novelService.js';
import { redeemInvite } from '../services/authorService.js';
import { renderBookshelf } from '../views/bookshelfView.js';
import { renderReader } from '../views/readerView.js';
import { renderChapterList } from '../views/chapterListView.js';
import { renderAuthorStudio } from '../views/authorStudioView.js';
import { renderHealthDashboard } from '../views/healthView.js';
import { renderApplyView } from '../views/applyView.js';
import { renderProfileView } from '../views/profileView.js';
import { renderNewProjectView } from '../views/newProjectView.js';

const PENDING_INVITE_KEY        = 'bespoke_pending_invite';
const PENDING_AUTHOR_INVITE_KEY = 'bespoke_pending_author_invite';

export async function route() {
  const params           = new URLSearchParams(window.location.search);
  const bookId           = params.get('book');
  const chapterId        = params.get('id');
  const studio           = params.get('studio');
  const action           = params.get('action');
  const inviteToken      = params.get('invite');
  const health           = params.get('health');
  const admin            = params.get('admin');
  const apply            = params.get('apply');
  const profile          = params.get('profile');
  const newproject       = params.get('newproject');
  const authorInvite     = params.get('author_invite');

  // ── Health dashboard ───────────────────────────────────────────────────────
  if (health === '1') {
    renderHealthDashboard();
    return;
  }

  // ── Admin panel ────────────────────────────────────────────────────────────
  if (admin === '1') {
    const user = await getUser();
    if (user?.is_admin) {
      const { renderAdminPanel } = await import('../views/adminView.js');
      renderAdminPanel();
    } else {
      renderBookshelf();
    }
    return;
  }

  // ── Author application ─────────────────────────────────────────────────────
  if (apply === '1') {
    renderApplyView();
    return;
  }

  // Reader profile
  if (profile === '1') {
    const user = await getUser();
    if (user) {
      renderProfileView();
    } else {
      renderBookshelf();
    }
    return;
  }

  // New author first project onboarding
  if (newproject === '1') {
    const user = await getUser();
    if (user?.is_author) {
      renderNewProjectView();
    } else {
      renderBookshelf();
    }
    return;
  }

  // ── Invite redemption ──────────────────────────────────────────────────────
  if (inviteToken) {
    await handleInviteFlow(inviteToken);
    return;
  }

  // Check for pending invite after Auth0 redirect
  const pendingInvite = sessionStorage.getItem(PENDING_INVITE_KEY);
  if (pendingInvite) {
    sessionStorage.removeItem(PENDING_INVITE_KEY);
    await handleInviteRedemption(pendingInvite);
    return;
  }

  // Check for pending author invite after Auth0 redirect
  const pendingAuthorInvite = sessionStorage.getItem(PENDING_AUTHOR_INVITE_KEY);
  if (pendingAuthorInvite) {
    sessionStorage.removeItem(PENDING_AUTHOR_INVITE_KEY);
    await handleAuthorInviteRedemption(pendingAuthorInvite);
    return;
  }

  // Author invite link — /?author_invite=TOKEN
  if (authorInvite) {
    await handleAuthorInviteFlow(authorInvite);
    return;
  }

  // ── Studio route ───────────────────────────────────────────────────────────
  if (studio === '1') {
    const user = await getUser();
    if (user) {
      renderAuthorStudio({ openNewForm: action === 'new' });
      return;
    }
    const { loginWithRedirect } = await import('../core/auth0Client.js');
    await loginWithRedirect();
    return;
  }

  // ── Standard routes ────────────────────────────────────────────────────────
  if (chapterId) { renderReader(chapterId); return; }
  if (bookId)    { renderChapterList(bookId); return; }
  renderBookshelf();
}

// ─── Invite flow ──────────────────────────────────────────────────────────────
async function handleInviteFlow(token) {
  const user = await getUser();

  if (!user) {
    // Not logged in — save token and redirect to login
    sessionStorage.setItem(PENDING_INVITE_KEY, token);
    const { loginWithRedirect } = await import('../core/auth0Client.js');
    await loginWithRedirect();
    return;
  }

  await handleInviteRedemption(token);
}

async function handleInviteRedemption(token) {
  window.history.replaceState({}, '', '/');

  const container = document.getElementById('main-content');
  container.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'invite-card';
  container.appendChild(card);

  const spinner = document.createElement('div');
  spinner.className = 'invite-spinner';
  spinner.textContent = 'Redeeming your invite...';
  card.appendChild(spinner);

  try {
    const grant = await redeemInvite(token);

    card.innerHTML = '';
    const icon = document.createElement('div');
    icon.className = 'invite-icon success';
    icon.textContent = '✓';
    card.appendChild(icon);

    const msg = document.createElement('p');
    msg.className = 'invite-msg';
    msg.textContent = `Access granted! You now have reader access to this ${grant.scope_type}.`;
    card.appendChild(msg);

    const btn = document.createElement('a');
    btn.href = '/';
    btn.className = 'studio-btn';
    btn.style.cssText = 'display:inline-block;text-align:center;margin-top:16px;';
    btn.textContent = 'Go to Library →';
    card.appendChild(btn);

  } catch (err) {
    card.innerHTML = '';
    const icon = document.createElement('div');
    icon.className = 'invite-icon error';
    icon.textContent = '✕';
    card.appendChild(icon);

    const msg = document.createElement('p');
    msg.className = 'invite-msg';
    msg.textContent = err.message || 'This invite link is invalid or has expired.';
    card.appendChild(msg);

    const btn = document.createElement('a');
    btn.href = '/';
    btn.className = 'studio-btn';
    btn.style.cssText = 'display:inline-block;text-align:center;margin-top:16px;';
    btn.textContent = 'Back to Library';
    card.appendChild(btn);
  }
}

// ─── Author invite flow ───────────────────────────────────────────────────────

async function handleAuthorInviteFlow(token) {
  const user = await getUser();
  if (!user) {
    // Not logged in — save token and send to login
    sessionStorage.setItem(PENDING_AUTHOR_INVITE_KEY, token);
    const { loginWithRedirect } = await import('../core/auth0Client.js');
    await loginWithRedirect();
    return;
  }
  await handleAuthorInviteRedemption(token);
}

async function handleAuthorInviteRedemption(token) {
  window.history.replaceState({}, '', '/');

  const container = document.getElementById('main-content');
  container.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'invite-card';
  container.appendChild(card);

  const spinner = document.createElement('div');
  spinner.className = 'invite-spinner';
  spinner.textContent = 'Activating your author account…';
  card.appendChild(spinner);

  try {
    const { apiFetch } = await import('../core/api.js');
    await apiFetch('/RedeemAuthorInvite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    card.innerHTML = '';

    const icon = document.createElement('div');
    icon.className = 'invite-icon success';
    icon.textContent = '✓';
    card.appendChild(icon);

    const msg = document.createElement('p');
    msg.className = 'invite-msg';
    msg.textContent = 'Author account activated! Create your first project to get started.';
    card.appendChild(msg);

    const btn = document.createElement('a');
    btn.href = '/?newproject=1';
    btn.className = 'studio-btn';
    btn.style.cssText = 'display:inline-block;text-align:center;margin-top:16px;';
    btn.textContent = 'Create Your First Project →';
    card.appendChild(btn);

  } catch (err) {
    card.innerHTML = '';

    const icon = document.createElement('div');
    icon.className = 'invite-icon error';
    icon.textContent = '✕';
    card.appendChild(icon);

    const msg = document.createElement('p');
    msg.className = 'invite-msg';
    msg.textContent = err.message || 'This invite link is invalid, expired, or has already been used.';
    card.appendChild(msg);

    const btn = document.createElement('a');
    btn.href = '/';
    btn.className = 'studio-btn';
    btn.style.cssText = 'display:inline-block;text-align:center;margin-top:16px;';
    btn.textContent = 'Back to Library';
    card.appendChild(btn);
  }
}
