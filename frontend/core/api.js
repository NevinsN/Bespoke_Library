/**
 * api.js — Central fetch wrapper.
 * Success/failure is driven by HTTP status, not payload shape.
 * Sends Auth0 Bearer token on every request.
 */

import { getAccessToken } from './auth0Client.js';

const BASE_URL = 'https://bespoke-api.nicholasnevins.org/api';

export async function getAuthHeader() {
  return await getAccessToken();
}

export async function apiFetch(endpoint, options = {}, { returnFull = false } = {}) {
  const url   = `${BASE_URL}${endpoint}`;
  const token = await getAccessToken();

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
    const message =
      payload?.error ||
      payload?.message ||
      `API request failed (${response.status})`;
    throw new Error(message);
  }

  if (returnFull) return payload;
  return payload?.data ?? payload;
}
