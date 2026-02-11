import { html, useState, useEffect, useRef, useCallback } from '../lib.js';
import { api, searchAndSortFoods, findOrCreateFood } from '../api.js';
import { shoppingLists, activeListId, activeListItems, allLabels, labelMap, listAddPending } from '../signals.js';
import { getItemDisplayName, getItem as getItemUtil, esc } from '../utils.js';
import { toast } from './Toast.js';
import { Icon } from './Icon.js';
import { useAutocomplete } from './Autocomplete.js';
import { Modal } from './Modal.js';
import { useRefresh, useTogglePanel } from '../hooks.js';

export async function loadLabels() {
  const data = await api('/groups/labels');
  allLabels.value = (data.items || data);
}

export async function loadShoppingLists() {
  const data = await api('/households/shopping/lists');
  shoppingLists.value = data.items || data;
  if (!activeListId.value && shoppingLists.value.length > 0) {
    activeListId.value = shoppingLists.value[0].id;
  }
  if (activeListId.value) await refreshList();
}

export async function refreshList() {
  if (!activeListId.value) return;
  if (listAddPending.value) return;
  try {
    const data = await api(`/households/shopping/lists/${activeListId.value}`);
    activeListItems.value = data.listItems || [];
  } catch {
    toast('Failed to load list');
  }
}

function selectList(id) {
  activeListId.value = id;
  activeListItems.value = [];
  refreshList();
}

async function updateItem(itemId, mutate, revert, errorMsg) {
  const items = [...activeListItems.value];
  const idx = items.findIndex(i => i.id === itemId);
  if (idx === -1) return;
  const item = { ...items[idx] };
  mutate(item);
  items[idx] = item;
  activeListItems.value = items;
  try {
    await api(`/households/shopping/items/${itemId}`, { method: 'PUT', body: item });
  } catch {
    const revertItems = [...activeListItems.value];
    const rIdx = revertItems.findIndex(i => i.id === itemId);
    if (rIdx !== -1) {
      const rItem = { ...revertItems[rIdx] };
      revert(rItem);
      revertItems[rIdx] = rItem;
      activeListItems.value = revertItems;
    }
    toast(errorMsg);
  }
}

async function toggleItem(itemId, checked) {
  const now = new Date().toISOString();
  await updateItem(itemId,
    item => { item.checked = checked; item.updateAt = now; item.updatedAt = now; },
    item => { item.checked = !checked; },
    'Failed to update item'
  );
}

async function adjustQty(itemId, delta) {
  const item = activeListItems.value.find(i => i.id === itemId);
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

export function ShoppingList() {
  const [selectedFood, setSelectedFood] = useState(null);
  const [catBarVisible, setCatBarVisible] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [editItemId, setEditItemId] = useState(null);
  const [editNoteOriginal, setEditNoteOriginal] = useState(null);
  const [labelSearchQuery, setLabelSearchQuery] = useState('');
  const [labelKbIndex, setLabelKbIndex] = useState(-1);
  const [createdLabel, setCreatedLabel] = useState(null);
  const inputRef = useRef(null);
  const editNoteRef = useRef(null);
  const labelSearchRef = useRef(null);
  const scrollRef = useRef(null);
  const { refreshing, handleRefresh } = useRefresh(refreshList);
  const { panelOpen: addPanelOpen, setPanelOpen: setAddPanelOpen, togglePanel } = useTogglePanel(inputRef);
  const items = activeListItems.value;
  const lists = shoppingLists.value;

  // Pull to refresh
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    let startY = 0, pulling = false;
    const indicator = scroll.querySelector('.pull-indicator');
    const onStart = (e) => { if (scroll.scrollTop === 0) { startY = e.touches[0].clientY; pulling = true; } };
    const onMove = (e) => {
      if (!pulling) return;
      const diff = e.touches[0].clientY - startY;
      if (diff > 60) { indicator.style.display = 'block'; indicator.textContent = '\u2193 Release to refresh'; }
      else if (diff > 0) { indicator.style.display = 'block'; indicator.textContent = '\u2193 Pull to refresh'; }
    };
    const onEnd = () => {
      if (!pulling) return;
      if (indicator.textContent.includes('Release')) {
        indicator.textContent = 'Refreshing...';
        refreshList().then(() => { indicator.style.display = 'none'; });
      } else { indicator.style.display = 'none'; }
      pulling = false;
    };
    scroll.addEventListener('touchstart', onStart, { passive: true });
    scroll.addEventListener('touchmove', onMove, { passive: true });
    scroll.addEventListener('touchend', onEnd);
    return () => {
      scroll.removeEventListener('touchstart', onStart);
      scroll.removeEventListener('touchmove', onMove);
      scroll.removeEventListener('touchend', onEnd);
    };
  }, []);

  const ac = useAutocomplete({
    onSearch: searchAndSortFoods,
    onSelect: (f) => selectFoodItem(f),
    onFooterSelect: () => addItemDirect(),
    onFallbackEnter: () => addItemFromInput(),
    footerCount: 1,
  });

  const onAddItemInput = () => {
    const val = inputRef.current?.value.trim() || '';
    setSelectedFood(null);
    setCatBarVisible(val.length >= 2);
    ac.search(val);
  };

  const selectFoodItem = (food) => {
    if (inputRef.current) inputRef.current.value = food.name;
    ac.close();
    setSelectedFood(food);
    if (food.labelId) {
      const catEl = document.getElementById('category-override');
      if (catEl) catEl.value = food.labelId;
    }
    addItemFromInput(food);
  };

  const addItemDirect = () => {
    setSelectedFood(null);
    ac.close();
    addItemFromInput(null);
  };

  const addItemFromInput = async (foodOverride) => {
    const text = inputRef.current?.value.trim();
    if (!text) return;
    const overrideLabel = document.getElementById('category-override')?.value || '';
    ac.close();
    setCatBarVisible(false);
    setAddLoading(true);
    const food = foodOverride !== undefined ? foodOverride : selectedFood;
    try {
      const body = { shoppingListId: activeListId.value, checked: false };
      const hasLabel = overrideLabel || (food && food.labelId);
      if (food) {
        body.foodId = food.id;
        if (overrideLabel && overrideLabel !== food.labelId) body.labelId = overrideLabel;
      } else {
        const found = await findOrCreateFood(text, overrideLabel || null);
        if (found) {
          body.foodId = found.id;
          if (overrideLabel) body.labelId = overrideLabel;
        } else {
          body.note = text;
          if (overrideLabel) body.labelId = overrideLabel;
        }
      }
      await api('/households/shopping/items', { method: 'POST', body });
      if (inputRef.current) inputRef.current.value = '';
      setSelectedFood(null);
      const catEl = document.getElementById('category-override');
      if (catEl) catEl.value = '';
      toast(`Added "${text}"`);
      await refreshList();
      if (!hasLabel) {
        const added = activeListItems.value.find(i =>
          (!i.checked) && (
            (i.food?.name && i.food.name.toLowerCase() === text.toLowerCase()) ||
            (i.note && i.note.toLowerCase() === text.toLowerCase())
          )
        );
        if (added) openEditModal(added.id);
      }
    } catch {
      toast('Failed to add item');
    } finally {
      setAddLoading(false);
    }
  };

  const clearCheckedItems = async () => {
    const checked = items.filter(i => i.checked);
    if (checked.length === 0) return;
    activeListItems.value = items.filter(i => !i.checked);
    for (const item of checked) {
      try { await api(`/households/shopping/items/${item.id}`, { method: 'DELETE' }); }
      catch (e) { console.error('Failed to delete item:', e); }
    }
    toast(`Cleared ${checked.length} items`);
  };

  // Edit modal
  const openEditModal = (itemId) => {
    setEditItemId(itemId);
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const isFoodLinked = !!item.food?.name;
    if (isFoodLinked) {
      setEditNoteOriginal(item.note || '');
    } else {
      setEditNoteOriginal(null);
    }
    setLabelSearchQuery('');
    setLabelKbIndex(-1);
    setTimeout(() => labelSearchRef.current?.focus(), 100);
  };

  const closeEditModal = async () => {
    const itemId = editItemId;
    setEditItemId(null);
    if (itemId && editNoteOriginal !== null) {
      const newNote = editNoteRef.current?.value.trim() || '';
      if (newNote !== editNoteOriginal) {
        await updateItem(itemId,
          item => { item.note = newNote; },
          item => { item.note = editNoteOriginal; },
          'Failed to update note'
        );
      }
    }
    setEditNoteOriginal(null);
  };

  const setItemLabel = async (labelId) => {
    const itemId = editItemId;
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    await closeEditModal();
    const oldLabelId = item.labelId;
    const oldLabel = item.label;
    const newItems = [...activeListItems.value];
    const idx = newItems.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    newItems[idx] = { ...newItems[idx], labelId, label: labelId ? labelMap.value[labelId] || { id: labelId, name: '...' } : null };
    activeListItems.value = newItems;
    try {
      await api(`/households/shopping/items/${itemId}`, { method: 'PUT', body: { ...newItems[idx], labelId: labelId || null } });
      const foodId = item.foodId || item.food?.id;
      if (foodId) {
        try {
          const food = await api(`/foods/${foodId}`);
          await api(`/foods/${foodId}`, { method: 'PUT', body: { ...food, labelId: labelId || null } });
        } catch (e) { console.warn('Could not update food label:', e); }
      }
      await refreshList();
    } catch {
      const revertItems = [...activeListItems.value];
      const rIdx = revertItems.findIndex(i => i.id === itemId);
      if (rIdx !== -1) {
        revertItems[rIdx] = { ...revertItems[rIdx], labelId: oldLabelId, label: oldLabel };
        activeListItems.value = revertItems;
      }
      toast('Failed to update category');
    }
  };

  const createLabel = async (name) => {
    try {
      const newLabel = await api('/groups/labels', { method: 'POST', body: { name } });
      allLabels.value = [...allLabels.value, newLabel];
      toast(`Created "${name}"`);
      if (editItemId) setItemLabel(newLabel.id);
      else closeEditModal();
    } catch {
      toast('Failed to create category');
    }
  };

  const handleLabelKeydown = (e) => {
    const visibleLabels = getFilteredLabels();
    const hasCreate = labelSearchQuery.length >= 2 && !visibleLabels.find(l => l.name.toLowerCase() === labelSearchQuery.toLowerCase());
    const total = visibleLabels.length + 1 + (hasCreate ? 1 : 0); // +1 for "No label"
    if (e.key === 'ArrowDown') { e.preventDefault(); setLabelKbIndex(i => Math.min(i + 1, total - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setLabelKbIndex(i => Math.max(i - 1, -1)); return; }
    if (e.key === 'Enter' && labelKbIndex >= 0) {
      e.preventDefault();
      if (labelKbIndex === 0) setItemLabel('');
      else if (labelKbIndex <= visibleLabels.length) setItemLabel(visibleLabels[labelKbIndex - 1].id);
      else if (hasCreate) createLabel(labelSearchQuery);
      return;
    }
    if (e.key === 'Escape') { closeEditModal(); }
  };

  const getFilteredLabels = () => {
    const q = labelSearchQuery.toLowerCase();
    return [...allLabels.value]
      .sort((a, b) => {
        const aIsCurrent = a.id === editCurrentLabelId;
        const bIsCurrent = b.id === editCurrentLabelId;
        if (aIsCurrent !== bIsCurrent) return aIsCurrent ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .filter(l => !q || l.name.toLowerCase().includes(q));
  };

  const unchecked = items.filter(i => !i.checked);
  const checked = items.filter(i => i.checked);
  const editItem = editItemId ? items.find(i => i.id === editItemId) : null;
  const editIsFoodLinked = editItem ? !!editItem.food?.name : false;
  const editCurrentLabelId = editItem ? (editItem.labelId || editItem.label?.id || editItem.food?.label?.id || null) : null;
  const filteredLabels = getFilteredLabels();
  const hasCreateOption = labelSearchQuery.length >= 2 && !filteredLabels.find(l => l.name.toLowerCase() === labelSearchQuery.toLowerCase());

  const renderItem = (item, isChecked) => {
    const name = getItemDisplayName(item);
    const qty = item.quantity || 1;
    const itemNote = item.note || '';
    const isFoodLinked = !!item.food?.name;
    const inlineNote = isFoodLinked && itemNote ? itemNote : '';
    return html`
      <div class=${`shop-item ${isChecked ? 'checked' : ''}`} key=${item.id}>
        <div class="check-circle" data-action="toggle-item" data-item-id=${item.id} data-checked=${String(!isChecked)}
             onclick=${() => toggleItem(item.id, !isChecked)}></div>
        <span class="item-text" data-action="toggle-item" data-item-id=${item.id} data-checked=${String(!isChecked)}
              onclick=${() => toggleItem(item.id, !isChecked)}>
          ${name}${inlineNote ? html` <span style="color:var(--text-dim);font-size:13px">(${inlineNote})</span>` : ''}
        </span>
        <div class="item-actions">
          <div class="qty-stepper">
            <button data-action="adjust-qty" data-item-id=${item.id} data-delta="-1" title="Decrease"
                    onclick=${() => adjustQty(item.id, -1)}>${'\u2212'}</button>
            <span class="qty-val">${qty}</span>
            <button data-action="adjust-qty" data-item-id=${item.id} data-delta="1" title="Increase"
                    onclick=${() => adjustQty(item.id, 1)}>+</button>
          </div>
          <button class="item-edit-btn" data-action="open-edit" data-item-id=${item.id} title="Edit item"
                  onclick=${() => openEditModal(item.id)}>
            <${Icon} name="pencil" size=${14} />
          </button>
        </div>
      </div>
    `;
  };

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

  const sortedChecked = [...checked].sort((a, b) => {
    const aTime = a.updateAt || a.updatedAt || '';
    const bTime = b.updateAt || b.updatedAt || '';
    return bTime.localeCompare(aTime);
  });

  const rawVal = inputRef.current?.value?.trim() || '';

  return html`
    <div id="shopping-tab" class="tab active">
      <div class="list-header">
        <select id="list-selector" onchange=${(e) => selectList(e.target.value)}>
          ${lists.map(l => html`<option value=${l.id} key=${l.id} selected=${l.id === activeListId.value}>${l.name}</option>`)}
        </select>
        <button class="btn btn-outline btn-sm" onclick=${handleRefresh} disabled=${refreshing}
                style="display:flex;align-items:center;padding:8px">
          <span class=${refreshing ? 'icon-spin' : ''}><${Icon} name="refresh-cw" size=${16} /></span>
        </button>
      </div>
      <div class="shopping-scroll" id="shopping-scroll" ref=${scrollRef}>
        <div class="pull-indicator" id="pull-indicator">${'\u2193'} Pull to refresh</div>
        <div id="shopping-content">
          ${unchecked.length === 0 && checked.length === 0 && items.length === 0
            ? html`<div class="empty-state">Select a shopping list to get started</div>`
            : unchecked.length === 0 && checked.length === 0
            ? html`<div class="empty-state">List is empty. Add items above!</div>`
            : html`
              ${sortedGroups.map(groupName => html`
                <div class="category-group" key=${groupName}>
                  <div class="category-header" data-action="collapse-toggle"
                       onclick=${(e) => e.currentTarget.classList.toggle('collapsed')}>
                    <span class="arrow">${'\u25BC'}</span>
                    <span class="cat-name">${groupName}</span>
                    <span class="cat-count">${groups[groupName].length}</span>
                  </div>
                  <div class="category-items">
                    ${groups[groupName].map(i => renderItem(i, false))}
                  </div>
                </div>
              `)}
              ${checked.length > 0 ? html`
                <div class="checked-section">
                  <div class="checked-header">
                    <span>Checked (${checked.length})</span>
                    <button id="clear-checked-btn" class="btn btn-outline btn-sm"
                            data-action="clear-checked" onclick=${clearCheckedItems}>Clear checked</button>
                  </div>
                  ${sortedChecked.map(i => renderItem(i, true))}
                </div>
              ` : null}
            `}
        </div>
      </div>
      <button class=${`fab ${addPanelOpen ? 'fab-active' : ''}`} onclick=${togglePanel} id="shop-fab">
        <${Icon} name="plus" size=${24} />
      </button>
      <${Modal} id="shop-add-modal" visible=${addPanelOpen} onClose=${() => setAddPanelOpen(false)} class="add-modal-overlay">
        <div class="modal-panel add-modal">
          <div class="modal-header modal-header-bordered">
            <span>Add Item</span>
            <button onclick=${() => setAddPanelOpen(false)}><${Icon} name="x" size=${18} /></button>
          </div>
          <div class="add-modal-body" ref=${ac.containerRef}>
            <div class="add-modal-input-row">
              <input type="text" id="add-item-input" ref=${inputRef} placeholder="Add an item..." autocomplete="off"
                     oninput=${onAddItemInput} onfocus=${onAddItemInput} onkeydown=${ac.handleKeydown} />
              <button class="btn btn-primary btn-sm" id="add-item-btn" onclick=${() => addItemFromInput()}
                      style="display:flex;align-items:center;gap:4px" disabled=${addLoading}>
                ${addLoading
                  ? html`<span class="spinner" style="width:14px;height:14px;border-width:2px;margin:0"></span>`
                  : html`<${Icon} name="plus" size=${16} />`}
                <span id="add-item-label">${addLoading ? '' : 'Add'}</span>
              </button>
            </div>
            <div class=${`autocomplete-dropdown ${ac.visible ? 'visible' : ''}`} id="autocomplete-dropdown">
              ${ac.items.map((f, i) => html`
                <div key=${f.id} class=${`ac-item ${i === ac.kbIndex ? 'kb-active' : ''}`}
                     data-action="select-food" data-food-id=${f.id} data-food-name=${f.name} data-food-label-id=${f.labelId || ''}
                     onclick=${() => selectFoodItem(f)}>
                  ${f.name}
                  ${f.label?.name ? html`<span class="ac-label">${f.label.name}</span>` : null}
                </div>
              `)}
              ${ac.visible ? html`
                <div class=${`ac-item ac-new ${ac.kbIndex === ac.items.length ? 'kb-active' : ''}`}
                     data-action="add-direct" onclick=${addItemDirect}>
                  + Add "${rawVal}" as new item
                </div>
              ` : null}
            </div>
            <div class=${`category-select-bar ${catBarVisible ? 'visible' : ''}`} id="category-select-bar">
              <span>Category:</span>
              <select id="category-override">
                <option value="">Auto / None</option>
                ${[...allLabels.value].sort((a, b) => a.name.localeCompare(b.name)).map(l =>
                  html`<option value=${l.id} key=${l.id}>${l.name}</option>`
                )}
              </select>
            </div>
          </div>
        </div>
      <//>

      ${html`
        <${Modal} id="edit-item-modal" visible=${!!editItemId} onClose=${closeEditModal}>
          <div class="modal-panel edit-item-panel">
            <div class="modal-header modal-header-bordered">
              <span id="edit-modal-title">${editItem ? getItemDisplayName(editItem) : 'Edit Item'}</span>
              <button onclick=${closeEditModal}><${Icon} name="x" size=${18} /></button>
            </div>
            <div class="edit-modal-body">
              ${editIsFoodLinked ? html`
                <div id="edit-note-section">
                  <label class="edit-section-label">Note</label>
                  <textarea id="edit-note-input" ref=${editNoteRef} placeholder="Add a note...">${editItem?.note || ''}</textarea>
                </div>
              ` : null}
              <label class="edit-section-label">Category</label>
              <div class="label-modal-search">
                <input type="text" id="edit-label-search" ref=${labelSearchRef} placeholder="Search categories..." autocomplete="off"
                       value=${labelSearchQuery}
                       oninput=${(e) => { setLabelSearchQuery(e.target.value.trim()); setLabelKbIndex(-1); }}
                       onkeydown=${handleLabelKeydown} />
              </div>
              <div class="label-modal-list" id="edit-label-list">
                <div class=${`label-modal-item ${!editCurrentLabelId ? 'active' : ''} ${labelKbIndex === 0 ? 'kb-active' : ''}`}
                     data-action="set-label" data-label-id="" onclick=${() => setItemLabel('')}>
                  <span class="lm-check">${!editCurrentLabelId ? '\u2713' : ''}</span> No label
                </div>
                ${filteredLabels.map((l, i) => {
                  const isActive = editCurrentLabelId === l.id;
                  return html`
                    <div key=${l.id} class=${`label-modal-item ${isActive ? 'active' : ''} ${labelKbIndex === i + 1 ? 'kb-active' : ''}`}
                         data-action="set-label" data-label-id=${l.id} onclick=${() => setItemLabel(l.id)}>
                      <span class="lm-check">${isActive ? '\u2713' : ''}</span> ${l.name}
                    </div>
                  `;
                })}
                ${hasCreateOption ? html`
                  <div class=${`label-modal-item lm-create ${labelKbIndex === filteredLabels.length + 1 ? 'kb-active' : ''}`}
                       onclick=${() => createLabel(labelSearchQuery)}>
                    <span class="lm-check">+</span> Create "${labelSearchQuery}"
                  </div>
                ` : null}
              </div>
            </div>
          </div>
        <//>
      `}
    </div>
  `;
}
