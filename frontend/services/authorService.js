import { apiFetch } from '../core/api.js';

/**
 * Upload chapters to a manuscript draft.
 * @param {string} manuscriptId
 * @param {Array} files - [{ filename, content, slot? }]
 * @param {boolean} sequential
 */
export async function processUpload(manuscriptId, files, sequential = true) {
  const formData = new FormData();

  // Extract series/book/draft from manuscriptId (format: series-book-draft)
  const parts = manuscriptId.split('-');
  formData.append('series_name', parts[0] || 'standalone');
  formData.append('book_name', parts[1] || 'novel');
  formData.append('draft_name', parts[2] || 'draft');
  formData.append('sequential', sequential ? 'true' : 'false');

  files.forEach((f, idx) => {
    const blob = new Blob([f.content], { type: 'text/plain' });
    formData.append('files', blob, f.filename);
  });

  const response = await fetch('/api/UploadFiles', {
    method: 'POST',
    body: formData,
  });

  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON response from upload');
  }

  if (!result.success) {
    throw new Error(result.error || 'Upload failed');
  }

  return result.result;
}
