/**
 * adminView.js — Admin panel.
 * Tabs: Overview · Users · Applications · Manuscripts · Invites · Messages · Audit Log · Health
 */

import { apiFetch } from '../core/api.js';
import { renderSpinner } from '../components/loading.js';

const TABS = [
  { id: 'overview',      label: 'Overview'      },
  { id: 'users',         label: 'Users'         },
  { id: 'applications',  label: 'Applications'  },
  { id: 'manuscripts',   label: 'Manuscripts'   },
  { id: 'invites',       label: 'Invites'       },
  { id: 'messages',      label: 'Messages'      },
  { id: 'audit',         label: 'Audit Log'     },
];

let _activeTab = 'overview';

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function renderAdminPanel() {
  const container = document.getElementById('main-content');
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'admin-wrap';
  container.appendChild(wrap);

  // Header
  const header = document.createElement('div');
  header.className = 'admin-header';
  header.innerHTML = `
    <h1>Admin Panel</h1>
    <p class="admin-subtitle">Platform management and analytics</p>
  `;
  wrap.appendChild(header);

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.className = 'admin-tab-bar';
  wrap.appendChild(tabBar);

  // Tab content area
  const tabContent = document.createElement('div');
  tabContent.className = 'admin-tab-content';
  wrap.appendChild(tabContent);

  // Render tabs
  TABS.forEach(tab => {
    const btn = document.createElement('button');
    btn.className = 'admin-tab-btn' + (tab.id === _activeTab ? ' active' : '');
    btn.textContent = tab.label;
    btn.id = `admin-tab-${tab.id}`;
    btn.onclick = () => switchTab(tab.id, tabBar, tabContent);
    tabBar.appendChild(btn);
  });

  // Load initial tab
  await loadTab(_activeTab, tabContent);
}

function switchTab(tabId, tabBar, tabContent) {
  _activeTab = tabId;
  tabBar.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.id === `admin-tab-${tabId}`);
  });
  loadTab(tabId, tabContent);
}

async function loadTab(tabId, tabContent) {
  tabContent.innerHTML = '';
  renderSpinner(tabContent, 'Loading...');
  try {
    switch (tabId) {
      case 'overview':     await renderOverview(tabContent);     break;
      case 'users':        await renderUsers(tabContent);        break;
      case 'applications': await renderApplications(tabContent); break;
      case 'manuscripts':  await renderManuscripts(tabContent);  break;
      case 'invites':      await renderInvites(tabContent);      break;
      case 'messages':     await renderMessages(tabContent);     break;
      case 'audit':        await renderAuditLog(tabContent);     break;
    }
  } catch (e) {
    tabContent.innerHTML = `<div class="admin-error">Failed to load: ${e.message}</div>`;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function adminFetch(endpoint, options) {
  return apiFetch(`/admin/${endpoint}`, options);
}

function showBanner(container, message, type = 'success') {
  const b = document.createElement('div');
  b.className = `admin-banner ${type}`;
  b.textContent = message;
  container.prepend(b);
  setTimeout(() => b.remove(), 3000);
}

function makeTable(columns, rows, rowRenderer) {
  const table = document.createElement('table');
  table.className = 'admin-table';
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr>`;
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  rows.forEach(row => {
    const tr = rowRenderer(row);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Overview ─────────────────────────────────────────────────────────────────

async function renderOverview(container) {
  const [stats, chartData] = await Promise.all([
    adminFetch('Stats?days=30'),
    adminFetch('EventsByDay?event_type=chapter_opened&days=30'),
  ]);

  container.innerHTML = '';

  // Stat cards
  const cards = document.createElement('div');
  cards.className = 'admin-stat-cards';

  const statDefs = [
    { label: 'Total Users',        value: stats.total_users,         accent: false },
    { label: 'Active Readers',     value: stats.active_readers,      accent: true  },
    { label: 'Chapters Opened',    value: stats.chapters_opened,     accent: false },
    { label: 'Chapters Completed', value: stats.chapters_completed,  accent: false },
    { label: 'Rereads',            value: stats.chapters_reread,     accent: false },
    { label: 'Comments',           value: stats.comments_created,    accent: false },
    { label: 'Invites Redeemed',   value: stats.invites_redeemed,    accent: false },
    { label: 'New Registrations',  value: stats.new_registrations,   accent: false },
    { label: 'Sessions',           value: stats.sessions,            accent: false },
    { label: 'Drafts Published',   value: stats.drafts_published,    accent: false },
  ];

  statDefs.forEach(s => {
    const card = document.createElement('div');
    card.className = 'admin-stat-card' + (s.accent ? ' accent' : '');
    card.innerHTML = `
      <div class="admin-stat-value">${s.value ?? 0}</div>
      <div class="admin-stat-label">${s.label}</div>
      <div class="admin-stat-period">Last 30 days</div>
    `;
    cards.appendChild(card);
  });
  container.appendChild(cards);

  // Chart
  const chartWrap = document.createElement('div');
  chartWrap.className = 'admin-chart-wrap';
  chartWrap.innerHTML = `
    <div class="admin-section-header">
      <h3>Chapter Reads — Last 30 Days</h3>
    </div>
    <canvas id="admin-reads-chart" height="80"></canvas>
  `;
  container.appendChild(chartWrap);

  // Load Chart.js and render
  await loadChartJs();
  const labels = chartData.map(r => {
    // Postgres returns date as "2026-03-22" or full ISO — parse safely
    const raw = r.date || r.full_date || '';
    const parts = String(raw).slice(0, 10).split('-');
    if (parts.length === 3) return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    const d = new Date(raw);
    return isNaN(d) ? raw : `${d.getUTCMonth()+1}/${d.getUTCDate()}`;
  });
  const values = chartData.map(r => r.count);

  const ctx = document.getElementById('admin-reads-chart').getContext('2d');
  new window.Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Chapters Read',
        data: values,
        borderColor: '#3498db',
        backgroundColor: 'rgba(52,152,219,0.08)',
        borderWidth: 2,
        pointRadius: 3,
        tension: 0.3,
        fill: true,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#888', maxTicksLimit: 10 }, grid: { color: '#222' } },
        y: { ticks: { color: '#888' }, grid: { color: '#222' }, beginAtZero: true },
      }
    }
  });
}

async function loadChartJs() {
  if (window.Chart) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Chart.js'));
    document.head.appendChild(s);
  });
}

// ─── Users ────────────────────────────────────────────────────────────────────

async function renderUsers(container) {
  const users = await adminFetch('Users');
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'admin-section-header';
  header.innerHTML = `<h3>All Users <span class="admin-count">${users.length}</span></h3>`;
  container.appendChild(header);

  if (!users.length) {
    container.innerHTML += '<div class="admin-empty">No users found.</div>';
    return;
  }

  const table = makeTable(
    ['Username', 'Auth0 Sub', 'Registered', 'Admin', 'Suspended', 'Actions'],
    users,
    user => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${user.username || '<em>no username</em>'}</strong></td>
        <td class="admin-sub">${user.auth0_sub}</td>
        <td>${fmtDate(user.registered_at)}</td>
        <td>${user.is_admin ? '✓' : '—'}</td>
        <td>${user.suspended ? '<span class="admin-badge warn">Suspended</span>' : '—'}</td>
        <td></td>
      `;
      const actions = tr.querySelector('td:last-child');

      const suspendBtn = document.createElement('button');
      suspendBtn.className = 'admin-action-btn';
      suspendBtn.textContent = user.suspended ? 'Unsuspend' : 'Suspend';
      suspendBtn.onclick = async () => {
        try {
          await adminFetch('SuspendUser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.auth0_sub, suspended: !user.suspended }),
          });
          showBanner(container, `User ${user.suspended ? 'unsuspended' : 'suspended'}.`);
          await renderUsers(container);
        } catch (e) { showBanner(container, e.message, 'error'); }
      };
      actions.appendChild(suspendBtn);
      return tr;
    }
  );
  container.appendChild(table);
}

// ─── Applications ─────────────────────────────────────────────────────────────

async function renderApplications(container) {
  const apps = await adminFetch('Applications');
  container.innerHTML = '';

  const pending  = apps.filter(a => a.status === 'pending');
  const reviewed = apps.filter(a => a.status !== 'pending');

  const header = document.createElement('div');
  header.className = 'admin-section-header';
  header.innerHTML = `
    <h3>Author Applications
      ${pending.length ? `<span class="admin-badge accent">${pending.length} pending</span>` : ''}
    </h3>
  `;
  container.appendChild(header);

  if (!apps.length) {
    container.innerHTML += '<div class="admin-empty">No applications yet.</div>';
    return;
  }

  // Pending first
  [...pending, ...reviewed].forEach(app => {
    const card = document.createElement('div');
    card.className = `admin-app-card ${app.status}`;
    card.innerHTML = `
      <div class="admin-app-header">
        <strong>${app.name}</strong>
        <span class="admin-badge ${app.status}">${app.status}</span>
        <span class="admin-app-date">${fmtDate(app.created_at)}</span>
      </div>
      <div class="admin-app-email">${app.email}</div>
      <div class="admin-app-section"><strong>Background</strong><p>${app.background}</p></div>
      <div class="admin-app-section"><strong>Project</strong><p>${app.project_desc}</p></div>
      ${app.links ? `<div class="admin-app-section"><strong>Links</strong><p>${app.links}</p></div>` : ''}
      ${app.review_note ? `<div class="admin-app-section"><strong>Review note</strong><p>${app.review_note}</p></div>` : ''}
    `;

    if (app.status === 'pending') {
      const actions = document.createElement('div');
      actions.className = 'admin-app-actions';

      const noteInput = document.createElement('input');
      noteInput.className = 'admin-input';
      noteInput.placeholder = 'Optional review note...';
      actions.appendChild(noteInput);

      const approveBtn = document.createElement('button');
      approveBtn.className = 'admin-action-btn success';
      approveBtn.textContent = 'Approve';
      approveBtn.onclick = async () => {
        try {
          await adminFetch('ReviewApplication', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ application_id: app.application_id, status: 'approved', review_note: noteInput.value }),
          });
          showBanner(container, 'Application approved.');
          await renderApplications(container);
        } catch (e) { showBanner(container, e.message, 'error'); }
      };

      const rejectBtn = document.createElement('button');
      rejectBtn.className = 'admin-action-btn danger';
      rejectBtn.textContent = 'Reject';
      rejectBtn.onclick = async () => {
        try {
          await adminFetch('ReviewApplication', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ application_id: app.application_id, status: 'rejected', review_note: noteInput.value }),
          });
          showBanner(container, 'Application rejected.');
          await renderApplications(container);
        } catch (e) { showBanner(container, e.message, 'error'); }
      };

      actions.appendChild(approveBtn);
      actions.appendChild(rejectBtn);
      card.appendChild(actions);
    }

    container.appendChild(card);
  });
}

// ─── Manuscripts ──────────────────────────────────────────────────────────────

async function renderManuscripts(container) {
  const manuscripts = await adminFetch('Manuscripts');
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'admin-section-header';
  header.innerHTML = `<h3>All Manuscripts <span class="admin-count">${manuscripts.length}</span></h3>`;
  container.appendChild(header);

  if (!manuscripts.length) {
    container.innerHTML += '<div class="admin-empty">No manuscripts.</div>';
    return;
  }

  manuscripts.forEach(m => {
    const card = document.createElement('div');
    card.className = 'admin-manuscript-card';
    card.innerHTML = `<div class="admin-manuscript-title">${m.display_name || m.book}</div>`;

    const drafts = document.createElement('div');
    drafts.className = 'admin-draft-list';

    (m.drafts || []).forEach(d => {
      const row = document.createElement('div');
      row.className = 'admin-draft-row';
      row.innerHTML = `
        <span class="admin-draft-name">${d.name}</span>
        <span class="admin-badge ${d.public ? 'success' : ''}">${d.public ? 'Public' : 'Private'}</span>
        ${d.flagged ? '<span class="admin-badge warn">Flagged</span>' : ''}
        ${d.admin_hidden ? '<span class="admin-badge danger">Hidden</span>' : ''}
      `;

      const actions = document.createElement('div');
      actions.className = 'admin-draft-actions';

      const flagBtn = document.createElement('button');
      flagBtn.className = 'admin-action-btn' + (d.flagged ? ' active' : '');
      flagBtn.textContent = d.flagged ? 'Unflag' : 'Flag';
      flagBtn.onclick = async () => {
        const reason = d.flagged ? '' : (prompt('Flag reason:') || '');
        try {
          await adminFetch('FlagManuscript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ draft_id: d._id, flagged: !d.flagged, reason }),
          });
          showBanner(container, `Draft ${d.flagged ? 'unflagged' : 'flagged'}.`);
          await renderManuscripts(container);
        } catch (e) { showBanner(container, e.message, 'error'); }
      };

      const hideBtn = document.createElement('button');
      hideBtn.className = 'admin-action-btn' + (d.admin_hidden ? ' active' : '');
      hideBtn.textContent = d.admin_hidden ? 'Unhide' : 'Force Hide';
      hideBtn.onclick = async () => {
        try {
          await adminFetch('ForceHideDraft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ draft_id: d._id, hidden: !d.admin_hidden }),
          });
          showBanner(container, `Draft ${d.admin_hidden ? 'restored' : 'hidden'}.`);
          await renderManuscripts(container);
        } catch (e) { showBanner(container, e.message, 'error'); }
      };

      actions.appendChild(flagBtn);
      actions.appendChild(hideBtn);
      row.appendChild(actions);
      drafts.appendChild(row);
    });

    card.appendChild(drafts);
    container.appendChild(card);
  });
}

// ─── Invites ──────────────────────────────────────────────────────────────────

async function renderInvites(container) {
  const invites = await adminFetch('Invites');
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'admin-section-header';
  header.innerHTML = `<h3>Active Invites <span class="admin-count">${invites.length}</span></h3>`;
  container.appendChild(header);

  if (!invites.length) {
    container.innerHTML += '<div class="admin-empty">No active invites.</div>';
    return;
  }

  const table = makeTable(
    ['Token', 'Scope', 'Role', 'Uses', 'Expires', 'Actions'],
    invites,
    inv => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="admin-sub">${inv.token.slice(0, 8)}…</td>
        <td>${inv.scope_type} / ${inv.scope_id?.slice(0, 8)}…</td>
        <td>${inv.role}</td>
        <td>${inv.uses} / ${inv.max_uses}</td>
        <td>${fmtDate(inv.expires_at)}</td>
        <td></td>
      `;
      const actions = tr.querySelector('td:last-child');
      const revokeBtn = document.createElement('button');
      revokeBtn.className = 'admin-action-btn danger';
      revokeBtn.textContent = 'Revoke';
      revokeBtn.onclick = async () => {
        try {
          await adminFetch('RevokeInvite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: inv.token }),
          });
          showBanner(container, 'Invite revoked.');
          await renderInvites(container);
        } catch (e) { showBanner(container, e.message, 'error'); }
      };
      actions.appendChild(revokeBtn);
      return tr;
    }
  );
  container.appendChild(table);
}

// ─── Messages ─────────────────────────────────────────────────────────────────

async function renderMessages(container) {
  const result = await apiFetch('/admin/Messages', {}, { returnFull: true });
  const messages = result?.data || [];
  const unread   = result?.meta?.unread || 0;
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'admin-section-header';
  header.innerHTML = `
    <h3>Support Messages
      ${unread ? `<span class="admin-badge accent">${unread} unread</span>` : ''}
    </h3>
  `;
  container.appendChild(header);

  if (!messages.length) {
    container.innerHTML += '<div class="admin-empty">No messages.</div>';
    return;
  }

  messages.forEach(msg => {
    const card = document.createElement('div');
    card.className = `admin-message-card ${msg.status}`;
    card.innerHTML = `
      <div class="admin-message-header">
        <strong>${msg.subject}</strong>
        <span class="admin-badge ${msg.status === 'unread' ? 'accent' : ''}">${msg.status}</span>
        <span class="admin-app-date">${fmtDateTime(msg.created_at)}</span>
      </div>
      <div class="admin-message-from">From: @${msg.from_username}</div>
      <div class="admin-message-body">${msg.body}</div>
      ${msg.admin_note ? `<div class="admin-message-note"><strong>Admin note:</strong> ${msg.admin_note}</div>` : ''}
    `;

    if (msg.status !== 'resolved') {
      const actions = document.createElement('div');
      actions.className = 'admin-app-actions';

      const noteInput = document.createElement('input');
      noteInput.className = 'admin-input';
      noteInput.placeholder = 'Optional note...';
      actions.appendChild(noteInput);

      const resolveBtn = document.createElement('button');
      resolveBtn.className = 'admin-action-btn success';
      resolveBtn.textContent = 'Resolve';
      resolveBtn.onclick = async () => {
        try {
          await adminFetch('ResolveMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message_id: msg.message_id, admin_note: noteInput.value }),
          });
          showBanner(container, 'Message resolved.');
          await renderMessages(container);
        } catch (e) { showBanner(container, e.message, 'error'); }
      };
      actions.appendChild(resolveBtn);
      card.appendChild(actions);
    }

    container.appendChild(card);
  });
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

async function renderAuditLog(container) {
  const log = await adminFetch('AuditLog?limit=100');
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'admin-section-header';
  header.innerHTML = `<h3>Audit Log <span class="admin-count">${log.length} entries</span></h3>`;
  container.appendChild(header);

  if (!log.length) {
    container.innerHTML += '<div class="admin-empty">No audit log entries.</div>';
    return;
  }

  const table = makeTable(
    ['When', 'Admin', 'Action', 'Target Type', 'Target', 'Detail'],
    log,
    entry => {
      const tr = document.createElement('tr');
      const detail = entry.detail ? JSON.stringify(entry.detail).slice(0, 60) : '—';
      tr.innerHTML = `
        <td>${fmtDateTime(entry.created_at)}</td>
        <td>@${entry.username || '—'}</td>
        <td><code>${entry.action}</code></td>
        <td>${entry.target_type || '—'}</td>
        <td class="admin-sub">${entry.target_id ? entry.target_id.slice(0, 16) + '…' : '—'}</td>
        <td class="admin-sub">${detail}</td>
      `;
      return tr;
    }
  );
  container.appendChild(table);
}
