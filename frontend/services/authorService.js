import { apiFetch } from '../core/api.js';

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
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/UploadFiles');

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
