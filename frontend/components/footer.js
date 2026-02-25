import { getUser, getNovelsMeta } from '../core/appState.js';

/**
 * renderFooter()
 *
 * Renders into #site-footer — always present in the DOM.
 * Links shown depend on user role:
 *
 * All users:        About · nicholasnevins.org
 * Logged-out:       Apply to be an Author
 * Logged-in reader: Apply to be an Author
 * Author/Owner:     (no apply link — they already have access)
 * Admin:            Admin Panel
 */
export async function renderFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return;

  const user  = await getUser();
  const meta  = getNovelsMeta();
  const isAdmin  = !!meta?.is_admin;

  // Determine if user is already an author — if so, hide the apply link
  // This will be replaced with a proper API check once author applications exist
  const isAuthorOrAbove = isAdmin; // expand this when author grants are queryable

  footer.innerHTML = '';

  const inner = document.createElement('div');
  inner.className = 'footer-inner';

  // ── Left: branding / back to portfolio ────────────────────────────────────
  const left = document.createElement('div');
  left.className = 'footer-left';
  left.innerHTML = `
    <a href="https://nicholasnevins.org" class="footer-link" target="_blank" rel="noopener">
      nicholasnevins.org
    </a>
  `;
  inner.appendChild(left);

  // ── Center: status indicator ──────────────────────────────────────────────
  const center = document.createElement('div');
  center.className = 'footer-center';
  center.innerHTML = `
    <span class="footer-status" id="footer-status">
      <span class="footer-status-dot"></span>
      <span class="footer-status-text">Checking status...</span>
    </span>
  `;
  inner.appendChild(center);

  // ── Right: contextual links ───────────────────────────────────────────────
  const right = document.createElement('div');
  right.className = 'footer-right';

  if (isAdmin) {
    // Admin panel link — placeholder until admin panel is built
    const adminLink = document.createElement('a');
    adminLink.href = '/?admin=1';
    adminLink.className = 'footer-link footer-link-muted';
    adminLink.textContent = 'Admin Panel';
    right.appendChild(adminLink);
  } else if (!isAuthorOrAbove) {
    // Apply to be an author — shown to readers and logged-out users
    const applyLink = document.createElement('a');
    applyLink.href = '/?apply=1';
    applyLink.className = 'footer-link';
    applyLink.textContent = 'Apply to be an Author';
    right.appendChild(applyLink);
  }

  inner.appendChild(right);
  footer.appendChild(inner);

  // ── Live status ping ──────────────────────────────────────────────────────
  loadFooterStatus();
}

async function loadFooterStatus() {
  const dot  = document.getElementById('footer-status')?.querySelector('.footer-status-dot');
  const text = document.getElementById('footer-status')?.querySelector('.footer-status-text');
  if (!dot || !text) return;

  try {
    const res    = await fetch('https://bespoke-library.onrender.com/api/Health?source=footer');
    const data   = await res.json();
    const status = data?.data?.status;

    if (status === 'ok') {
      dot.style.background  = 'var(--success-color)';
      dot.style.boxShadow   = '0 0 5px var(--success-color)';
      text.textContent      = 'All systems operational';
    } else {
      dot.style.background  = '#f39c12';
      dot.style.boxShadow   = '0 0 5px #f39c12';
      text.textContent      = 'Degraded';
    }
  } catch {
    dot.style.background    = 'var(--error-color)';
    dot.style.boxShadow     = '0 0 5px var(--error-color)';
    text.textContent        = 'Service unavailable';
  }
}
