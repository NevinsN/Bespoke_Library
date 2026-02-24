import { createInvite, listInvites, revokeInvite } from '../services/authorService.js';

/**
 * Renders the invite management panel for a given scope.
 * scope: { type: 'series'|'manuscript'|'draft', id: string, label: string }
 */
export async function renderInvitePanel(scope) {
  const panel = document.createElement('div');
  panel.className = 'invite-panel';

  const header = document.createElement('div');
  header.className = 'studio-panel-header';
  header.innerHTML = `<h3>Invite Readers</h3>`;
  panel.appendChild(header);

  const scopeLabel = document.createElement('p');
  scopeLabel.className = 'invite-scope-label';
  scopeLabel.innerHTML = `Scope: <strong>${scope.label}</strong> <span class="invite-scope-type">(${scope.type})</span>`;
  panel.appendChild(scopeLabel);

  // ── Create invite form ──
  panel.appendChild(renderCreateForm(scope, panel));

  // ── Active invites list ──
  const listWrap = document.createElement('div');
  listWrap.className = 'invite-list-wrap';
  panel.appendChild(listWrap);

  await refreshInviteList(scope, listWrap);

  return panel;
}

function renderCreateForm(scope, panel) {
  const form = document.createElement('div');
  form.className = 'invite-form';

  // Expiry selector
  const expiryRow = document.createElement('div');
  expiryRow.className = 'invite-form-row';

  const expiryLabel = document.createElement('label');
  expiryLabel.textContent = 'Expires in';
  expiryLabel.className = 'invite-form-label';

  const expirySelect = document.createElement('select');
  expirySelect.className = 'studio-input invite-select';
  [
    ['1', '1 day'],
    ['3', '3 days'],
    ['7', '7 days'],
    ['14', '14 days'],
    ['30', '30 days'],
  ].forEach(([val, label]) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    if (val === '7') opt.selected = true;
    expirySelect.appendChild(opt);
  });

  expiryRow.appendChild(expiryLabel);
  expiryRow.appendChild(expirySelect);
  form.appendChild(expiryRow);

  // Max uses selector
  const usesRow = document.createElement('div');
  usesRow.className = 'invite-form-row';

  const usesLabel = document.createElement('label');
  usesLabel.textContent = 'Max uses';
  usesLabel.className = 'invite-form-label';

  const usesInput = document.createElement('input');
  usesInput.type = 'number';
  usesInput.className = 'studio-input invite-uses-input';
  usesInput.min = 1;
  usesInput.max = 500;
  usesInput.value = 1;

  usesRow.appendChild(usesLabel);
  usesRow.appendChild(usesInput);
  form.appendChild(usesRow);

  // Generate button
  const generateBtn = document.createElement('button');
  generateBtn.className = 'studio-btn';
  generateBtn.style.marginTop = '12px';
  generateBtn.textContent = 'Generate Invite Link';

  // Result area (shown after generation)
  const resultWrap = document.createElement('div');
  resultWrap.className = 'invite-result';
  resultWrap.style.display = 'none';
  form.appendChild(resultWrap);

  generateBtn.onclick = async () => {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    resultWrap.style.display = 'none';

    try {
      const result = await createInvite({
        scope_type: scope.type,
        scope_id: scope.id,
        expires_days: parseInt(expirySelect.value),
        max_uses: parseInt(usesInput.value),
      });

      resultWrap.style.display = 'block';
      resultWrap.innerHTML = '';

      const urlInput = document.createElement('input');
      urlInput.type = 'text';
      urlInput.className = 'studio-input invite-url-input';
      urlInput.value = result.url;
      urlInput.readOnly = true;
      resultWrap.appendChild(urlInput);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'studio-btn small';
      copyBtn.style.marginTop = '8px';
      copyBtn.textContent = 'Copy Link';
      copyBtn.onclick = async () => {
        await navigator.clipboard.writeText(result.url);
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 2000);
      };
      resultWrap.appendChild(copyBtn);

      // Refresh the active invites list
      const listWrap = panel.querySelector('.invite-list-wrap');
      if (listWrap) await refreshInviteList(scope, listWrap);

    } catch (err) {
      resultWrap.style.display = 'block';
      resultWrap.innerHTML = `<span class="invite-error">${err.message}</span>`;
    }

    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Invite Link';
  };

  form.appendChild(generateBtn);
  return form;
}

async function refreshInviteList(scope, container) {
  container.innerHTML = '';

  let invites = [];
  try {
    invites = await listInvites(scope.type, scope.id);
  } catch {
    return; // Silently skip if list fails
  }

  if (!invites.length) return;

  const heading = document.createElement('p');
  heading.className = 'invite-list-heading';
  heading.textContent = 'Active invite links';
  container.appendChild(heading);

  invites.forEach(inv => {
    const row = document.createElement('div');
    row.className = 'invite-row';

    const info = document.createElement('div');
    info.className = 'invite-row-info';

    const expires = new Date(inv.expires_at);
    const daysLeft = Math.ceil((expires - Date.now()) / 86400000);

    info.innerHTML = `
      <span class="invite-uses">${inv.uses}/${inv.max_uses} uses</span>
      <span class="invite-expiry">Expires in ${daysLeft}d</span>
    `;
    row.appendChild(info);

    const revokeBtn = document.createElement('button');
    revokeBtn.className = 'file-remove-btn';
    revokeBtn.textContent = 'Revoke';
    revokeBtn.onclick = async () => {
      revokeBtn.disabled = true;
      try {
        await revokeInvite(inv.token);
        row.remove();
      } catch (err) {
        revokeBtn.disabled = false;
        revokeBtn.textContent = 'Failed';
      }
    };
    row.appendChild(revokeBtn);

    container.appendChild(row);
  });
}
