import { state } from './state.js';
import { api, searchAndSortFoods, findOrCreateFood } from './api.js';
import { toast, esc, initIcons, focusDelayed } from './ui.js';

let selectedFood = null;
let acSearchTimeout = null;
let noteEditItemId = null;
let labelEditItemId = null;

export async function loadLabels() {
  const data = await api('/groups/labels');
  state.allLabels = (data.items || data);
  state.labelMap = {};
  state.allLabels.forEach(l => { state.labelMap[l.id] = l; });
}

export async function loadShoppingLists() {
  const data = await api('/households/shopping/lists');
  state.shoppingLists = data.items || data;
  const sel = document.getElementById('list-selector');
  sel.innerHTML = state.shoppingLists.map(l =>
    `<option value="${l.id}" ${l.id === state.activeListId ? 'selected' : ''}>${esc(l.name)}</option>`
  ).join('');
  if (!state.activeListId && state.shoppingLists.length > 0) {
    state.activeListId = state.shoppingLists[0].id;
  }
  if (state.activeListId) selectList(state.activeListId);
}

export function populateCategoryOverride() {
  const sel = document.getElementById('category-override');
  sel.innerHTML = '<option value="">Auto / None</option>' +
    state.allLabels.sort((a, b) => a.name.localeCompare(b.name))
      .map(l => `<option value="${l.id}">${esc(l.name)}</option>`)
      .join('');
}

export async function selectList(id) {
  state.activeListId = id;
  localStorage.setItem('mealie_active_list', id);
  await refreshList();
}

export async function refreshList() {
  if (!state.activeListId) return;
  const content = document.getElementById('shopping-content');
  content.innerHTML = '<div class="loading-bar visible"><span class="spinner"></span> Loading...</div>';
  try {
    const data = await api(`/households/shopping/lists/${state.activeListId}`);
    state.activeListItems = data.listItems || [];
    renderShoppingList();
  } catch (err) {
    content.innerHTML = `<div class="empty-state">Error loading list</div>`;
    toast('Failed to load list');
  }
}

function getItemDisplayName(item) {
  if (item.food?.name) return item.food.name;
  if (item.note) return item.note;
  if (item.display) return item.display;
  return '(unnamed)';
}

// DRY #16: shared item lookup
function getItem(itemId) {
  return state.activeListItems.find(i => i.id === itemId);
}

export function renderShoppingList() {
  const content = document.getElementById('shopping-content');
  const unchecked = state.activeListItems.filter(i => !i.checked);
  const checked = state.activeListItems.filter(i => i.checked);

  if (unchecked.length === 0 && checked.length === 0) {
    content.innerHTML = '<div class="empty-state">List is empty. Add items above!</div>';
    return;
  }

  const groups = {};
  unchecked.forEach(item => {
    const labelName = item.label?.name || item.food?.label?.name || 'Other';
    if (!groups[labelName]) groups[labelName] = [];
    groups[labelName].push(item);
  });

  const sortedGroups = Object.keys(groups).sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a.localeCompare(b);
  });

  let html = '';
  sortedGroups.forEach(groupName => {
    const items = groups[groupName];
    html += `
      <div class="category-group">
        <div class="category-header" onclick="this.classList.toggle('collapsed')">
          <span class="arrow">\u25BC</span>
          <span class="cat-name">${esc(groupName)}</span>
          <span class="cat-count">${items.length}</span>
        </div>
        <div class="category-items">
          ${items.map(i => renderItem(i, false)).join('')}
        </div>
      </div>
    `;
  });

  if (checked.length > 0) {
    const sortedChecked = [...checked].sort((a, b) => {
      const aTime = a.updateAt || a.updatedAt || '';
      const bTime = b.updateAt || b.updatedAt || '';
      return bTime.localeCompare(aTime);
    });
    html += `
      <div class="checked-section">
        <div class="checked-header">
          <span>Checked (${checked.length})</span>
          <button id="clear-checked-btn" class="btn btn-outline btn-sm" onclick="clearCheckedItems()">Clear checked</button>
        </div>
        ${sortedChecked.map(i => renderItem(i, true)).join('')}
      </div>
    `;
  }

  content.innerHTML = html;
  initIcons();
}

function renderItem(item, isChecked) {
  const name = getItemDisplayName(item);
  const qty = item.quantity || 1;
  const itemNote = item.note || '';
  const isFoodLinked = !!item.food?.name;
  const inlineNote = isFoodLinked && itemNote ? itemNote : '';
  const labelName = item.label?.name || item.food?.label?.name || '';
  const hasNote = isFoodLinked && !!itemNote;
  return `
    <div class="shop-item ${isChecked ? 'checked' : ''}">
      <div class="check-circle" onclick="toggleItem('${item.id}', ${!isChecked})"></div>
      <span class="item-text" onclick="toggleItem('${item.id}', ${!isChecked})">${esc(name)}${inlineNote ? ` <span style="color:var(--text-dim);font-size:13px">(${esc(inlineNote)})</span>` : ''}</span>
      <div class="item-actions">
        <div class="qty-stepper">
          <button onclick="event.stopPropagation();adjustQty('${item.id}',-1)" title="Decrease">\u2212</button>
          <span class="qty-val">${qty}</span>
          <button onclick="event.stopPropagation();adjustQty('${item.id}',1)" title="Increase">+</button>
        </div>
        ${isFoodLinked ? `<button class="item-note-btn ${hasNote ? 'has-note' : ''}" onclick="event.stopPropagation();openNoteModal('${item.id}')" title="${hasNote ? 'Edit note' : 'Add note'}">
          <i data-lucide="message-square" style="width:14px;height:14px"></i>
        </button>` : ''}
        <button class="item-label-btn" onclick="event.stopPropagation();openLabelModal('${item.id}')">${labelName ? esc(labelName) : 'No label'}</button>
      </div>
    </div>
  `;
}

// DRY #15: shared optimistic update helper
async function updateItem(itemId, mutate, revert, errorMsg) {
  const item = getItem(itemId);
  if (!item) return;
  mutate(item);
  renderShoppingList();
  try {
    await api(`/households/shopping/items/${itemId}`, { method: 'PUT', body: item });
  } catch {
    revert(item);
    renderShoppingList();
    toast(errorMsg);
  }
}

export async function toggleItem(itemId, checked) {
  const now = new Date().toISOString();
  await updateItem(itemId,
    item => { item.checked = checked; item.updateAt = now; item.updatedAt = now; },
    item => { item.checked = !checked; },
    'Failed to update item'
  );
}

export async function adjustQty(itemId, delta) {
  const item = getItem(itemId);
  if (!item) return;
  const oldQty = item.quantity || 1;
  const newQty = Math.max(1, oldQty + delta);
  if (newQty === oldQty) return;
  await updateItem(itemId,
    item => { item.quantity = newQty; },
    item => { item.quantity = oldQty; },
    'Failed to update quantity'
  );
}

export function openNoteModal(itemId) {
  noteEditItemId = itemId;
  const item = getItem(itemId);
  if (!item) return;
  const name = getItemDisplayName(item);
  document.getElementById('note-modal-title').textContent = name;
  document.getElementById('note-modal-input').value = item.note || '';
  document.getElementById('note-modal').classList.add('visible');
  focusDelayed('#note-modal-input', 100);
}

export function closeNoteModal() {
  document.getElementById('note-modal').classList.remove('visible');
  noteEditItemId = null;
}

export async function saveNote() {
  const item = getItem(noteEditItemId);
  if (!item) return;
  const newNote = document.getElementById('note-modal-input').value.trim();
  const oldNote = item.note;
  closeNoteModal();
  await updateItem(item.id,
    item => { item.note = newNote; },
    item => { item.note = oldNote; },
    'Failed to update note'
  );
}

export async function clearCheckedItems() {
  const checked = state.activeListItems.filter(i => i.checked);
  if (checked.length === 0) return;

  const btn = document.getElementById('clear-checked-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Clearing...';
  }
  state.activeListItems = state.activeListItems.filter(i => !i.checked);
  renderShoppingList();

  for (const item of checked) {
    try {
      await api(`/households/shopping/items/${item.id}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to delete item:', e);
    }
  }
  toast(`Cleared ${checked.length} items`);
}

// --- Autocomplete ---
export function onAddItemInput() {
  const val = document.getElementById('add-item-input').value.trim();
  const dropdown = document.getElementById('autocomplete-dropdown');
  const catBar = document.getElementById('category-select-bar');
  selectedFood = null;

  if (val.length < 2) {
    dropdown.classList.remove('visible');
    catBar.classList.remove('visible');
    return;
  }

  catBar.classList.add('visible');
  clearTimeout(acSearchTimeout);
  acSearchTimeout = setTimeout(() => searchFoods(val), 200);
}

// DRY #7: uses shared searchAndSortFoods
async function searchFoods(query) {
  const dropdown = document.getElementById('autocomplete-dropdown');
  state.acKbIndex = -1;
  try {
    const foods = await searchAndSortFoods(query);
    const rawVal = document.getElementById('add-item-input').value.trim();
    let html = foods.map(f => {
      const labelName = f.label?.name || '';
      const fData = esc(JSON.stringify({ id: f.id, name: f.name, labelId: f.labelId || '' }));
      return `
        <div class="ac-item" onclick='selectFoodItem(${fData})'>
          ${esc(f.name)}
          ${labelName ? `<span class="ac-label">${esc(labelName)}</span>` : ''}
        </div>
      `;
    }).join('');
    html += `<div class="ac-item ac-new" onclick="addItemDirect()">+ Add "${esc(rawVal)}" as new item</div>`;
    dropdown.innerHTML = html;
    dropdown.classList.add('visible');
  } catch (e) {
    dropdown.classList.remove('visible');
  }
}

export function selectFoodItem(food) {
  document.getElementById('add-item-input').value = food.name;
  document.getElementById('autocomplete-dropdown').classList.remove('visible');
  selectedFood = food;
  if (food.labelId) {
    document.getElementById('category-override').value = food.labelId;
  }
  addItemFromInput();
}

function setAddButtonLoading(loading) {
  const btn = document.getElementById('add-item-btn');
  const icon = document.getElementById('add-item-icon');
  const label = document.getElementById('add-item-label');
  if (loading) {
    btn.disabled = true;
    icon.style.display = 'none';
    label.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;margin:0"></span>';
  } else {
    btn.disabled = false;
    icon.style.display = '';
    label.textContent = 'Add';
  }
}

// DRY #8: uses shared findOrCreateFood
export async function addItemFromInput() {
  const input = document.getElementById('add-item-input');
  const text = input.value.trim();
  if (!text) return;

  const overrideLabel = document.getElementById('category-override').value;
  document.getElementById('autocomplete-dropdown').classList.remove('visible');
  document.getElementById('category-select-bar').classList.remove('visible');
  setAddButtonLoading(true);

  try {
    const body = { shoppingListId: state.activeListId, checked: false };
    const hasLabel = overrideLabel || (selectedFood && selectedFood.labelId);

    if (selectedFood) {
      body.foodId = selectedFood.id;
      if (overrideLabel && overrideLabel !== selectedFood.labelId) {
        body.labelId = overrideLabel;
      }
    } else {
      const food = await findOrCreateFood(text, overrideLabel || null);
      if (food) {
        body.foodId = food.id;
        if (overrideLabel) body.labelId = overrideLabel;
      } else {
        body.note = text;
        if (overrideLabel) body.labelId = overrideLabel;
      }
    }

    await api('/households/shopping/items', { method: 'POST', body });
    input.value = '';
    selectedFood = null;
    document.getElementById('category-override').value = '';
    toast(`Added "${text}"`);
    await refreshList();

    if (!hasLabel) {
      const added = state.activeListItems.find(i =>
        (!i.checked) && (
          (i.food?.name && i.food.name.toLowerCase() === text.toLowerCase()) ||
          (i.note && i.note.toLowerCase() === text.toLowerCase())
        )
      );
      if (added) openLabelModal(added.id);
    }
  } catch (err) {
    toast('Failed to add item');
  } finally {
    setAddButtonLoading(false);
  }
}

export function addItemDirect() {
  selectedFood = null;
  document.getElementById('autocomplete-dropdown').classList.remove('visible');
  addItemFromInput();
}

// --- Label picker modal ---
export function openLabelModal(itemId) {
  labelEditItemId = itemId;
  const item = getItem(itemId);
  if (!item) return;

  const currentLabelId = item.labelId || item.label?.id || item.food?.label?.id || null;
  const name = getItemDisplayName(item);
  document.getElementById('label-modal-title').textContent = name;

  const list = document.getElementById('label-modal-list');
  let html = `<div class="label-modal-item ${!currentLabelId ? 'active' : ''}" onclick="setItemLabel(null)">
    <span class="lm-check">${!currentLabelId ? '\u2713' : ''}</span> No label
  </div>`;
  state.allLabels.sort((a, b) => a.name.localeCompare(b.name)).forEach(l => {
    const isActive = currentLabelId === l.id;
    html += `<div class="label-modal-item ${isActive ? 'active' : ''}" onclick="setItemLabel('${l.id}')">
      <span class="lm-check">${isActive ? '\u2713' : ''}</span> ${esc(l.name)}
    </div>`;
  });
  list.innerHTML = html;

  document.getElementById('label-modal').classList.add('visible');
  state.labelKbIndex = -1;
  const searchInput = document.getElementById('label-search-input');
  searchInput.value = '';
  focusDelayed(searchInput, 100);
}

export function closeLabelModal() {
  document.getElementById('label-modal').classList.remove('visible');
  labelEditItemId = null;
}

export async function setItemLabel(labelId) {
  const item = getItem(labelEditItemId);
  if (!item) return;
  closeLabelModal();

  const oldLabelId = item.labelId;
  const oldLabel = item.label;
  item.labelId = labelId;
  item.label = labelId ? state.labelMap[labelId] || { id: labelId, name: '...' } : null;
  renderShoppingList();

  try {
    await api(`/households/shopping/items/${item.id}`, {
      method: 'PUT',
      body: { ...item, labelId: labelId || null },
    });
    const foodId = item.foodId || item.food?.id;
    if (foodId) {
      try {
        const food = await api(`/foods/${foodId}`);
        await api(`/foods/${foodId}`, {
          method: 'PUT',
          body: { ...food, labelId: labelId || null },
        });
      } catch (e) {
        console.warn('Could not update food label:', e);
      }
    }
    await refreshList();
  } catch (err) {
    item.labelId = oldLabelId;
    item.label = oldLabel;
    renderShoppingList();
    toast('Failed to update category');
  }
}

export function filterLabelModal() {
  state.labelKbIndex = -1;
  const query = document.getElementById('label-search-input').value.trim();
  const queryLower = query.toLowerCase();
  const items = document.querySelectorAll('#label-modal-list .label-modal-item:not(.lm-create)');
  let exactMatch = false;
  items.forEach(el => {
    const name = el.textContent.toLowerCase().trim();
    const matches = name.includes(queryLower);
    el.style.display = matches ? '' : 'none';
    if (matches && name.replace('\u2713', '').trim() === queryLower) exactMatch = true;
  });
  let createEl = document.querySelector('#label-modal-list .lm-create');
  if (query.length >= 2 && !exactMatch) {
    if (!createEl) {
      createEl = document.createElement('div');
      createEl.className = 'label-modal-item lm-create';
      document.getElementById('label-modal-list').appendChild(createEl);
    }
    createEl.innerHTML = `<span class="lm-check">+</span> Create "${esc(query)}"`;
    createEl.onclick = () => createLabel(query);
    createEl.style.display = '';
  } else if (createEl) {
    createEl.style.display = 'none';
  }
}

async function createLabel(name) {
  try {
    const newLabel = await api('/groups/labels', { method: 'POST', body: { name } });
    state.allLabels.push(newLabel);
    state.labelMap[newLabel.id] = newLabel;
    populateCategoryOverride();
    toast(`Created "${name}"`);
    if (labelEditItemId) {
      setItemLabel(newLabel.id);
    } else {
      closeLabelModal();
    }
  } catch (err) {
    toast('Failed to create category');
  }
}

// --- Pull to refresh ---
export function setupPullToRefresh() {
  const scroll = document.getElementById('shopping-scroll');
  let startY = 0;
  let pulling = false;

  scroll.addEventListener('touchstart', (e) => {
    if (scroll.scrollTop === 0) {
      startY = e.touches[0].clientY;
      pulling = true;
    }
  }, { passive: true });

  scroll.addEventListener('touchmove', (e) => {
    if (!pulling) return;
    const diff = e.touches[0].clientY - startY;
    const indicator = document.getElementById('pull-indicator');
    if (diff > 60) {
      indicator.style.display = 'block';
      indicator.textContent = '\u2193 Release to refresh';
    } else if (diff > 0) {
      indicator.style.display = 'block';
      indicator.textContent = '\u2193 Pull to refresh';
    }
  }, { passive: true });

  scroll.addEventListener('touchend', () => {
    if (!pulling) return;
    const indicator = document.getElementById('pull-indicator');
    if (indicator.textContent.includes('Release')) {
      indicator.textContent = 'Refreshing...';
      refreshList().then(() => {
        indicator.style.display = 'none';
      });
    } else {
      indicator.style.display = 'none';
    }
    pulling = false;
  });
}
