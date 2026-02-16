import { html, useState, useEffect, useRef, useCallback } from '../lib.js';
import { api, searchAndSortFoods, findOrCreateFood } from '../api.js';
import { loadedIngredients, ingredientChecked, ingredientEditing, ingredientSlug, allUnits, activeListId, activeListItems, listAddPending } from '../signals.js';
import { SHOPPING_UNITS } from '../constants.js';
import { ingredientDisplayText, ingLinkBadge, esc, generateUUID, updateSignalArray } from '../utils.js';
import { toast } from './Toast.js';
import { Icon } from './Icon.js';
import { Modal } from './Modal.js';
import { showListPicker } from './ListPicker.js';
import { refreshList } from './ShoppingList.js';
import { useAutocomplete } from './Autocomplete.js';

async function loadUnits() {
  if (allUnits.value.length) return;
  try {
    const data = await api('/units');
    allUnits.value = (data.items || data).sort((a, b) => a.name.localeCompare(b.name));
  } catch { /* non-critical */ }
}

async function saveIngredientsToRecipe() {
  const slug = ingredientSlug.value;
  const ings = loadedIngredients.value;
  if (!slug || ings.length === 0) return;

  const recipeIngredient = ings.map(ing => {
    if (ing.isTitle) {
      return {
        quantity: 0, unit: null, food: null, note: '', title: ing.title,
        referenceId: ing._orig?.referenceId || generateUUID(),
      };
    }
    return {
      quantity: ing.qty || 0,
      unit: ing.unitId ? { id: ing.unitId, name: ing.unitName } : null,
      food: ing.foodId ? { id: ing.foodId, name: ing.name } : null,
      note: ing.foodId ? (ing.ingNote || '') : ing.name,
      title: null,
      referenceId: ing._orig?.referenceId || generateUUID(),
    };
  });

  try {
    await api(`/recipes/${slug}`, { method: 'PATCH', body: { recipeIngredient } });
  } catch { /* silent */ }
}

export function IngredientModal() {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [recipeId, setRecipeId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const [ingEditIdx, setIngEditIdx] = useState(-1);

  const ac = useAutocomplete({
    onSearch: searchAndSortFoods,
    onSelect: (f) => selectIngEditFood(ingEditIdx, f.id, f.name, f.label?.name || ''),
    onFooterSelect: () => createIngEditFood(ingEditIdx, loadedIngredients.value[ingEditIdx]?.name || ''),
    footerCount: 1,
  });

  const ings = loadedIngredients.value;
  const checked = ingredientChecked.value;
  const editing = ingredientEditing.value;
  const units = allUnits.value;

  const open = useCallback(async (slug, name, rId) => {
    loadedIngredients.value = [];
    ingredientChecked.value = [];
    ingredientEditing.value = -1;
    ingredientSlug.value = slug;
    setTitle(name);
    setRecipeId(rId);
    setVisible(true);
    setLoading(true);
    setFailed(false);

    const [recipe] = await Promise.all([
      api(`/recipes/${slug}`).catch(() => null),
      loadUnits(),
    ]);

    if (!recipe) { setLoading(false); setFailed(true); return; }

    const ingredients = recipe.recipeIngredient || [];
    loadedIngredients.value = ingredients.map(ing => ({
      _orig: ing,
      isTitle: !!ing.title,
      title: ing.title || '',
      qty: (ing.quantity && ing.quantity > 0) ? ing.quantity : null,
      unitId: ing.unit?.id || '',
      unitName: ing.unit?.name || '',
      foodId: ing.food?.id || '',
      name: ing.food?.name || ing.note || ing.display || '',
      labelName: ing.food?.label?.name || '',
      ingNote: ing.food ? (ing.note || '') : '',
    }));
    ingredientChecked.value = loadedIngredients.value.map(ing => !ing.isTitle);
    setLoading(false);
  }, []);

  // Expose open function globally for MealPlan
  useEffect(() => { window.__openIngredientModal = open; }, [open]);

  const close = () => {
    setVisible(false);
    saveIngredientsToRecipe();
  };

  const toggleIngredient = (idx) => {
    const newChecked = [...ingredientChecked.value];
    newChecked[idx] = !newChecked[idx];
    ingredientChecked.value = newChecked;
  };

  const openEdit = (idx) => {
    ingredientEditing.value = idx;
    setIngEditIdx(idx);
    ac.close();
    setTimeout(() => {
      const el = document.querySelector('.ing-edit-name');
      if (el) el.focus();
    }, 50);
  };

  const closeEdit = () => {
    ingredientEditing.value = -1;
    ac.close();
  };

  const setQty = (idx, value) => updateSignalArray(loadedIngredients, idx, { qty: value ? parseFloat(value) : null });
  const setName = (idx, value) => updateSignalArray(loadedIngredients, idx, { name: value.trim() });
  const setNote = (idx, value) => updateSignalArray(loadedIngredients, idx, { ingNote: value.trim() });

  const setUnit = (idx, unitId) => {
    const u = units.find(u => u.id === unitId);
    updateSignalArray(loadedIngredients, idx, { unitId, unitName: u ? u.name : '' });
  };

  const onIngEditName = (idx, value) => {
    updateSignalArray(loadedIngredients, idx, { foodId: '', labelName: '', name: value });
    setIngEditIdx(idx);
    ac.search(value.trim());
  };

  const selectIngEditFood = (idx, foodId, foodName, labelName) => {
    updateSignalArray(loadedIngredients, idx, { foodId, name: foodName, labelName: labelName || '' });
    ac.close();
  };

  const createIngEditFood = async (idx, name) => {
    ac.close();
    try {
      const food = await findOrCreateFood(name);
      if (food) {
        updateSignalArray(loadedIngredients, idx, { foodId: food.id, name: food.name, labelName: food.label?.name || '' });
        toast(`Linked to "${food.name}"`);
      } else {
        toast('Failed to create food');
      }
    } catch {
      toast('Failed to create food');
    }
  };

  const removeIngredient = (idx) => {
    const newIngs = [...loadedIngredients.value];
    newIngs.splice(idx, 1);
    loadedIngredients.value = newIngs;
    const newChecked = [...ingredientChecked.value];
    newChecked.splice(idx, 1);
    ingredientChecked.value = newChecked;
    if (editing === idx) ingredientEditing.value = -1;
    else if (editing > idx) ingredientEditing.value = editing - 1;
  };

  const addIngredientRow = () => {
    const newIng = { isTitle: false, title: '', qty: null, unitId: '', unitName: '', foodId: '', name: '', labelName: '', ingNote: '' };
    loadedIngredients.value = [...loadedIngredients.value, newIng];
    ingredientChecked.value = [...ingredientChecked.value, true];
    ingredientEditing.value = loadedIngredients.value.length - 1;
    setTimeout(() => {
      const el = document.querySelector('.ing-edit-name');
      if (el) el.focus();
    }, 50);
  };

  const addCheckedIngredientsToList = () => {
    setVisible(false);
    saveIngredientsToRecipe();
    // Snapshot checked items before signals change
    const items = ings.filter((ing, i) => checked[i] && !ing.isTitle && ing.name);
    if (items.length === 0) return;
    showListPicker((listId, listName) => {
      toast(`Added ${items.length} ingredient${items.length !== 1 ? 's' : ''} to ${listName}`);

      // Optimistic UI: inject items into active list immediately
      if (listId === activeListId.value) {
        const optimistic = items.map((ing, i) => {
          let qty = 1;
          if (ing.qty != null && ing.qty > 0 && ing.unitId) {
            const unitName = (ing.unitName || '').toLowerCase();
            if (SHOPPING_UNITS.has(unitName)) {
              qty = Math.ceil(ing.qty);
            }
          }

          return {
            id: `_pending_${Date.now()}_${i}`,
            checked: false,
            quantity: qty,
            food: ing.foodId ? { id: ing.foodId, name: ing.name, label: ing.labelName ? { name: ing.labelName } : null } : null,
            note: ing.foodId ? (ing.ingNote || '') : ing.name,
          };
        });
        activeListItems.value = [...activeListItems.value, ...optimistic];
      }

      // Fire API calls in background — don't await
      listAddPending.value = true;
      (async () => {
        try {
          // Resolve missing foodIds in parallel (deduplicated by name)
          const foodMap = {};
          const needFood = items.filter(i => !i.foodId);
          if (needFood.length) {
            const uniqueNames = [...new Set(needFood.map(i => i.name.toLowerCase()))];
            const resolved = await Promise.allSettled(
              uniqueNames.map(async (name) => {
                const food = await findOrCreateFood(name);
                return { name, id: food?.id || null };
              })
            );
            for (const r of resolved) {
              if (r.status === 'fulfilled' && r.value.id) foodMap[r.value.name] = r.value.id;
            }
          }

          // Post all items in parallel
          const results = await Promise.allSettled(items.map(async (ing) => {
            const body = { shoppingListId: listId, checked: false };
            const foodId = ing.foodId || foodMap[ing.name.toLowerCase()] || null;
            if (foodId) body.foodId = foodId;
            else body.note = ing.name;
            if (ing.qty != null && ing.qty > 0 && ing.unitId) {
              const unitName = (ing.unitName || '').toLowerCase();
              if (SHOPPING_UNITS.has(unitName)) {
                body.quantity = Math.ceil(ing.qty);
                body.unitId = ing.unitId;
              }
            }
            if (ing.ingNote) body.note = ing.ingNote;
            return api('/households/shopping/items', { method: 'POST', body });
          }));
          const failed = results.filter(r => r.status === 'rejected').length;
          if (failed > 0) toast(`${failed} item${failed !== 1 ? 's' : ''} failed to add`);
        } finally {
          listAddPending.value = false;
          if (listId === activeListId.value) refreshList();
        }
      })();
    });
  };

  const checkedCount = checked.filter(Boolean).length;

  const renderIngItem = (ing, i) => {
    if (ing.isTitle) {
      return html`<div key=${i} class="ingredient-item ingredient-section-header">${ing.title}</div>`;
    }
    const isChecked = checked[i];
    if (editing === i) {
      const qtyVal = ing.qty != null ? ing.qty : '';
      const rawName = ing.name || '';
      return html`
        <div key=${i} class="ingredient-item ingredient-editing">
          <input type="checkbox" class="ingredient-cb" checked=${isChecked}
                 data-on-change="ing-toggle" data-idx=${i}
                 onchange=${() => toggleIngredient(i)} />
          <div class="ingredient-edit-fields">
            <div class="ingredient-edit-row">
              <input type="number" class="ing-edit-input ing-edit-qty" value=${qtyVal} placeholder="Qty" step="any"
                     data-on-change="ing-qty" data-idx=${i}
                     onchange=${(e) => setQty(i, e.target.value)} />
              <select class="ing-edit-input ing-edit-unit" data-on-change="ing-unit" data-idx=${i}
                      onchange=${(e) => setUnit(i, e.target.value)}>
                <option value="">no unit</option>
                ${units.map(u => html`<option key=${u.id} value=${u.id} selected=${u.id === ing.unitId}>${u.name}</option>`)}
              </select>
            </div>
            <div class="ing-edit-name-wrap" ref=${ac.containerRef}>
              <input type="text" class="ing-edit-input ing-edit-name" value=${ing.name} placeholder="Item name"
                     data-on-input="ing-edit-name" data-on-change="ing-name" data-idx=${i} autocomplete="off"
                     oninput=${(e) => onIngEditName(i, e.target.value)}
                     onkeydown=${ac.handleKeydown} />
              <div class=${`ing-edit-ac ${ac.visible && ingEditIdx === i ? 'visible' : ''}`} id=${`ing-edit-ac-${i}`}>
                ${ac.items.map((f, fi) => html`
                  <div key=${f.id} class=${`ac-item ${fi === ac.kbIndex ? 'kb-active' : ''}`}
                       data-action="select-ing-food" data-idx=${i} data-food-id=${f.id}
                       data-food-name=${f.name} data-label-name=${f.label?.name || ''}
                       onclick=${() => selectIngEditFood(i, f.id, f.name, f.label?.name || '')}>
                    ${f.name}
                    ${f.label?.name ? html`<span class="ac-label">${f.label.name}</span>` : null}
                  </div>
                `)}
                ${ac.visible && ingEditIdx === i ? html`
                  <div class=${`ac-item ac-new ${ac.kbIndex === ac.items.length ? 'kb-active' : ''}`}
                       data-action="create-ing-food" data-idx=${i} data-name=${rawName}
                       onclick=${() => createIngEditFood(i, rawName)}>
                    + Add "${rawName}" as new food
                  </div>
                ` : null}
              </div>
            </div>
            <input type="text" class="ing-edit-input ing-edit-note" value=${ing.ingNote || ''} placeholder="Note (e.g. diced, boneless)"
                   data-on-change="ing-note" data-idx=${i}
                   onchange=${(e) => setNote(i, e.target.value)} />
            ${renderBadge(ing)}
            <div class="ingredient-edit-actions">
              <button class="btn btn-outline btn-sm ing-edit-delete" data-action="remove-ingredient" data-idx=${i}
                      onclick=${() => removeIngredient(i)}>
                <${Icon} name="trash-2" size=${13} /> Remove
              </button>
              <button class="btn btn-outline btn-sm ing-edit-done" data-action="close-ingredient-edit"
                      onclick=${closeEdit}>Done</button>
            </div>
          </div>
        </div>
      `;
    }
    const display = ingredientDisplayText(ing);
    return html`
      <div key=${i} class="ingredient-item">
        <input type="checkbox" class="ingredient-cb" checked=${isChecked}
               data-on-change="ing-toggle" data-idx=${i}
               onchange=${() => toggleIngredient(i)} />
        <div class="ingredient-display-wrap">
          <span class="ingredient-display">${display}</span>
          ${renderBadge(ing)}
        </div>
        <button class="ingredient-edit-btn" data-action="open-ingredient-edit" data-idx=${i} title="Edit"
                onclick=${() => openEdit(i)}>
          <${Icon} name="pencil" size=${14} />
        </button>
      </div>
    `;
  };

  const renderBadge = (ing) => {
    const badge = ingLinkBadge(ing);
    return html`<span class=${`ing-badge ${badge.linked ? 'ing-badge-linked' : 'ing-badge-unlinked'}`}>${badge.text}</span>`;
  };

  return html`
    <${Modal} id="ingredient-modal" visible=${visible} onClose=${close}>
      <div class="modal-panel label-modal ingredient-modal">
        <div class="modal-header modal-header-bordered">
          <span id="ingredient-modal-title">${title}</span>
          <button onclick=${close}><${Icon} name="x" size=${18} /></button>
        </div>
        <div class="ingredient-list" id="ingredient-list">
          ${loading
            ? html`<div class="ingredient-loading"><span class="spinner"></span> Loading ingredients...</div>`
            : failed
            ? html`<div class="ingredient-empty">Failed to load ingredients</div>`
            : html`
              ${ings.map((ing, i) => renderIngItem(ing, i))}
              <div class="ingredient-add-row" data-action="add-ingredient-row" onclick=${addIngredientRow}>
                <${Icon} name="plus" size=${16} /> Add item
              </div>
            `}
        </div>
        <div class="ingredient-modal-footer" id="ingredient-modal-footer" style=${recipeId ? '' : 'display:none'}>
          <button class="btn btn-primary" id="ingredient-add-btn"
                  style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px"
                  disabled=${checkedCount === 0} onclick=${addCheckedIngredientsToList}>
            <${Icon} name="shopping-cart" class="icon" /> Add ${checkedCount} item${checkedCount !== 1 ? 's' : ''} to Shopping List
          </button>
        </div>
      </div>
    <//>
  `;
}
