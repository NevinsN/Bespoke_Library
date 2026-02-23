const BASE_URL = '/api';

export async function apiFetch(endpoint, options = {}) {
    try {
        const url = `${BASE_URL}${endpoint}`;
        console.log("API CALL:", url);

        const response = await fetch(url, options);
        const text = await response.text();
        console.log("RAW RESPONSE:", text);

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} - ${text}`);
        }

        let result;
        try {
            result = JSON.parse(text);
        } catch (e) {
            throw new Error("Invalid JSON response");
        }

        if (!result.success) {
            throw new Error(result.error || "Unknown API Error");
        }

        // ← Return the whole object, not just data
        return result; 

    } catch (err) {
        console.error("Fetch failed:", err);
        throw err;
    }
}