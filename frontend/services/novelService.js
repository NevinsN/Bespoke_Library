import { apiFetch } from '../core/api.js';

export async function getNovels() {
  return await apiFetch('/GetNovels', {}, { returnFull: true });
}

export async function getChapters(draftId) {
  return await apiFetch(`/GetChapters?draft_id=${draftId}`);
}

export async function getChapter(chapterId) {
  return await apiFetch(`/GetChapterContent?id=${chapterId}`, {}, { returnFull: true });
}
