// Utility for mode toggling
export function getRole() {
    return localStorage.getItem('view_as_role') || 'reader';
}

export function toggleRole() {
    const current = getRole();
    const next = current === 'reader' ? 'author' : 'reader';
    localStorage.setItem('view_as_role', next);
    return next;
}

// Unified fetcher
export async function apiFetch(endpoint) {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("API Request Failed");
    return await response.json();
}
