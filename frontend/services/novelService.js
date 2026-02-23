import { apiFetch } from '../core/api.js';

export async function getNovels() {
  return await apiFetch('/GetNovels', {}, { returnFull: true });
}

export async function getChapters(bookId) {
  return await apiFetch(`/GetChapters?manuscript_id=${bookId}`, {}, { returnFull: true });
}

export async function getChapter(chapterId) {
  return await apiFetch(`/GetChapterContent?id=${chapterId}`, {}, { returnFull: true });
}