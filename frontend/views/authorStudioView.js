import { renderInvitePanel } from '../components/invitePanel.js';
import { getAuthoredManuscripts, createProject, getDrafts, uploadChapters, setDraftVisibility } from '../services/authorService.js';

// Load JSZip from CDN on demand
async function getJSZip() {
  if (window.JSZip) return window.JSZip;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load JSZip'));
    document.head.appendChild(s);
  });
  return window.JSZip;
}

// ─── State ────────────────────────────────────────────────────────────────────
let state = {
  manuscripts: [],       // from GetNovels
  selectedManuscript: null,
  selectedDraft: null,
  pendingFiles: [],      // { filename, title, content, slot, wordCount }
  sequential: true,
  dragOver: false,
};

// ─── Entry point ──────────────────────────────────────────────────────────────
export async function renderAuthorStudio({ openNewForm = false } = {}) {
  const container = document.getElementById('main-content');
  container.innerHTML = '';

  const studio = document.createElement('div');
  studio.className = 'studio-wrap';
  container.appendChild(studio);

  // Back link
  const back = document.createElement('a');
  back.href = '/';
  back.className = 'back-link';
  back.textContent = '← Back to Library';
  studio.appendChild(back);

  const heading = document.createElement('h1');
  heading.textContent = 'Author Studio';
  studio.appendChild(heading);

  // Load manuscripts
  try {
    state.manuscripts = await getAuthoredManuscripts();
  } catch (e) {
    showBanner(studio, 'Failed to load projects.', 'error');
    return;
  }

  renderStudio(studio);
}

// ─── Main render ──────────────────────────────────────────────────────────────
function renderStudio(studio) {
  // Clear everything after heading/back link
  const existing = studio.querySelector('.studio-body');
  if (existing) existing.remove();

  const body = document.createElement('div');
  body.className = 'studio-body';
  studio.appendChild(body);

  // ── Column layout ──
  const cols = document.createElement('div');
  cols.className = 'studio-cols';
  body.appendChild(cols);

  cols.appendChild(renderProjectPanel());
  cols.appendChild(renderUploadPanel());
}

// ─── Left panel: project + draft selection ────────────────────────────────────
function renderProjectPanel() {
  const panel = document.createElement('div');
  panel.className = 'studio-panel';

  // ── Project list ──
  const projHeader = document.createElement('div');
  projHeader.className = 'studio-panel-header';
  projHeader.innerHTML = '<h3>Projects</h3>';

  const newProjBtn = document.createElement('button');
  newProjBtn.className = 'studio-btn small';
  newProjBtn.textContent = '+ New';
  newProjBtn.onclick = () => showCreateProjectForm(panel);
  projHeader.appendChild(newProjBtn);
  panel.appendChild(projHeader);

  const projList = document.createElement('div');
  projList.className = 'scroll-list';

  if (!state.manuscripts.length) {
    const empty = document.createElement('div');
    empty.className = 'project-item';
    empty.style.color = '#666';
    empty.textContent = 'No projects yet.';
    projList.appendChild(empty);
  }

  state.manuscripts.forEach(m => {
    const item = document.createElement('div');
    item.className = 'project-item' + (state.selectedManuscript?._id === m._id ? ' selected' : '');
    item.textContent = m.display_name;
    item.onclick = async () => {
      state.selectedManuscript = m;
      state.selectedDraft = null;
      state.pendingFiles = [];
      await loadDrafts(panel, m);
      rerenderUploadPanel();
    };
    projList.appendChild(item);
  });
  panel.appendChild(projList);

  // ── Draft section ──
  const draftSection = document.createElement('div');
  draftSection.id = 'draft-section';
  draftSection.style.marginTop = '20px';
  panel.appendChild(draftSection);

  if (state.selectedManuscript) {
    renderDraftSection(draftSection, state.selectedManuscript);
  }

  return panel;
}

async function loadDrafts(panel, manuscript) {
  const section = panel.querySelector('#draft-section');
  section.innerHTML = '<div style="color:#666;font-size:0.85em;">Loading drafts...</div>';
  try {
    const drafts = await getDrafts(manuscript._id);
    manuscript.drafts = drafts;
    renderDraftSection(section, manuscript);
    renderStudio(panel.closest('.studio-wrap'));
  } catch (e) {
    section.innerHTML = '<div style="color:var(--error-color)">Failed to load drafts.</div>';
  }
}

function renderDraftSection(container, manuscript) {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'studio-panel-header';
  header.innerHTML = '<h3>Drafts</h3>';
  container.appendChild(header);

  const drafts = manuscript.drafts || [];
  const list = document.createElement('div');
  list.className = 'scroll-list';

  drafts.forEach(d => {
    const item = document.createElement('div');
    item.className = 'project-item' + (state.selectedDraft?._id === d._id ? ' selected' : '');
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.justifyContent = 'space-between';
    item.style.gap = '8px';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = d.name;
    nameSpan.style.flex = '1';
    nameSpan.onclick = () => {
      state.selectedDraft = d;
      state.pendingFiles = [];
      rerenderUploadPanel();
    };
    item.appendChild(nameSpan);

    // ── Public toggle ──
    const toggle = document.createElement('button');
    toggle.className = 'visibility-toggle' + (d.public ? ' public' : '');
    toggle.textContent = d.public ? '🌐 Public' : '🔒 Private';
    toggle.title = d.public ? 'Click to make private' : 'Click to make public';
    toggle.onclick = async (e) => {
      e.stopPropagation();
      const newPublic = !d.public;
      toggle.disabled = true;
      try {
        await setDraftVisibility(d._id, newPublic);
        d.public = newPublic;
        toggle.textContent = newPublic ? '🌐 Public' : '🔒 Private';
        toggle.className = 'visibility-toggle' + (newPublic ? ' public' : '');
        toggle.title = newPublic ? 'Click to make private' : 'Click to make public';
      } catch (err) {
        console.error('Failed to update visibility:', err);
      } finally {
        toggle.disabled = false;
      }
    };
    item.appendChild(toggle);

    list.appendChild(item);
  });

  if (!drafts.length) {
    const empty = document.createElement('div');
    empty.className = 'project-item';
    empty.style.color = '#666';
    empty.textContent = 'No drafts yet.';
    list.appendChild(empty);
  }

  container.appendChild(list);

  // ── Invite button (shown when a draft or manuscript is selected) ──
  if (state.selectedManuscript) {
    const inviteBtn = document.createElement('button');
    inviteBtn.className = 'studio-btn small';
    inviteBtn.style.marginTop = '16px';
    inviteBtn.style.width = '100%';
    inviteBtn.textContent = '✉ Invite Readers';
    inviteBtn.onclick = () => showInviteModal(state.selectedManuscript, state.selectedDraft);
    container.appendChild(inviteBtn);
  }
}

// ─── Invite modal ─────────────────────────────────────────────────────────────
async function showInviteModal(manuscript, draft) {
  // Remove existing modal if open
  document.querySelector('.invite-modal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'invite-modal-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  const modal = document.createElement('div');
  modal.className = 'invite-modal';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'invite-modal-close';
  closeBtn.textContent = '✕';
  closeBtn.onclick = () => overlay.remove();
  modal.appendChild(closeBtn);

  // Scope selector tabs
  const tabs = document.createElement('div');
  tabs.className = 'invite-tabs';

  const scopes = [
    { type: 'manuscript', id: manuscript._id, label: manuscript.display_name },
  ];
  if (draft) {
    scopes.push({ type: 'draft', id: draft._id, label: `${manuscript.display_name} / ${draft.name}` });
  }
  if (manuscript.series_id) {
    scopes.unshift({ type: 'series', id: manuscript.series_id, label: manuscript.series_name || 'Series' });
  }

  const panelWrap = document.createElement('div');
  panelWrap.className = 'invite-panel-wrap';

  let activeScope = scopes[0];

  async function activateTab(scope, tabEl) {
    tabs.querySelectorAll('.invite-tab').forEach(t => t.classList.remove('active'));
    tabEl.classList.add('active');
    activeScope = scope;
    panelWrap.innerHTML = '';
    const panel = await renderInvitePanel(scope);
    panelWrap.appendChild(panel);
  }

  scopes.forEach((scope, i) => {
    const tab = document.createElement('button');
    tab.className = 'invite-tab' + (i === 0 ? ' active' : '');
    tab.textContent = scope.type.charAt(0).toUpperCase() + scope.type.slice(1);
    tab.onclick = () => activateTab(scope, tab);
    tabs.appendChild(tab);
  });

  modal.appendChild(tabs);
  modal.appendChild(panelWrap);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Load first tab
  const firstTab = tabs.querySelector('.invite-tab');
  const panel = await renderInvitePanel(scopes[0]);
  panelWrap.appendChild(panel);
}

// ─── Right panel: upload zone + file list ────────────────────────────────────
function renderUploadPanel() {
  const panel = document.createElement('div');
  panel.className = 'studio-panel';
  panel.id = 'upload-panel';
  buildUploadPanel(panel);
  return panel;
}

function rerenderUploadPanel() {
  const panel = document.getElementById('upload-panel');
  if (panel) buildUploadPanel(panel);
}

function buildUploadPanel(panel) {
  panel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'studio-panel-header';

  const title = document.createElement('h3');
  if (!state.selectedManuscript) {
    title.textContent = 'Upload Chapters';
  } else if (!state.selectedDraft) {
    title.textContent = `${state.selectedManuscript.display_name} — select a draft`;
  } else {
    title.textContent = `${state.selectedManuscript.display_name} / ${state.selectedDraft.name}`;
  }
  header.appendChild(title);
  panel.appendChild(header);

  if (!state.selectedManuscript || !state.selectedDraft) {
    const hint = document.createElement('p');
    hint.className = 'studio-hint';
    hint.textContent = 'Select a project and draft on the left to begin uploading.';
    panel.appendChild(hint);
    return;
  }

  // ── Upload mode toggle ──
  const modeRow = document.createElement('div');
  modeRow.className = 'upload-mode-row';

  ['Sequential', 'Manual order'].forEach((label, i) => {
    const lbl = document.createElement('label');
    lbl.className = 'upload-mode-label';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'uploadMode';
    radio.value = i === 0 ? 'sequential' : 'manual';
    radio.checked = i === 0 ? state.sequential : !state.sequential;
    radio.onchange = () => {
      state.sequential = radio.value === 'sequential';
      rerenderUploadPanel();
    };
    lbl.appendChild(radio);
    lbl.append(' ' + label);
    modeRow.appendChild(lbl);
  });
  panel.appendChild(modeRow);

  // ── Drop zone ──
  const dropZone = document.createElement('div');
  dropZone.className = 'drop-zone' + (state.dragOver ? ' drag-over' : '');
  dropZone.innerHTML = `
    <div class="drop-zone-icon">↑</div>
    <div class="drop-zone-text">Drop .md or .zip files here</div>
    <div class="drop-zone-sub">or click to browse</div>
  `;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.accept = '.md,.zip';
  fileInput.style.display = 'none';
  panel.appendChild(fileInput);

  dropZone.onclick = () => fileInput.click();

  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    state.dragOver = true;
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => {
    state.dragOver = false;
    dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', async e => {
    e.preventDefault();
    state.dragOver = false;
    dropZone.classList.remove('drag-over');
    await ingestFiles(Array.from(e.dataTransfer.files), panel);
  });

  fileInput.addEventListener('change', async () => {
    await ingestFiles(Array.from(fileInput.files), panel);
    fileInput.value = '';
  });

  panel.appendChild(dropZone);

  // ── Pending file list ──
  if (state.pendingFiles.length) {
    panel.appendChild(renderFileList());

    // ── Commit button ──
    const commitBtn = document.createElement('button');
    commitBtn.className = 'studio-btn';
    commitBtn.style.marginTop = '16px';
    commitBtn.textContent = `Upload ${state.pendingFiles.length} file${state.pendingFiles.length > 1 ? 's' : ''}`;
    commitBtn.onclick = () => commitUpload(panel, commitBtn);
    panel.appendChild(commitBtn);
  }
}

// ─── File ingestion (handles .zip expansion) ──────────────────────────────────
async function ingestFiles(files, panel) {
  const loadingMsg = document.createElement('div');
  loadingMsg.className = 'studio-hint';
  loadingMsg.textContent = 'Reading files...';
  panel.appendChild(loadingMsg);

  let nextSlot = state.pendingFiles.length;

  for (const file of files) {
    if (file.name.endsWith('.zip')) {
      try {
        const JSZip = await getJSZip();
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const entries = Object.entries(zip.files)
          .filter(([, f]) => !f.dir && (f.name.endsWith('.md') || f.name.endsWith('.txt')))
          .sort(([a], [b]) => a.localeCompare(b));

        for (const [filename, zipFile] of entries) {
          const content = await zipFile.async('text');
          const baseName = filename.split('/').pop();
          addPendingFile(baseName, content, nextSlot++);
        }
      } catch (e) {
        console.error('ZIP read error:', e);
      }
    } else if (file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      const content = await file.text();
      addPendingFile(file.name, content, nextSlot++);
    }
  }

  loadingMsg.remove();
  rerenderUploadPanel();
}

function addPendingFile(filename, content, slot) {
  // Skip duplicates by filename
  if (state.pendingFiles.find(f => f.filename === filename)) return;

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const title = filename.replace(/\.(md|txt)$/i, '').replace(/[-_]/g, ' ');

  state.pendingFiles.push({ filename, title, content, slot, wordCount });
}

// ─── File list with reordering and title editing ──────────────────────────────
function renderFileList() {
  const wrap = document.createElement('div');
  wrap.className = 'file-list';

  const listHeader = document.createElement('div');
  listHeader.className = 'file-list-header';
  listHeader.innerHTML = state.sequential
    ? '<span>Order</span><span>Title</span><span>Words</span><span></span>'
    : '<span>Slot</span><span>Title</span><span>Words</span><span></span>';
  wrap.appendChild(listHeader);

  state.pendingFiles.forEach((file, idx) => {
    const row = document.createElement('div');
    row.className = 'file-row';
    row.draggable = true;

    // ── Order/slot indicator ──
    const orderCell = document.createElement('div');
    orderCell.className = 'file-row-order';

    if (state.sequential) {
      orderCell.textContent = idx + 1;
    } else {
      const slotInput = document.createElement('input');
      slotInput.type = 'number';
      slotInput.className = 'slot-input';
      slotInput.min = 0;
      slotInput.value = file.slot ?? idx;
      slotInput.onchange = () => {
        file.slot = parseInt(slotInput.value, 10);
      };
      orderCell.appendChild(slotInput);
    }
    row.appendChild(orderCell);

    // ── Editable title ──
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'file-title-input';
    titleInput.value = file.title;
    titleInput.onchange = () => { file.title = titleInput.value; };
    row.appendChild(titleInput);

    // ── Word count ──
    const words = document.createElement('div');
    words.className = 'file-row-words';
    words.textContent = file.wordCount.toLocaleString();
    row.appendChild(words);

    // ── Remove ──
    const removeBtn = document.createElement('button');
    removeBtn.className = 'file-remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.onclick = () => {
      state.pendingFiles.splice(idx, 1);
      rerenderUploadPanel();
    };
    row.appendChild(removeBtn);

    // ── Drag to reorder (sequential only) ──
    if (state.sequential) {
      row.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', idx);
        row.classList.add('dragging');
      });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
      row.addEventListener('dragover', e => {
        e.preventDefault();
        row.classList.add('drag-target');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drag-target'));
      row.addEventListener('drop', e => {
        e.preventDefault();
        row.classList.remove('drag-target');
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (fromIdx === idx) return;
        const [moved] = state.pendingFiles.splice(fromIdx, 1);
        state.pendingFiles.splice(idx, 0, moved);
        rerenderUploadPanel();
      });
    }

    wrap.appendChild(row);
  });

  return wrap;
}

// ─── Commit upload ────────────────────────────────────────────────────────────
async function commitUpload(panel, btn) {
  if (!state.pendingFiles.length) return;

  btn.disabled = true;
  btn.textContent = 'Uploading...';

  // Progress bar
  const progressWrap = document.createElement('div');
  progressWrap.className = 'upload-progress-wrap';
  const progressBar = document.createElement('div');
  progressBar.className = 'upload-progress-bar';
  progressBar.style.width = '0%';
  progressWrap.appendChild(progressBar);
  panel.appendChild(progressWrap);

  try {
    const result = await uploadChapters(
      state.selectedDraft._id,
      state.pendingFiles,
      state.sequential,
      (pct) => { progressBar.style.width = pct + '%'; }
    );

    progressBar.style.width = '100%';
    progressBar.style.background = 'var(--success-color)';

    // Fire event so bookshelf can refresh
    document.dispatchEvent(new CustomEvent('chaptersUploaded', {
      detail: { manuscript_id: state.selectedManuscript._id }
    }));

    showBanner(
      panel,
      `✓ ${result.added.length} added, ${result.updated.length} updated.`,
      'success'
    );

    state.pendingFiles = [];
    setTimeout(() => rerenderUploadPanel(), 1200);

  } catch (err) {
    progressBar.style.background = 'var(--error-color)';
    showBanner(panel, `Upload failed: ${err.message}`, 'error');
    btn.disabled = false;
    btn.textContent = 'Retry Upload';
  }
}

// ─── Create project form ──────────────────────────────────────────────────────
function showCreateProjectForm(panel) {
  const existing = panel.querySelector('.create-project-form');
  if (existing) { existing.remove(); return; }

  const form = document.createElement('div');
  form.className = 'create-project-form';

  const fields = [
    { key: 'series_name', label: 'Series name', placeholder: 'e.g. The Devious Adventures' },
    { key: 'book',        label: 'Book title',  placeholder: 'e.g. Book One' },
    { key: 'draft_name',  label: 'First draft', placeholder: 'e.g. Draft One' },
  ];

  const inputs = {};
  fields.forEach(({ key, label, placeholder }) => {
    const lbl = document.createElement('label');
    lbl.textContent = label;
    lbl.style.display = 'block';
    lbl.style.marginTop = '10px';
    lbl.style.fontSize = '0.8em';
    lbl.style.color = '#aaa';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'studio-input';
    input.placeholder = placeholder;
    inputs[key] = input;
    form.appendChild(lbl);
    form.appendChild(input);
  });

  const createBtn = document.createElement('button');
  createBtn.className = 'studio-btn';
  createBtn.style.marginTop = '12px';
  createBtn.textContent = 'Create Project';
  createBtn.onclick = async () => {
    const body = {};
    for (const [key, input] of Object.entries(inputs)) {
      if (!input.value.trim() && key !== 'draft_name') {
        input.style.borderColor = 'var(--error-color)';
        return;
      }
      body[key] = input.value.trim();
    }
    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';
    try {
      await createProject(body);
      // Reload manuscripts
      state.manuscripts = await getAuthoredManuscripts();
      form.remove();
      renderStudio(panel.closest('.studio-wrap'));
    } catch (err) {
      showBanner(form, `Failed: ${err.message}`, 'error');
      createBtn.disabled = false;
      createBtn.textContent = 'Create Project';
    }
  };
  form.appendChild(createBtn);

  panel.appendChild(form);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showBanner(container, message, type = 'success') {
  const banner = document.createElement('div');
  banner.className = `studio-banner ${type}`;
  banner.textContent = message;
  container.appendChild(banner);
  setTimeout(() => banner.remove(), 4000);
}
