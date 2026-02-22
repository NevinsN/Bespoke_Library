export function getRole() {
    return localStorage.getItem('view_as_role') || 'reader';
}

export async function apiFetch(endpoint) {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("API Request Failed");
    return await response.json();
}
