import { state } from './state.js';

export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 2500);
}

// DRY #5: unified HTML/attribute escaping (escHtml + escAttr merged)
export function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function isUrl(s) {
  return /^https?:\/\//i.test(s.trim());
}

export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// DRY #17: shared delayed-focus helper
export function focusDelayed(selector, ms = 50) {
  setTimeout(() => {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (el) el.focus();
  }, ms);
}

export function initIcons() {
  if (window.lucide) lucide.createIcons();
}

// Tab switching
export function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById(name + '-tab').classList.add('active');
  document.querySelector(`nav button[onclick*="${name}"]`).classList.add('active');
  localStorage.setItem('mealie_active_tab', name);
  if (name === 'shopping' && state.activeListId) {
    // Dynamic import avoids circular dep (ui -> shopping -> ui)
    import('./shopping.js').then(m => m.refreshList());
  }
}

export function restoreActiveTab() {
  const saved = localStorage.getItem('mealie_active_tab');
  if (saved && saved !== 'mealplan') switchTab(saved);
}

// Add panel toggle
export function toggleAddPanel(tab) {
  const modalId = tab === 'mealplan' ? 'mp-add-modal' : 'shop-add-modal';
  const fabId = tab === 'mealplan' ? 'mp-fab' : 'shop-fab';
  const modal = document.getElementById(modalId);
  const fab = document.getElementById(fabId);
  const opening = !modal.classList.contains('visible');
  modal.classList.toggle('visible');
  fab.classList.toggle('fab-active', opening);
  if (opening) {
    initIcons();
    focusDelayed(tab === 'mealplan' ? '#mp-input' : '#add-item-input');
  }
}

export function closeAddPanel(tab) {
  const modalId = tab === 'mealplan' ? 'mp-add-modal' : 'shop-add-modal';
  const fabId = tab === 'mealplan' ? 'mp-fab' : 'shop-fab';
  document.getElementById(modalId).classList.remove('visible');
  document.getElementById(fabId).classList.remove('fab-active');
}

// DRY #9/#10/#11: shared list picker
export function showListPicker(onSelect) {
  if (state.shoppingLists.length === 0) {
    toast('No shopping lists found');
    return false;
  }
  if (state.shoppingLists.length === 1) {
    onSelect(state.shoppingLists[0].id, state.shoppingLists[0].name);
    return true;
  }
  state.listPickerCallback = onSelect;
  state.listPickerKbIndex = -1;
  const listEl = document.getElementById('list-picker-options');
  listEl.innerHTML = state.shoppingLists.map(l => `
    <div class="label-modal-item" onclick="pickList('${l.id}','${esc(l.name)}')">
      <span class="lm-check">${l.id === state.activeListId ? '✓' : ''}</span> ${esc(l.name)}
    </div>
  `).join('');
  const modal = document.getElementById('list-picker-modal');
  modal.classList.add('visible');
  focusDelayed(modal);
  return true;
}

export function pickList(listId, listName) {
  document.getElementById('list-picker-modal').classList.remove('visible');
  const cb = state.listPickerCallback;
  state.listPickerCallback = null;
  if (cb) cb(listId, listName);
}

export function closeListPicker() {
  document.getElementById('list-picker-modal').classList.remove('visible');
  state.listPickerCallback = null;
}

// DRY #3/#4: keyboard navigation factory + shared highlight
export function makeKeyboardNav({ getDropdown, isVisible, getIndex, setIndex, hideDropdown, onFallbackEnter, itemSelector }) {
  const selector = itemSelector || '.ac-item, .item';
  return function(e) {
    const dropdown = getDropdown();
    const items = dropdown.querySelectorAll(selector);
    const idx = getIndex();
    if (isVisible(dropdown) && items.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); const n = Math.min(idx + 1, items.length - 1); setIndex(n); highlightDropdownItem(items, n); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); const n = Math.max(idx - 1, -1); setIndex(n); highlightDropdownItem(items, n); return; }
      if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); items[idx].click(); return; }
      if (e.key === 'Escape') { hideDropdown(); setIndex(-1); return; }
    }
    if (e.key === 'Enter' && onFallbackEnter) onFallbackEnter();
  };
}

export function highlightDropdownItem(items, index) {
  items.forEach((el, i) => el.classList.toggle('kb-active', i === index));
  if (index >= 0) items[index].scrollIntoView({ block: 'nearest' });
}
