/**
 * feedbackView.js
 * Studio feedback panel — shows all reader comments for a draft,
 * grouped by status (pending, flagged, accepted, dismissed).
 * Authors can flag, accept, or dismiss each comment.
 */

import { getComments, setCommentStatus } from '../services/commentService.js';

const STATUS_TABS = [
  { key: 'pending',   label: '🔔 New' },
  { key: 'flagged',   label: '🚩 Flagged' },
  { key: 'accepted',  label: '✅ Accepted' },
  { key: 'dismissed', label: '✖ Dismissed' },
];

const CATEGORY_LABELS = {
  typo:       '✏️ Typo',
  grammar:    '📝 Grammar',
  flow:       '〰️ Flow',
  question:   '❓ Question',
  suggestion: '💡 Suggestion',
  general:    '💬 General',
};

export async function renderFeedbackPanel(draft, manuscript) {
  const panel = document.createElement('div');
  panel.className = 'studio-panel feedback-panel';

  const header = document.createElement('div');
  header.className = 'studio-panel-header';
  const h3 = document.createElement('h3');
  h3.textContent = `${manuscript.display_name} / ${draft.name} — Feedback`;
  header.appendChild(h3);
  panel.appendChild(header);

  const loading = document.createElement('div');
  loading.className = 'studio-hint';
  loading.textContent = 'Loading comments…';
  panel.appendChild(loading);

  let comments = [];
  try {
    comments = await getComments(draft._id) || [];
  } catch(e) {
    loading.textContent = 'Failed to load comments.';
    return panel;
  }
  loading.remove();

  if (!comments.length) {
    const empty = document.createElement('div');
    empty.className = 'studio-hint';
    empty.textContent = 'No comments yet for this draft.';
    panel.appendChild(empty);
    return panel;
  }

  // ── Tab bar ──
  let activeTab = 'pending';
  const tabBar  = document.createElement('div');
  tabBar.className = 'feedback-tabs';

  const listContainer = document.createElement('div');
  listContainer.className = 'feedback-list';

  function renderList(status) {
    listContainer.innerHTML = '';
    const filtered = comments.filter(c => c.status === status);

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'studio-hint';
      empty.textContent = status === 'pending' ? 'No new comments.' : `Nothing ${status} yet.`;
      listContainer.appendChild(empty);
      return;
    }

    filtered.forEach(c => {
      listContainer.appendChild(buildCommentCard(c, comments, () => renderList(activeTab)));
    });
  }

  STATUS_TABS.forEach(({ key, label }) => {
    const count = comments.filter(c => c.status === key).length;
    const tab = document.createElement('button');
    tab.className = 'feedback-tab' + (key === activeTab ? ' active' : '');
    tab.textContent = `${label}${count ? ` (${count})` : ''}`;
    tab.onclick = () => {
      activeTab = key;
      tabBar.querySelectorAll('.feedback-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderList(key);
    };
    tabBar.appendChild(tab);
  });

  panel.appendChild(tabBar);
  panel.appendChild(listContainer);
  renderList('pending');

  return panel;
}

function buildCommentCard(comment, allComments, refresh) {
  const card = document.createElement('div');
  card.className = `feedback-card status-${comment.status}`;

  // ── Header: who + when + category ──
  const cardHeader = document.createElement('div');
  cardHeader.className = 'feedback-card-header';

  const who = document.createElement('span');
  who.className = 'feedback-who';
  who.textContent = comment.reader_username;

  const cat = document.createElement('span');
  cat.className = 'feedback-category';
  cat.textContent = CATEGORY_LABELS[comment.category] || comment.category;

  const when = document.createElement('span');
  when.className = 'feedback-when';
  when.textContent = new Date(comment.created_at).toLocaleDateString();

  cardHeader.appendChild(who);
  cardHeader.appendChild(cat);
  cardHeader.appendChild(when);
  card.appendChild(cardHeader);

  // ── Highlighted text ──
  if (comment.highlighted_text) {
    const quote = document.createElement('blockquote');
    quote.className = 'feedback-quote';
    quote.textContent = `"${comment.highlighted_text}"`;
    card.appendChild(quote);
  }

  // ── Note ──
  const note = document.createElement('p');
  note.className = 'feedback-note';
  note.textContent = comment.note;
  card.appendChild(note);

  // ── Actions ──
  if (comment.status !== 'accepted' && comment.status !== 'dismissed') {
    const actions = document.createElement('div');
    actions.className = 'feedback-actions';

    const buttons = [
      { status: 'flagged',   label: '🚩 Flag',    skip: comment.status === 'flagged' },
      { status: 'accepted',  label: '✅ Accept'  },
      { status: 'dismissed', label: '✖ Dismiss'  },
    ].filter(b => !b.skip);

    buttons.forEach(({ status, label }) => {
      const btn = document.createElement('button');
      btn.className = 'feedback-action-btn';
      btn.textContent = label;
      btn.onclick = async () => {
        btn.disabled = true;
        try {
          await setCommentStatus(comment._id, status);
          comment.status = status;
          refresh();
        } catch(e) {
          btn.disabled = false;
          console.error(e);
        }
      };
      actions.appendChild(btn);
    });

    card.appendChild(actions);
  }

  return card;
}
