import { apiFetch } from '../core/api.js';

export async function getNovels() {
  const res = await apiFetch('/api/GetNovels');
  return res.data ?? [];
}

export async function getChapters(bookId) {
  const res = await apiFetch(`/api/GetChapters?bookId=${bookId}`);
  return res.data ?? [];
}

export async function getChapter(chapterId) {
  const res = await apiFetch(`/api/GetChapter?id=${chapterId}`);
  return res.data;
}