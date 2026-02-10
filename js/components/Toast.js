import { html } from '../lib.js';
import { toastMessage, toastVisible } from '../signals.js';

let toastTimer = null;

export function toast(msg) {
  clearTimeout(toastTimer);
  toastMessage.value = msg;
  toastVisible.value = true;
  toastTimer = setTimeout(() => { toastVisible.value = false; }, 2500);
}

export function Toast() {
  return html`<div class=${`toast ${toastVisible.value ? 'visible' : ''}`} id="toast">
    ${toastMessage.value}
  </div>`;
}
