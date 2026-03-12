import { getChapters } from '../services/novelService.js';
import { exportDraft } from '../services/authorService.js';
import { getNovelsCache } from '../core/appState.js';
import { getNovels } from '../services/novelService.js';
import { getProgressPercent } from '../core/appState.js';
import { renderSkeleton } from '../components/loading.js';

export async function renderChapterList(draftId) {
  console.log('renderChapterList called with draftId:', draftId, new Error().stack);
  const container = document.getElementById('main-content');
  container.innerHTML = '';
  const skeletonWrapper = document.createElement('div');
  skeletonWrapper.id = 'skeleton-wrapper';
  container.appendChild(skeletonWrapper);
  renderSkeleton(skeletonWrapper, 'chapters');

  let chapters = [];
  try {
    chapters = await getChapters(draftId) || [];
  } catch (err) {
    document.getElementById('skeleton-wrapper')?.remove();
    const errEl = document.createElement('div');
    errEl.className = 'empty-library';
    errEl.textContent = 'Failed to load chapters.';
    container.appendChild(errEl);
    return;
  }

  document.getElementById('skeleton-wrapper')?.remove();

  if (!chapters.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-library';
    empty.textContent = 'No chapters found for this draft.';
    container.appendChild(empty);
    return;
  }

  // ── Resolve display name from novels cache ──
  let displayName = 'Untitled Manuscript';
  let draftName = '';
  try {
    const novels = await getNovelsCache(async () => {
      const res = await getNovels();
      return Array.isArray(res) ? res : (res?.data || []);
    });
    for (const m of novels) {
      const draft = (m.drafts || []).find(d => d._id === draftId);
      if (draft) {
        displayName = m.display_name || m.book || 'Untitled';
        draftName   = draft.name || '';
        break;
      }
    }
  } catch {}

  const wrap = document.createElement('div');
  wrap.className = 'chapter-list-wrap';

  // Title + draft name
  const titleEl = document.createElement('h1');
  titleEl.className = 'chapter-list-title';
  titleEl.textContent = displayName;
  wrap.appendChild(titleEl);

  if (draftName) {
    const draftEl = document.createElement('p');
    draftEl.className = 'chapter-list-draft';
    draftEl.textContent = draftName;
    wrap.appendChild(draftEl);
  }

  // Progress summary
  const totalWords = chapters.reduce((sum, ch) => sum + (ch.word_count || 0), 0);
  const progressPct = getProgressPercent(draftId, chapters.length);

  const metaEl = document.createElement('p');
  metaEl.className = 'chapter-list-meta';
  metaEl.textContent = `${totalWords.toLocaleString()} words · ${chapters.length} chapter${chapters.length !== 1 ? 's' : ''}`;
  if (progressPct > 0) {
    metaEl.textContent += ` · ${Math.round(progressPct * 100)}% read`;
  }
  wrap.appendChild(metaEl);

  // Download button
  const dlBtn = document.createElement('button');
  dlBtn.className = 'download-draft-btn';
  dlBtn.innerHTML = '⬇ Download as Word doc';
  dlBtn.onclick = async () => {
    dlBtn.disabled = true;
    dlBtn.textContent = 'Preparing…';
    try {
      const filename = `${displayName} - ${draftName || 'draft'}.docx`.replace(/\s+/g, '_');
      await exportDraft(draftId, filename);
    } catch(e) {
      console.error('Export failed:', e);
      alert('Download failed. Please try again.');
    } finally {
      dlBtn.disabled = false;
      dlBtn.innerHTML = '⬇ Download as Word doc';
    }
  };
  wrap.appendChild(dlBtn);

  // Chapter list
  const ul = document.createElement('ul');
  ul.className = 'chapter-list';

  chapters.forEach(ch => {
    const li = document.createElement('li');
    const status = ch.status || 'published';

    if (status === 'hidden' && ch._id) {
      // Author-only: hidden chapter — visible but badged
      li.className = 'chapter-list-item hidden-chapter';

      const a = document.createElement('a');
      a.href = `/?id=${ch._id}`;
      a.className = 'chapter-list-link';
      a.textContent = ch.title || 'Untitled Chapter';
      li.appendChild(a);

      const badge = document.createElement('span');
      badge.className = 'ch-metadata hidden-badge';
      badge.textContent = '🙈 Hidden';
      li.appendChild(badge);

    } else if (status === 'upcoming') {
      // Teaser row — not clickable
      li.className = 'chapter-list-item upcoming';

      const span = document.createElement('span');
      span.className = 'chapter-list-link upcoming-title';
      span.textContent = ch.title || 'Untitled Chapter';
      li.appendChild(span);

      const badge = document.createElement('span');
      badge.className = 'ch-metadata upcoming-badge';
      badge.textContent = '⏳ Upcoming';
      li.appendChild(badge);

    } else {
      // Published row — fully clickable
      li.className = 'chapter-list-item';

      const a = document.createElement('a');
      a.href = `/?id=${ch._id}`;
      a.className = 'chapter-list-link';
      a.textContent = ch.title || 'Untitled Chapter';
      li.appendChild(a);

      const meta = document.createElement('span');
      meta.className = 'ch-metadata';
      meta.textContent = `${(ch.word_count || 0).toLocaleString()} words`;
      li.appendChild(meta);
    }

    ul.appendChild(li);
  });

  wrap.appendChild(ul);
  container.appendChild(wrap);
}
