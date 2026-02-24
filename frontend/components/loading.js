/**
 * loading.js — Reusable loading states.
 *
 * renderSkeleton(container, type)  — shimmer placeholder cards
 * renderSpinner(container)         — centred spinner for single items
 * clearLoading(container)          — removes loading state before real content
 */

export function renderSkeleton(container, type = 'bookshelf') {
  // Appends into container — does NOT clear it. Caller controls surrounding content.
  const wrap = document.createElement('div');
  wrap.className = 'skeleton-wrap';

  if (type === 'bookshelf') {
    // One fake series with three fake book cards
    const seriesLabel = document.createElement('div');
    seriesLabel.className = 'skeleton-line wide';
    wrap.appendChild(seriesLabel);

    for (let i = 0; i < 3; i++) {
      const card = document.createElement('div');
      card.className = 'skeleton-card';
      card.innerHTML = `
        <div class="skeleton-line medium"></div>
        <div class="skeleton-bar"></div>
        <div class="skeleton-line short"></div>
      `;
      wrap.appendChild(card);
    }

  } else if (type === 'chapters') {
    const title = document.createElement('div');
    title.className = 'skeleton-line wide';
    title.style.marginBottom = '24px';
    wrap.appendChild(title);

    for (let i = 0; i < 8; i++) {
      const row = document.createElement('div');
      row.className = 'skeleton-chapter-row';
      row.innerHTML = `
        <div class="skeleton-line ${i % 3 === 0 ? 'wide' : 'medium'}"></div>
        <div class="skeleton-line short"></div>
      `;
      wrap.appendChild(row);
    }

  } else if (type === 'reader') {
    const title = document.createElement('div');
    title.className = 'skeleton-line wide';
    title.style.marginBottom = '32px';
    wrap.appendChild(title);

    for (let i = 0; i < 12; i++) {
      const line = document.createElement('div');
      line.className = `skeleton-line ${['wide','wide','medium','wide','wide','short'][i % 6]}`;
      wrap.appendChild(line);
      if (i % 4 === 3) {
        // Paragraph break
        const gap = document.createElement('div');
        gap.style.height = '16px';
        wrap.appendChild(gap);
      }
    }
  }

  container.appendChild(wrap);
}

export function renderSpinner(container, message = 'Loading...') {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'spinner-wrap';
  wrap.innerHTML = `
    <div class="spinner"></div>
    <div class="spinner-msg">${message}</div>
  `;
  container.appendChild(wrap);
}

export function clearLoading(container) {
  const skeleton = container.querySelector('.skeleton-wrap');
  const spinner  = container.querySelector('.spinner-wrap');
  if (skeleton) skeleton.remove();
  if (spinner)  spinner.remove();
}
