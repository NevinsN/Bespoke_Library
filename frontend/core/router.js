import { getUser, isAuthor, getNovelsCache } from './appState.js';
import { getNovels } from '../services/novelService.js';
import { redeemInvite } from '../services/authorService.js';
import { renderBookshelf } from '../views/bookshelfView.js';
import { renderReader } from '../views/readerView.js';
import { renderChapterList } from '../views/chapterListView.js';
import { renderAuthorStudio } from '../views/authorStudioView.js';
import { renderHealthDashboard } from '../views/healthView.js';

const PENDING_INVITE_KEY = 'bespoke_pending_invite';

export async function route() {
  const params      = new URLSearchParams(window.location.search);
  const bookId      = params.get('book');
  const chapterId   = params.get('id');
  const studio      = params.get('studio');
  const inviteToken = params.get('invite');
  const health      = params.get('health');

  // ── Health dashboard ───────────────────────────────────────────────────────
  if (health === '1') {
    renderHealthDashboard();
    return;
  }

  // ── Invite redemption ──────────────────────────────────────────────────────
  if (inviteToken) {
    await handleInviteFlow(inviteToken);
    return;
  }

  // Check if we just returned from AAD login with a pending invite
  const pendingInvite = sessionStorage.getItem(PENDING_INVITE_KEY);
  if (pendingInvite) {
    sessionStorage.removeItem(PENDING_INVITE_KEY);
    await handleInviteRedemption(pendingInvite);
    return;
  }

  // ── Studio route ───────────────────────────────────────────────────────────
  if (studio === '1') {
    const user = await getUser();
    if (user) {
      const novels = await getNovelsCache(async () => {
        const res = await getNovels();
        return Array.isArray(res) ? res : (res?.data || []);
      });
      if (isAuthor(novels)) {
        renderAuthorStudio();
        return;
      }
    }
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
    // Not logged in — save token and send through AAD
    sessionStorage.setItem(PENDING_INVITE_KEY, token);
    window.location.href = '/.auth/login/aad?post_login_redirect_uri=/';
    return;
  }

  // Logged in — redeem immediately
  await handleInviteRedemption(token);
}

async function handleInviteRedemption(token) {
  // Clean the URL so reloading doesn't re-trigger
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
    btn.style.display = 'inline-block';
    btn.style.textAlign = 'center';
    btn.style.marginTop = '16px';
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
    btn.style.display = 'inline-block';
    btn.style.textAlign = 'center';
    btn.style.marginTop = '16px';
    btn.textContent = 'Back to Library';
    card.appendChild(btn);
  }
}
