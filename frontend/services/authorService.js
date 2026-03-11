import { apiFetch, getAuthHeader } from '../core/api.js';

/**
 * Create a new series + manuscript + draft.
 */
export async function createProject({ series_name, book, draft_name, display_name }) {
  return await apiFetch('/CreateProject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ series_name, book, draft_name, display_name }),
  });
}

/**
 * Get all drafts for a manuscript.
 */
export async function getDrafts(manuscriptId) {
  return await apiFetch(`/GetDrafts?manuscript_id=${manuscriptId}`);
}

/**
 * Upload chapters to a specific draft.
 * @param {string} draftId
 * @param {Array}  files         — [{ filename, content, slot? }]
 * @param {boolean} sequential
 * @param {function} onProgress  — optional callback(percent)
 */
export async function uploadChapters(draftId, files, sequential = true, onProgress = null) {
  const formData = new FormData();
  formData.append('draft_id', draftId);
  formData.append('sequential', sequential ? 'true' : 'false');

  files.forEach(f => {
    const blob = new Blob([f.content], { type: 'text/plain' });
    formData.append('files', blob, f.filename);
    if (!sequential && f.slot != null) {
      formData.append(`slot_${f.filename}`, String(f.slot));
    }
  });

  // Use XMLHttpRequest so we can track upload progress
  const authHeader = await getAuthHeader();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://bespoke-api.nicholasnevins.org/api/UploadFiles');
    if (authHeader) xhr.setRequestHeader('x-ms-client-principal', authHeader);

    if (onProgress) {
      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.onload = () => {
      let result;
      try { result = JSON.parse(xhr.responseText); }
      catch { return reject(new Error('Invalid JSON from server')); }

      if (!result.success) return reject(new Error(result.error || 'Upload failed'));
      resolve(result.data);
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}


/**
 * Get only manuscripts where the current user is owner or author.
 * This is the exclusive data source for Author Studio — never use
 * getNovels() inside the studio as it includes read-only manuscripts.
 */
export async function getAuthoredManuscripts() {
  return await apiFetch('/GetAuthoredManuscripts');
}


/**
 * Create an invite link for a scope.
 */
export async function createInvite({ scope_type, scope_id, expires_days = 7, max_uses = 1 }) {
  return await apiFetch('/CreateInvite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope_type, scope_id, expires_days, max_uses }),
  });
}

/**
 * Redeem an invite token (called after login).
 */
export async function redeemInvite(token) {
  return await apiFetch('/RedeemInvite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

/**
 * Revoke an invite link.
 */
export async function revokeInvite(token) {
  return await apiFetch('/RevokeInvite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

/**
 * List active invites for a scope.
 */
export async function listInvites(scope_type, scope_id) {
  return await apiFetch(`/ListInvites?scope_type=${scope_type}&scope_id=${scope_id}`);
}

export async function setDraftVisibility(draftId, isPublic) {
  return await apiFetch('/SetDraftVisibility', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft_id: draftId, public: isPublic }),
  });
}

export async function setChapterStatus(chapterId, status) {
  return await apiFetch('/SetChapterStatus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chapter_id: chapterId, status }),
  });
}

export async function publishDraft(draftId) {
  return await apiFetch('/PublishDraft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft_id: draftId }),
  });
}

export async function deleteChapter(chapterId) {
  return await apiFetch('/DeleteChapter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chapter_id: chapterId }),
  });
}

export async function setCommentsEnabled(draftId, enabled) {
  return await apiFetch('/SetCommentsEnabled', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft_id: draftId, enabled }),
  });
}

export async function exportDraft(draftId, filename) {
  const authHeader = await getAuthHeader();

  const response = await fetch(
    `https://bespoke-api.nicholasnevins.org/api/ExportDraft?draft_id=${draftId}`,
    { headers: authHeader ? { 'x-ms-client-principal': authHeader } : {} }
  );

  if (!response.ok) throw new Error('Export failed');

  const blob = await response.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename || 'manuscript.docx';
  a.click();
  URL.revokeObjectURL(url);
}

export async function reorderChapters(draftId, orderedIds) {
  return await apiFetch('/ReorderChapters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft_id: draftId, ordered_ids: orderedIds }),
  });
}

export async function replaceChapter(chapterId, title, content) {
  return await apiFetch('/ReplaceChapter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chapter_id: chapterId, title, content }),
  });
}
