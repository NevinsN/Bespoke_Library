const STORAGE_KEY = 'app_state';

export const state = {
  role: 'reader',
  user: null,
  novels: [],
  currentBook: null,
  currentChapter: null
};

export function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    Object.assign(state, JSON.parse(saved));
  }
}

export function setState(partial) {
  Object.assign(state, partial);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function toggleRole() {
  const newRole = state.role === 'reader' ? 'author' : 'reader';
  setState({ role: newRole });
  location.reload();
}

export async function getClientPrincipal() {
    const res = await fetch('/.auth/me');
    const data = await res.json();
    return data.clientPrincipal; // Will be null if not logged in
}