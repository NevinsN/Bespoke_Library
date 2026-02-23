import { loadState } from './core/state.js';
import { route } from './core/router.js';

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  route();
});