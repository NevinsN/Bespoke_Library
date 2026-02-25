import { getUser } from './appState.js';

const BASE_URL = 'https://bespoke-library.onrender.com/api';

let _principal = undefined;

async function getEncodedPrincipal() {
  if (_principal !== undefined) return _principal;
  try {
    // Reuse the already-fetched user from appState rather than calling /.auth/me again
    const user = await getUser();
    if (!user) { _principal = null; return null; }

    console.log('Principal userDetails:', user.userDetails);

    _principal = btoa(unescape(encodeURIComponent(JSON.stringify(user))));
  } catch (e) {
    console.error('Failed to encode principal:', e);
    _principal = null;
  }
  return _principal;
}

export async function apiFetch(endpoint, options = {}, { returnFull = false } = {}) {
  try {
    const url       = `${BASE_URL}${endpoint}`;
    const principal = await getEncodedPrincipal();

    const headers = { ...(options.headers || {}) };
    if (principal) {
      headers['x-ms-client-principal'] = principal;
    }

    console.log('API CALL:', url);
    console.log('Header present:', !!principal);

    const response = await fetch(url, { ...options, headers });
    const text     = await response.text();
    console.log('RAW RESPONSE:', text.substring(0, 300));

    if (!response.ok) throw new Error(`API Error: ${response.status} - ${text}`);

    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid JSON response');
    }

    if (!result.success) throw new Error(result.error || 'Unknown API Error');

    return returnFull ? result : result.data;

  } catch (err) {
    console.error('Fetch failed:', err);
    throw err;
  }
}
