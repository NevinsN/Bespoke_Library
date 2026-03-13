/**
 * api.js — Central fetch wrapper.
 * Success/failure is driven by HTTP status, not payload shape.
 * Sends Auth0 Bearer token on every request.
 */

import { getAccessToken, loginWithRedirect } from './auth0Client.js';

const BASE_URL = 'https://bespoke-api.nicholasnevins.org/api';

export async function getAuthHeader() {
  try {
    return await getAccessToken();
  } catch {
    return null;
  }
}

export async function apiFetch(endpoint, options = {}, { returnFull = false } = {}) {
  const url = `${BASE_URL}${endpoint}`;

  let token = null;
  try {
    token = await getAccessToken();
  } catch (e) {
    // login_required — session expired, redirect to re-auth
    if (e?.error === 'login_required' || e?.error === 'consent_required') {
      await loginWithRedirect();
      return; // navigation will happen
    }
    // Other token errors — proceed without auth, let the server 401
  }

  const headers = { ...(options.headers || {}) };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (networkErr) {
    throw new Error(`Network error: ${networkErr.message}`);
  }

  let payload = null;
  const text = await response.text();
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }

  if (!response.ok) {
    // 401 with no token likely means session expired — trigger re-login
    if (response.status === 401 && !token) {
      await loginWithRedirect();
      return;
    }
    const message =
      payload?.error ||
      payload?.message ||
      `API request failed (${response.status})`;
    throw new Error(message);
  }

  if (returnFull) return payload;
  return payload?.data ?? payload;
}
