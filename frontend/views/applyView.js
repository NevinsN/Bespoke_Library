/**
 * applyView.js — Author application form.
 * Accessible at /?apply=1
 * Available to logged-out users and logged-in readers.
 * Hidden from admins and existing authors.
 */

import { apiFetch } from '../core/api.js';
import { getUser } from '../core/appState.js';

export async function renderApplyView() {
  const container = document.getElementById('main-content');
  container.innerHTML = '';

  const user = await getUser();

  const wrap = document.createElement('div');
  wrap.className = 'apply-wrap';
  container.appendChild(wrap);

  // Header
  wrap.innerHTML = `
    <div class="apply-header">
      <h1>Apply to be an Author</h1>
      <p class="apply-subtitle">
        Bespoke Library is an invite-only platform for serious writers. Tell us about yourself
        and what you're working on — we read every application.
      </p>
    </div>
  `;

  renderForm(wrap, user);
}

function renderForm(wrap, user) {
  const form = document.createElement('div');
  form.className = 'apply-form';

  form.innerHTML = `
    <div class="apply-field">
      <label class="apply-label">Your name <span class="apply-required">*</span></label>
      <input class="apply-input" id="apply-name" type="text"
        placeholder="Full name or pen name" maxlength="128" />
    </div>

    <div class="apply-field">
      <label class="apply-label">Email address <span class="apply-required">*</span></label>
      <input class="apply-input" id="apply-email" type="email"
        placeholder="we'll use this to contact you"
        value="${user ? '' : ''}" maxlength="256" />
      ${user ? '<p class="apply-hint">We\'ll contact you at the email on your account unless you specify another.</p>' : ''}
    </div>

    <div class="apply-field">
      <label class="apply-label">
        Background <span class="apply-required">*</span>
      </label>
      <p class="apply-hint">Tell us about yourself as a writer. Experience, influences, how long you've been writing.</p>
      <textarea class="apply-textarea" id="apply-background"
        placeholder="I've been writing fiction for..." rows="5" maxlength="2000"></textarea>
      <div class="apply-char-count" id="apply-background-count">0 / 2000</div>
    </div>

    <div class="apply-field">
      <label class="apply-label">
        Your project <span class="apply-required">*</span>
      </label>
      <p class="apply-hint">What are you working on? Genre, premise, where you are in the process.</p>
      <textarea class="apply-textarea" id="apply-project"
        placeholder="I'm writing a..." rows="5" maxlength="2000"></textarea>
      <div class="apply-char-count" id="apply-project-count">0 / 2000</div>
    </div>

    <div class="apply-field">
      <label class="apply-label">Links <span class="apply-muted">(optional)</span></label>
      <p class="apply-hint">Portfolio, published work, social profiles, anything that helps us understand your writing.</p>
      <input class="apply-input" id="apply-links" type="text"
        placeholder="https://..." maxlength="500" />
    </div>

    <div class="apply-error" id="apply-error"></div>

    <button class="apply-submit" id="apply-submit">Submit Application</button>
  `;

  wrap.appendChild(form);

  // Character counters
  const backgroundEl = form.querySelector('#apply-background');
  const projectEl    = form.querySelector('#apply-project');

  backgroundEl.addEventListener('input', () => {
    form.querySelector('#apply-background-count').textContent =
      `${backgroundEl.value.length} / 2000`;
  });

  projectEl.addEventListener('input', () => {
    form.querySelector('#apply-project-count').textContent =
      `${projectEl.value.length} / 2000`;
  });

  // Submit
  form.querySelector('#apply-submit').addEventListener('click', () =>
    handleSubmit(form, wrap)
  );
}

async function handleSubmit(form, wrap) {
  const name        = form.querySelector('#apply-name').value.trim();
  const email       = form.querySelector('#apply-email').value.trim();
  const background  = form.querySelector('#apply-background').value.trim();
  const project     = form.querySelector('#apply-project').value.trim();
  const links       = form.querySelector('#apply-links').value.trim();
  const errorEl     = form.querySelector('#apply-error');
  const submitBtn   = form.querySelector('#apply-submit');

  errorEl.textContent = '';

  // Validation
  if (!name)       { errorEl.textContent = 'Name is required.'; return; }
  if (!email || !email.includes('@')) {
    errorEl.textContent = 'A valid email is required.'; return;
  }
  if (background.length < 50) {
    errorEl.textContent = 'Please tell us a bit more about your background (at least 50 characters).'; return;
  }
  if (project.length < 50) {
    errorEl.textContent = 'Please tell us a bit more about your project (at least 50 characters).'; return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  try {
    await apiFetch('/SubmitApplication', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, email, background,
        project_description: project,
        links,
      }),
    });

    // Success state
    form.remove();
    const success = document.createElement('div');
    success.className = 'apply-success';
    success.innerHTML = `
      <div class="apply-success-icon">✓</div>
      <h2>Application received</h2>
      <p>Thanks, ${name}. We'll review your application and be in touch at ${email}.</p>
      <a href="/" class="apply-back-link">← Back to Library</a>
    `;
    wrap.appendChild(success);

  } catch (err) {
    errorEl.textContent = err.message || 'Something went wrong. Please try again.';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Application';
  }
}
