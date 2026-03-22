import { apiFetch } from '../core/api.js';

export async function getNovels() {
  return await apiFetch('/GetNovels', {}, { returnFull: true });
}

export async function getChapters(draftId) {
  return await apiFetch(`/GetChapters?draft_id=${draftId}`);
}

export async function getChapter(chapterId) {
  return await apiFetch(`/GetChapterContent?id=${chapterId}`);
}

export async function recordEvent(eventType, data = {}) {
  try {
    await apiFetch('/RecordEvent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, ...data }),
    });
  } catch {
    // Analytics never break the experience
  }
}
