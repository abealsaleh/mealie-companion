import { html, useState, useEffect, useRef } from '../lib.js';
import { shoppingLists, activeListId, listPickerCallback } from '../signals.js';
import { Modal } from './Modal.js';
import { Icon } from './Icon.js';
import { esc } from '../utils.js';

export function showListPicker(onSelect) {
  const lists = shoppingLists.value;
  if (lists.length === 0) {
    return false;
  }
  if (lists.length === 1) {
    onSelect(lists[0].id, lists[0].name);
    return true;
  }
  listPickerCallback.value = onSelect;
  return true;
}

export function ListPicker() {
  const cb = listPickerCallback.value;
  const visible = cb !== null;
  const lists = shoppingLists.value;
  const [kbIndex, setKbIndex] = useState(-1);
  const modalRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setKbIndex(-1);
      setTimeout(() => modalRef.current?.focus(), 50);
    }
  }, [visible]);

  const close = () => { listPickerCallback.value = null; };

  const pick = (listId, listName) => {
    listPickerCallback.value = null;
    if (cb) cb(listId, listName);
  };

  const handleKeydown = (e) => {
    if (!visible) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setKbIndex(i => Math.min(i + 1, lists.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setKbIndex(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter' && kbIndex >= 0) { e.preventDefault(); pick(lists[kbIndex].id, lists[kbIndex].name); }
    else if (e.key === 'Escape') { close(); }
  };

  return html`
    <${Modal} id="list-picker-modal" visible=${visible} onClose=${close}>
      <div class="modal-panel label-modal" tabindex="-1" ref=${modalRef} onkeydown=${handleKeydown}>
        <div class="modal-header modal-header-bordered">
          <span>Add ingredients to...</span>
          <button onclick=${close}><${Icon} name="x" size=${18} /></button>
        </div>
        <div class="label-modal-list" id="list-picker-options">
          ${lists.map((l, i) => html`
            <div key=${l.id} class=${`label-modal-item ${i === kbIndex ? 'kb-active' : ''}`}
                 data-action="pick-list" data-list-id=${l.id} data-list-name=${l.name}
                 onclick=${() => pick(l.id, l.name)}>
              <span class="lm-check">${l.id === activeListId.value ? '\u2713' : ''}</span> ${l.name}
            </div>
          `)}
        </div>
      </div>
    <//>
  `;
}
