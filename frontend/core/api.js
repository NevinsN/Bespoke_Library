/**
 * api.js — Central fetch wrapper.
 * Success/failure is driven by HTTP status, not payload shape.
 * Sends Auth0 Bearer token on every request.
 *
 * apiFetch NEVER calls loginWithRedirect — it throws AuthError.
 * The caller (or the top-level unhandledrejection handler) decides
 * whether to redirect, show a message, or silently ignore.
 */

import { getAccessToken } from './auth0Client.js';

const BASE_URL = 'https://bespoke-api.nicholasnevins.org/api';

// Typed auth error so callers can distinguish session expiry from other failures
export class AuthError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'AuthError';
  }
}

export async function getAuthHeader() {
  try { return await getAccessToken(); }
  catch { return null; }
}

export async function apiFetch(endpoint, options = {}, { returnFull = false } = {}) {
  const url = `${BASE_URL}${endpoint}`;

  let token = null;
  try {
    token = await getAccessToken();
  } catch {
    // getTokenSilently threw — token stays null, let server decide
  }

  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (networkErr) {
    throw new Error(`Network error: ${networkErr.message}`);
  }

  let payload = null;
  const text = await response.text();
  try { payload = JSON.parse(text); } catch { payload = null; }

  if (!response.ok) {
    // 401 with no token = session genuinely expired — throw AuthError
    if (response.status === 401 && !token) {
      throw new AuthError();
    }
    const message = payload?.error || payload?.message || `API request failed (${response.status})`;
    throw new Error(message);
  }

  if (returnFull) return payload;
  return payload?.data ?? payload;
}
