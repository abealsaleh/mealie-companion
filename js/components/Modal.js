import { html } from '../lib.js';

export function Modal({ id, visible, onClose, class: cls = '', children }) {
  const onClick = (e) => {
    if (e.target === e.currentTarget && onClose) onClose();
  };

  return html`<div class=${`modal-overlay${cls ? ' ' + cls : ''} ${visible ? 'visible' : ''}`} id=${id} onclick=${onClick}>
    ${children}
  </div>`;
}
