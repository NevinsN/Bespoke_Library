import { apiFetch } from '../core/api.js';

export async function getNovels() {
  const res = await apiFetch('/GetNovels'); 
  return res ?? [];
}

export async function getChapters(bookId) {
  const res = await apiFetch(`/GetChapters?manuscript_id=${bookId}`);
  return res ?? [];
}

export async function getChapter(chapterId) {
  const res = await apiFetch(`/GetChapterContent?id=${chapterId}`);
  return res;
}