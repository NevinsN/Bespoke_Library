import { apiFetch } from '../core/api.js';

export const COMMENT_CATEGORIES = [
  { value: 'typo',       label: '✏️ Typo' },
  { value: 'grammar',    label: '📝 Grammar' },
  { value: 'flow',       label: '〰️ Flow' },
  { value: 'question',   label: '❓ Question' },
  { value: 'suggestion', label: '💡 Suggestion' },
  { value: 'general',    label: '💬 General' },
];

export async function createComment(data) {
  return await apiFetch('/CreateComment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function getComments(draftId) {
  return await apiFetch(`/GetComments?draft_id=${draftId}`);
}

export async function setCommentStatus(commentId, status) {
  return await apiFetch('/SetCommentStatus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment_id: commentId, status }),
  });
}

export async function getUnreadCommentCount() {
  const result = await apiFetch('/GetUnreadCommentCount');
  return result?.count ?? 0;
}
