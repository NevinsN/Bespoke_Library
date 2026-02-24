/**
 * state.js — Backwards-compatible shim.
 * All new code should import from appState.js directly.
 * This file remains so existing imports don't break.
 */
export { getUser as getClientPrincipal } from './appState.js';

// Legacy no-ops — role is now derived from API grants, not localStorage
export function loadState() {}
export function setState() {}
export function toggleRole() {}
export const state = { role: 'reader' };
