/**
 * api.js — Central fetch wrapper.
 * Sends Auth0 Bearer token on every request.
 */

import { getAccessToken } from './auth0Client.js';

const BASE_URL = 'https://bespoke-api.nicholasnevins.org/api';

export async function getAuthHeader() {
  return await getAccessToken();
}

export async function apiFetch(endpoint, options = {}, { returnFull = false } = {}) {
  try {
    const url   = `${BASE_URL}${endpoint}`;
    const token = await getAccessToken();

    const headers = { ...(options.headers || {}) };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log('API CALL:', url);
    console.log('Header present:', !!token);

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
