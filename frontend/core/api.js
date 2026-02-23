const BASE_URL = '/api';

export async function apiFetch(endpoint, options = {}) {
    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || "Unknown API Error");
        }

        return result.data; // Return just the data part to the services
    } catch (err) {
        console.error("Fetch failed:", err);
        throw err;
    }
}