/**
 * adminView.js — Admin panel (stub).
 * Full implementation coming next milestone.
 */

export function renderAdminPanel() {
  const container = document.getElementById('main-content');
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'admin-wrap';

  wrap.innerHTML = `
    <div class="admin-header">
      <h1>Admin Panel</h1>
      <p class="admin-subtitle">Platform management and analytics</p>
    </div>
    <div class="admin-coming-soon">
      <p>Full admin panel coming soon.</p>
    </div>
  `;

  container.appendChild(wrap);
}
