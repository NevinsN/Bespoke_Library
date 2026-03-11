/**
 * usernameView.js — Username selection + account linking interstitial.
 */

import { apiFetch } from '../core/api.js';
import { setUser, getCachedUser } from '../core/appState.js';

export function renderUsernameInterstitial(onComplete) {
  const container = document.getElementById('main-content');
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'username-interstitial';
  wrap.innerHTML = `
    <div class="username-card">
      <div class="username-icon">📖</div>
      <h1 class="username-title">Welcome to Bespoke Library</h1>
      <p class="username-subtitle">Choose a username to get started. This is how authors and other readers will know you.</p>

      <div class="username-field">
        <div class="username-input-wrap">
          <span class="username-prefix">@</span>
          <input class="username-input" type="text" placeholder="yourname"
            maxlength="20" autocomplete="off" autocorrect="off"
            autocapitalize="off" spellcheck="false" />
        </div>
        <div class="username-hint">3–20 characters. Letters, numbers, and underscores only.</div>
        <div class="username-status"></div>
      </div>

      <button class="username-submit" disabled>Continue →</button>

      <div class="username-link-offer" style="display:none;">
        <p class="username-link-text">Already have an account with this username?</p>
        <button class="username-link-btn">Link my accounts →</button>
      </div>

      <div class="username-link-sent" style="display:none;">
        <div class="username-link-sent-icon">✉️</div>
        <p class="username-link-sent-text">Check your email — we've sent a verification link to the address on your existing account.</p>
        <p class="username-link-sent-sub">Once verified, log in again to continue.</p>
      </div>

      <div class="username-error"></div>
    </div>
  `;

  container.appendChild(wrap);

  const input       = wrap.querySelector('.username-input');
  const status      = wrap.querySelector('.username-status');
  const submitBtn   = wrap.querySelector('.username-submit');
  const errorEl     = wrap.querySelector('.username-error');
  const linkOffer   = wrap.querySelector('.username-link-offer');
  const linkBtn     = wrap.querySelector('.username-link-btn');
  const linkSent    = wrap.querySelector('.username-link-sent');

  const VALID_RE = /^[a-zA-Z0-9_]{3,20}$/;
  let checkTimer   = null;
  let lastChecked  = '';
  let isAvailable  = false;
  let isTaken      = false;

  async function checkAvailability(username) {
    if (username === lastChecked) return;
    lastChecked = username;

    if (!VALID_RE.test(username)) {
      status.textContent = '';
      status.className = 'username-status';
      submitBtn.disabled = true;
      linkOffer.style.display = 'none';
      isAvailable = false;
      isTaken = false;
      return;
    }

    status.textContent = 'Checking…';
    status.className = 'username-status checking';
    linkOffer.style.display = 'none';

    try {
      const res = await apiFetch(`/CheckUsername?username=${encodeURIComponent(username)}`);
      if (username !== input.value.trim()) return;

      if (!res.valid) {
        status.textContent = 'Invalid format';
        status.className = 'username-status taken';
        isAvailable = false;
        isTaken = false;
      } else if (res.available) {
        status.textContent = '✓ Available';
        status.className = 'username-status available';
        isAvailable = true;
        isTaken = false;
        linkOffer.style.display = 'none';
      } else {
        status.textContent = '✗ Already taken';
        status.className = 'username-status taken';
        isAvailable = false;
        isTaken = true;
        linkOffer.style.display = 'block';
      }
    } catch {
      status.textContent = '';
      isAvailable = false;
      isTaken = false;
    }

    submitBtn.disabled = !isAvailable;
  }

  input.addEventListener('input', () => {
    const val = input.value.trim();
    isAvailable = false;
    isTaken = false;
    submitBtn.disabled = true;
    status.textContent = '';
    errorEl.textContent = '';
    linkOffer.style.display = 'none';
    clearTimeout(checkTimer);
    if (val.length >= 3) {
      checkTimer = setTimeout(() => checkAvailability(val), 400);
    }
  });

  submitBtn.addEventListener('click', async () => {
    const username = input.value.trim();
    if (!username || !isAvailable) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';
    errorEl.textContent = '';

    try {
      await apiFetch('/SetUsername', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const user = getCachedUser();
      if (user) {
        user.username     = username;
        user.has_username = true;
        setUser(user);
      }

      onComplete();
    } catch (err) {
      errorEl.textContent = err.message || 'Something went wrong. Please try again.';
      submitBtn.disabled  = false;
      submitBtn.textContent = 'Continue →';
    }
  });

  linkBtn.addEventListener('click', async () => {
    const username = input.value.trim();
    if (!username || !isTaken) return;

    linkBtn.disabled = true;
    linkBtn.textContent = 'Sending…';
    errorEl.textContent = '';

    try {
      await apiFetch('/RequestAccountLink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      linkOffer.style.display = 'none';
      linkSent.style.display  = 'block';
      input.disabled          = true;
      submitBtn.style.display = 'none';
    } catch (err) {
      errorEl.textContent = err.message || 'Failed to send verification email.';
      linkBtn.disabled    = false;
      linkBtn.textContent = 'Link my accounts →';
    }
  });

  setTimeout(() => input.focus(), 100);
}


export function renderLinkVerification(token, onComplete) {
  const container = document.getElementById('main-content');
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'username-interstitial';
  wrap.innerHTML = `
    <div class="username-card">
      <div class="username-icon">🔗</div>
      <h1 class="username-title">Linking your accounts…</h1>
      <p class="username-subtitle" id="link-status-msg">Please wait.</p>
    </div>
  `;
  container.appendChild(wrap);

  const msg = wrap.querySelector('#link-status-msg');

  apiFetch(`/VerifyAccountLink?token=${encodeURIComponent(token)}`)
    .then(res => {
      msg.textContent = `Done! Your accounts are linked as @${res.username}. Redirecting…`;
      setTimeout(() => {
        window.history.replaceState({}, '', '/');
        onComplete();
      }, 1500);
    })
    .catch(err => {
      wrap.querySelector('.username-icon').textContent = '⚠️';
      wrap.querySelector('.username-title').textContent = 'Link failed';
      msg.textContent = err.message || 'This link is invalid or has expired.';
    });
}
