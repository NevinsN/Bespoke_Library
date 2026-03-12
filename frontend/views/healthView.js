import { apiFetch } from '../core/api.js';

/**
 * Health Dashboard
 *
 * Currently shows: live status, uptime %, avg latency, ping history chart.
 * Built to grow — add new metric cards by pushing to METRIC_CARDS array.
 */

const containerId = 'main-content';

// ─── Chart loader (Chart.js from CDN) ─────────────────────────────────────────
async function getChartJs() {
  if (window.Chart) return window.Chart;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
    s.onload  = resolve;
    s.onerror = () => reject(new Error('Failed to load Chart.js'));
    document.head.appendChild(s);
  });
  return window.Chart;
}

// ─── Entry point ──────────────────────────────────────────────────────────────
export async function renderHealthDashboard() {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'health-wrap';

  const heading = document.createElement('div');
  heading.className = 'health-heading';
  heading.innerHTML = `
    <h1>System Health</h1>
    <span class="health-version" id="health-version">—</span>
  `;
  wrap.appendChild(heading);

  // Status banner
  const banner = document.createElement('div');
  banner.className = 'health-banner loading';
  banner.id = 'health-banner';
  banner.textContent = 'Checking...';
  wrap.appendChild(banner);

  // Metric cards row
  const cards = document.createElement('div');
  cards.className = 'health-cards';
  cards.id = 'health-cards';
  wrap.appendChild(cards);

  // Chart section
  const chartSection = document.createElement('div');
  chartSection.className = 'health-chart-section';
  chartSection.innerHTML = `
    <div class="health-chart-header">
      <h3>API Latency — Last 24h</h3>
      <div class="health-chart-legend">
        <span class="legend-dot db"></span> DB
        <span class="legend-dot api"></span> API
      </div>
    </div>
    <div class="health-chart-wrap">
      <canvas id="latency-chart"></canvas>
    </div>
  `;
  wrap.appendChild(chartSection);

  // Last updated
  const footer = document.createElement('div');
  footer.className = 'health-footer';
  footer.id = 'health-footer';
  wrap.appendChild(footer);

  container.appendChild(wrap);

  // Load data
  await loadHealthData();

  // Auto-refresh every 60s
  const refreshTimer = setInterval(loadHealthData, 60000);
  window.addEventListener('popstate', () => {
    clearInterval(refreshTimer);
  }, { once: true });
}

// ─── Data loading ─────────────────────────────────────────────────────────────
async function loadHealthData() {
  try {
    const [health, history] = await Promise.all([
      apiFetch('/Health?source=dashboard'),
      fetchHistory(),
    ]);

    renderBanner(health);
    renderCards(health);
    renderChart(history);
    renderFooter(health.timestamp);
    document.getElementById('health-version').textContent = `v${health.version}`;

  } catch (err) {
    const banner = document.getElementById('health-banner');
    if (banner) {
      banner.className = 'health-banner error';
      banner.textContent = 'Failed to reach health endpoint.';
    }
  }
}

async function fetchHistory() {
  try {
    return await apiFetch('/PingHistory?hours=24');
  } catch {
    return []; // History is non-critical — dashboard still works without it
  }
}

// ─── Banner ───────────────────────────────────────────────────────────────────
function renderBanner(health) {
  const banner = document.getElementById('health-banner');
  if (!banner) return;

  const isOk = health.status === 'ok';
  banner.className = `health-banner ${isOk ? 'ok' : 'error'}`;
  banner.innerHTML = `
    <span class="health-status-dot ${isOk ? 'ok' : 'error'}"></span>
    ${isOk ? 'All systems operational' : `Degraded — ${health.services?.database?.status === 'error' ? 'Database unreachable' : 'Service issue detected'}`}
  `;
}

// ─── Metric cards ─────────────────────────────────────────────────────────────
function renderCards(health) {
  const container = document.getElementById('health-cards');
  if (!container) return;
  container.innerHTML = '';

  const u24 = health.uptime?.last_24h || {};
  const u1  = health.uptime?.last_1h  || {};

  // Extensible card definitions — add new metrics here as the platform grows
  const cardDefs = [
    {
      label: '24h Uptime',
      value: u24.uptime_pct != null ? `${u24.uptime_pct}%` : '—',
      sub:   u24.total_pings ? `${u24.ok_pings}/${u24.total_pings} pings` : 'No data yet',
      color: u24.uptime_pct >= 99 ? 'green' : u24.uptime_pct >= 95 ? 'yellow' : 'red',
    },
    {
      label: '1h Uptime',
      value: u1.uptime_pct != null ? `${u1.uptime_pct}%` : '—',
      sub:   u1.total_pings ? `${u1.ok_pings}/${u1.total_pings} pings` : 'No data yet',
      color: u1.uptime_pct >= 99 ? 'green' : u1.uptime_pct >= 95 ? 'yellow' : 'red',
    },
    {
      label: 'DB Latency',
      value: health.services?.database?.latency_ms != null
        ? `${health.services.database.latency_ms}ms` : '—',
      sub:   `Avg 24h: ${u24.avg_db_ms != null ? u24.avg_db_ms + 'ms' : '—'}`,
      color: health.services?.database?.status === 'ok' ? 'green' : 'red',
    },
    {
      label: 'API Latency',
      value: health.services?.api?.latency_ms != null
        ? `${health.services.api.latency_ms}ms` : '—',
      sub:   `Avg 24h: ${u24.avg_api_ms != null ? u24.avg_api_ms + 'ms' : '—'}`,
      color: 'green',
    },
  ];

  cardDefs.forEach(def => {
    const card = document.createElement('div');
    card.className = 'health-card';
    card.innerHTML = `
      <div class="health-card-label">${def.label}</div>
      <div class="health-card-value ${def.color}">${def.value}</div>
      <div class="health-card-sub">${def.sub}</div>
    `;
    container.appendChild(card);
  });
}

// ─── Latency chart ────────────────────────────────────────────────────────────
let _chart = null;

async function renderChart(pings) {
  if (!pings.length) return;

  const Chart = await getChartJs();
  const canvas = document.getElementById('latency-chart');
  if (!canvas) return;

  // Sample down to last 100 pings for readability
  const data = [...pings].reverse().slice(-100);

  const labels   = data.map(p => {
    const d = new Date(p.timestamp);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const dbData   = data.map(p => p.db_latency_ms ?? null);
  const apiData  = data.map(p => p.api_latency_ms ?? null);

  if (_chart) {
    _chart.data.labels        = labels;
    _chart.data.datasets[0].data = dbData;
    _chart.data.datasets[1].data = apiData;
    _chart.update('none');
    return;
  }

  _chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label:           'DB (ms)',
          data:            dbData,
          borderColor:     '#3498db',
          backgroundColor: 'rgba(52,152,219,0.08)',
          borderWidth:     1.5,
          pointRadius:     0,
          tension:         0.3,
          spanGaps:        true,
        },
        {
          label:           'API (ms)',
          data:            apiData,
          borderColor:     '#2ecc71',
          backgroundColor: 'rgba(46,204,113,0.08)',
          borderWidth:     1.5,
          pointRadius:     0,
          tension:         0.3,
          spanGaps:        true,
        },
      ],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      animation:           false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y ?? '—'}ms`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#555', maxTicksLimit: 8 },
          grid:  { color: '#1a1a1a' },
        },
        y: {
          ticks:    { color: '#555', callback: v => `${v}ms` },
          grid:     { color: '#1a1a1a' },
          beginAtZero: true,
        },
      },
    },
  });
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function renderFooter(timestamp) {
  const footer = document.getElementById('health-footer');
  if (!footer) return;
  const d = new Date(timestamp);
  footer.textContent = `Last checked: ${d.toLocaleTimeString()} · Auto-refreshes every 60s`;
}
