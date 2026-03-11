/**
 * usernameView.js — Blocking username selection interstitial.
 *
 * Shown after login if the user has no username set.
 * Cannot be dismissed — must set a username to proceed.
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
          <input
            class="username-input"
            type="text"
            placeholder="yourname"
            maxlength="20"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
          />
        </div>
        <div class="username-hint">3–20 characters. Letters, numbers, and underscores only.</div>
        <div class="username-status"></div>
      </div>

      <button class="username-submit" disabled>Continue →</button>
      <div class="username-error"></div>
    </div>
  `;

  container.appendChild(wrap);

  const input    = wrap.querySelector('.username-input');
  const status   = wrap.querySelector('.username-status');
  const submitBtn = wrap.querySelector('.username-submit');
  const errorEl  = wrap.querySelector('.username-error');

  const VALID_RE = /^[a-zA-Z0-9_]{3,20}$/;
  let checkTimer = null;
  let lastChecked = '';
  let isAvailable = false;

  async function checkAvailability(username) {
    if (username === lastChecked) return;
    lastChecked = username;

    if (!VALID_RE.test(username)) {
      status.textContent = '';
      status.className = 'username-status';
      submitBtn.disabled = true;
      isAvailable = false;
      return;
    }

    status.textContent = 'Checking…';
    status.className = 'username-status checking';

    try {
      const res = await apiFetch(`/CheckUsername?username=${encodeURIComponent(username)}`);
      if (username !== input.value.trim()) return; // stale

      if (!res.valid) {
        status.textContent = 'Invalid format';
        status.className = 'username-status taken';
        isAvailable = false;
      } else if (res.available) {
        status.textContent = '✓ Available';
        status.className = 'username-status available';
        isAvailable = true;
      } else {
        status.textContent = '✗ Already taken';
        status.className = 'username-status taken';
        isAvailable = false;
      }
    } catch {
      status.textContent = '';
      isAvailable = false;
    }

    submitBtn.disabled = !isAvailable;
  }

  input.addEventListener('input', () => {
    const val = input.value.trim();
    isAvailable = false;
    submitBtn.disabled = true;
    status.textContent = '';
    errorEl.textContent = '';
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

      // Update cached user
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

  // Focus input
  setTimeout(() => input.focus(), 100);
}
