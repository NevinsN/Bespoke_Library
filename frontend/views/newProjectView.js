/**
 * newProjectView.js — First project onboarding for newly approved authors.
 * Accessible at /?newproject=1
 * Only shown to is_author users who have no manuscripts yet.
 * After project creation they are redirected to Studio.
 */

import { apiFetch } from '../core/api.js';
import { getUser } from '../core/appState.js';

export async function renderNewProjectView() {
  const container = document.getElementById('main-content');
  container.innerHTML = '';

  const user = await getUser();

  const wrap = document.createElement('div');
  wrap.className = 'newproject-wrap';
  container.appendChild(wrap);

  wrap.innerHTML = `
    <div class="newproject-header">
      <div class="newproject-welcome">Welcome, @${user?.username || 'Author'}</div>
      <h1>Create Your First Project</h1>
      <p class="newproject-subtitle">
        Set up your manuscript and you'll have full access to the Author Studio
        where you can upload chapters, manage drafts, and invite readers.
      </p>
    </div>

    <div class="newproject-form">
      <div class="newproject-field">
        <label class="newproject-label">
          Series name
          <span class="newproject-hint-inline">— leave as "Standalone" if this isn't part of a series</span>
        </label>
        <input class="newproject-input" id="np-series" type="text"
          value="Standalone" maxlength="128" />
      </div>

      <div class="newproject-field">
        <label class="newproject-label">
          Book title <span class="newproject-required">*</span>
        </label>
        <input class="newproject-input" id="np-book" type="text"
          placeholder="e.g. The Strange Case of Dr. Jekyll and Mr. Hyde"
          maxlength="200" />
      </div>

      <div class="newproject-field">
        <label class="newproject-label">
          First draft name
          <span class="newproject-hint-inline">— you can rename this later</span>
        </label>
        <input class="newproject-input" id="np-draft" type="text"
          value="Draft One" maxlength="100" />
      </div>

      <div class="newproject-error" id="np-error"></div>

      <button class="newproject-submit" id="np-submit">
        Create Project &amp; Open Studio &rarr;
      </button>
    </div>
  `;

  wrap.querySelector('#np-submit').addEventListener('click', () =>
    handleCreate(wrap)
  );
}

async function handleCreate(wrap) {
  const series   = wrap.querySelector('#np-series').value.trim() || 'Standalone';
  const book     = wrap.querySelector('#np-book').value.trim();
  const draft    = wrap.querySelector('#np-draft').value.trim() || 'Draft One';
  const errorEl  = wrap.querySelector('#np-error');
  const submitBtn = wrap.querySelector('#np-submit');

  errorEl.textContent = '';

  if (!book) {
    errorEl.textContent = 'Book title is required.';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating\u2026';

  try {
    await apiFetch('/CreateProject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        series_name:  series,
        book:         book,
        draft_name:   draft,
        display_name: book,
      }),
    });

    // Clear novels cache so Studio loads fresh
    const { invalidateNovels } = await import('../core/appState.js');
    invalidateNovels();

    // Head to Studio
    window.location.href = '/?studio=1';

  } catch (err) {
    errorEl.textContent = err.message || 'Something went wrong. Please try again.';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Project & Open Studio \u2192';
  }
}
