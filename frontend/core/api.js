const BASE_URL = 'https://bespoke-library.onrender.com/api';

// Cache the encoded principal for the session
let _principal = null;

async function getEncodedPrincipal() {
  if (_principal !== undefined) return _principal;
  try {
    const res  = await fetch('/.auth/me');
    const data = await res.json();
    const cp   = data.clientPrincipal;
    if (!cp) { _principal = null; return null; }
    // Re-encode exactly as SWA would send it to a managed function
    _principal = btoa(JSON.stringify(cp));
  } catch {
    _principal = null;
  }
  return _principal;
}

export async function apiFetch(endpoint, options = {}, { returnFull = false } = {}) {
  try {
    const url       = `${BASE_URL}${endpoint}`;
    const principal = await getEncodedPrincipal();

    const headers = {
      ...(options.headers || {}),
    };

    if (principal) {
      headers['x-ms-client-principal'] = principal;
    }

    console.log("API CALL:", url);

    const response = await fetch(url, { ...options, headers });

    const text = await response.text();
    console.log("RAW RESPONSE:", text.substring(0, 200));

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

    return returnFull ? result : result.data;

  } catch (err) {
    console.error("Fetch failed:", err);
    throw err;
  }
}
