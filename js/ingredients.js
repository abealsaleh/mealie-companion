import { state, SHOPPING_UNITS } from './state.js';
import { api, searchAndSortFoods, findOrCreateFood } from './api.js';
import { toast, esc, initIcons, generateUUID, focusDelayed, showListPicker, makeKeyboardNav } from './ui.js';
import { refreshList } from './shopping.js';

let ingEditAcTimeout = null;

export async function loadUnits() {
  if (state.allUnits.length) return;
  try {
    const data = await api('/units');
    state.allUnits = (data.items || data).sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) { /* non-critical */ }
}

export async function openIngredientModal(slug, name, recipeId) {
  const modal = document.getElementById('ingredient-modal');
  const title = document.getElementById('ingredient-modal-title');
  const list = document.getElementById('ingredient-list');
  const footer = document.getElementById('ingredient-modal-footer');

  state.loadedIngredients = [];
  state.ingredientChecked = [];
  state.ingredientEditing = -1;
  state.ingredientSlug = slug;

  title.textContent = name;
  list.innerHTML = '<div class="ingredient-loading"><span class="spinner"></span> Loading ingredients...</div>';
  footer.style.display = recipeId ? '' : 'none';
  modal.classList.add('visible');
  initIcons();

  const [recipe] = await Promise.all([
    api(`/recipes/${slug}`).catch(() => null),
    loadUnits(),
  ]);

  if (!recipe) {
    list.innerHTML = '<div class="ingredient-empty">Failed to load ingredients</div>';
    return;
  }

  const ingredients = recipe.recipeIngredient || [];

  state.loadedIngredients = ingredients.map(ing => ({
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
  state.ingredientChecked = state.loadedIngredients.map(ing => !ing.isTitle);
  renderIngredientList();
  updateIngredientAddBtn();
}

function ingredientDisplayText(ing) {
  let parts = [];
  if (ing.qty != null) {
    let q = ing.qty % 1 === 0 ? String(Math.round(ing.qty)) : String(ing.qty);
    if (ing.unitName) q += ' ' + ing.unitName;
    parts.push(q);
  }
  if (ing.name) parts.push(ing.name);
  let text = parts.join(' ') || '(unnamed)';
  if (ing.ingNote) text += ` (${ing.ingNote})`;
  return text;
}

function ingLinkBadge(ing) {
  if (ing.foodId && ing.labelName) {
    return `<span class="ing-badge ing-badge-linked">${esc(ing.labelName)}</span>`;
  }
  if (ing.foodId) {
    return `<span class="ing-badge ing-badge-linked">Linked</span>`;
  }
  return `<span class="ing-badge ing-badge-unlinked">Not linked</span>`;
}

export function renderIngredientList() {
  const list = document.getElementById('ingredient-list');
  list.innerHTML = state.loadedIngredients.map((ing, i) => {
    if (ing.isTitle) {
      return `<div class="ingredient-item ingredient-section-header">${esc(ing.title)}</div>`;
    }
    const checked = state.ingredientChecked[i] ? 'checked' : '';

    if (state.ingredientEditing === i) {
      const qtyVal = ing.qty != null ? ing.qty : '';
      const unitOptions = state.allUnits.map(u =>
        `<option value="${u.id}" ${u.id === ing.unitId ? 'selected' : ''}>${esc(u.name)}</option>`
      ).join('');
      return `<div class="ingredient-item ingredient-editing">
        <input type="checkbox" class="ingredient-cb" ${checked} data-on-change="ing-toggle" data-idx="${i}">
        <div class="ingredient-edit-fields">
          <div class="ingredient-edit-row">
            <input type="number" class="ing-edit-input ing-edit-qty" value="${esc(String(qtyVal))}" placeholder="Qty" step="any"
                   data-on-change="ing-qty" data-idx="${i}">
            <select class="ing-edit-input ing-edit-unit" data-on-change="ing-unit" data-idx="${i}">
              <option value="">no unit</option>
              ${unitOptions}
            </select>
          </div>
          <div class="ing-edit-name-wrap">
            <input type="text" class="ing-edit-input ing-edit-name" value="${esc(ing.name)}" placeholder="Item name"
                   data-on-input="ing-edit-name" data-on-change="ing-name" data-idx="${i}" autocomplete="off">
            <div class="ing-edit-ac" id="ing-edit-ac-${i}"></div>
          </div>
          <input type="text" class="ing-edit-input ing-edit-note" value="${esc(ing.ingNote || '')}" placeholder="Note (e.g. diced, boneless)"
                 data-on-change="ing-note" data-idx="${i}">
          ${ingLinkBadge(ing)}
          <div class="ingredient-edit-actions">
            <button class="btn btn-outline btn-sm ing-edit-delete" data-action="remove-ingredient" data-idx="${i}"><i data-lucide="trash-2" style="width:13px;height:13px"></i> Remove</button>
            <button class="btn btn-outline btn-sm ing-edit-done" data-action="close-ingredient-edit">Done</button>
          </div>
        </div>
      </div>`;
    }

    const display = ingredientDisplayText(ing);
    const badge = ingLinkBadge(ing);
    return `<div class="ingredient-item">
      <input type="checkbox" class="ingredient-cb" ${checked} data-on-change="ing-toggle" data-idx="${i}">
      <div class="ingredient-display-wrap">
        <span class="ingredient-display">${esc(display)}</span>
        ${badge}
      </div>
      <button class="ingredient-edit-btn" data-action="open-ingredient-edit" data-idx="${i}" title="Edit"><i data-lucide="pencil" style="width:14px;height:14px"></i></button>
    </div>`;
  }).join('');

  list.innerHTML += `<div class="ingredient-add-row" data-action="add-ingredient-row">
    <i data-lucide="plus" style="width:16px;height:16px"></i> Add item
  </div>`;
  initIcons();

  // Attach keyboard nav to ingredient edit name input if editing
  if (state.ingredientEditing >= 0) {
    const nameInput = list.querySelector('.ing-edit-name');
    if (nameInput) {
      const idx = state.ingredientEditing;
      nameInput.addEventListener('keydown', makeKeyboardNav({
        getDropdown: () => document.getElementById(`ing-edit-ac-${idx}`) || document.createElement('div'),
        isVisible: d => d.classList.contains('visible'),
        getIndex: () => state.ingEditKbIndex,
        setIndex: n => { state.ingEditKbIndex = n; },
        hideDropdown: () => { const d = document.getElementById(`ing-edit-ac-${idx}`); if (d) d.classList.remove('visible'); },
      }));
    }
  }
}

export function addIngredientRow() {
  const newIng = { isTitle: false, title: '', qty: null, unitId: '', unitName: '', foodId: '', name: '', labelName: '', ingNote: '' };
  state.loadedIngredients.push(newIng);
  state.ingredientChecked.push(true);
  state.ingredientEditing = state.loadedIngredients.length - 1;
  renderIngredientList();
  updateIngredientAddBtn();
  focusDelayed('.ing-edit-name');
}

export function removeIngredient(idx) {
  state.loadedIngredients.splice(idx, 1);
  state.ingredientChecked.splice(idx, 1);
  if (state.ingredientEditing === idx) state.ingredientEditing = -1;
  else if (state.ingredientEditing > idx) state.ingredientEditing--;
  renderIngredientList();
  updateIngredientAddBtn();
}

export function openIngredientEdit(idx) {
  state.ingredientEditing = idx;
  renderIngredientList();
  focusDelayed('.ing-edit-name');
}

export function closeIngredientEdit() {
  state.ingredientEditing = -1;
  renderIngredientList();
}

// Setters for inline onchange handlers (avoids needing state on window)
export function setIngredientQty(idx, value) {
  state.loadedIngredients[idx].qty = value ? parseFloat(value) : null;
}

export function setIngredientName(idx, value) {
  state.loadedIngredients[idx].name = value.trim();
}

export function setIngredientNote(idx, value) {
  state.loadedIngredients[idx].ingNote = value.trim();
}

export function onIngEditName(idx, value) {
  const val = value.trim();
  const dropdown = document.getElementById(`ing-edit-ac-${idx}`);
  state.loadedIngredients[idx].foodId = '';
  state.loadedIngredients[idx].labelName = '';
  state.loadedIngredients[idx].name = val;

  if (val.length < 2) {
    dropdown.classList.remove('visible');
    return;
  }
  clearTimeout(ingEditAcTimeout);
  ingEditAcTimeout = setTimeout(() => searchIngEditFoods(idx, val), 200);
}

// DRY #7: uses shared searchAndSortFoods
async function searchIngEditFoods(idx, query) {
  const dropdown = document.getElementById(`ing-edit-ac-${idx}`);
  if (!dropdown) return;
  state.ingEditKbIndex = -1;
  try {
    const foods = await searchAndSortFoods(query);
    const rawVal = state.loadedIngredients[idx]?.name || query;
    let html = foods.map(f => {
      const labelName = f.label?.name || '';
      return `<div class="ac-item" data-action="select-ing-food" data-idx="${idx}" data-food-id="${f.id}" data-food-name="${esc(f.name)}" data-label-name="${esc(labelName)}">
        ${esc(f.name)}
        ${labelName ? `<span class="ac-label">${esc(labelName)}</span>` : ''}
      </div>`;
    }).join('');
    html += `<div class="ac-item ac-new" data-action="create-ing-food" data-idx="${idx}" data-name="${esc(rawVal)}">+ Add "${esc(rawVal)}" as new food</div>`;
    dropdown.innerHTML = html;
    dropdown.classList.add('visible');
  } catch (e) {
    dropdown.classList.remove('visible');
  }
}

export function selectIngEditFood(idx, foodId, foodName, labelName) {
  state.loadedIngredients[idx].foodId = foodId;
  state.loadedIngredients[idx].name = foodName;
  state.loadedIngredients[idx].labelName = labelName || '';
  dismissIngEditAc(idx);
  renderIngredientList();
}

function dismissIngEditAc(idx) {
  const dropdown = document.getElementById(`ing-edit-ac-${idx}`);
  if (dropdown) dropdown.classList.remove('visible');
}

// DRY #8: uses shared findOrCreateFood
export async function createIngEditFood(idx, name) {
  dismissIngEditAc(idx);
  try {
    const food = await findOrCreateFood(name);
    if (food) {
      state.loadedIngredients[idx].foodId = food.id;
      state.loadedIngredients[idx].name = food.name;
      state.loadedIngredients[idx].labelName = food.label?.name || '';
      renderIngredientList();
      toast(`Linked to "${food.name}"`);
    } else {
      toast('Failed to create food');
    }
  } catch (e) {
    toast('Failed to create food');
  }
}

export function setIngredientUnit(idx, unitId) {
  state.loadedIngredients[idx].unitId = unitId;
  const u = state.allUnits.find(u => u.id === unitId);
  state.loadedIngredients[idx].unitName = u ? u.name : '';
}

export function toggleIngredient(idx) {
  state.ingredientChecked[idx] = !state.ingredientChecked[idx];
  updateIngredientAddBtn();
}

function updateIngredientAddBtn() {
  const btn = document.getElementById('ingredient-add-btn');
  const count = state.ingredientChecked.filter(Boolean).length;
  btn.innerHTML = `<i data-lucide="shopping-cart" class="icon"></i> Add ${count} item${count !== 1 ? 's' : ''} to Shopping List`;
  btn.disabled = count === 0;
  btn.onclick = () => addCheckedIngredientsToList();
  initIcons();
}

// DRY #9/#10/#11: uses shared showListPicker with closure callback
function addCheckedIngredientsToList() {
  document.getElementById('ingredient-modal').classList.remove('visible');
  saveIngredientsToRecipe();
  showListPicker((listId, listName) => {
    doAddCheckedIngredients(listId, listName);
  });
}

async function doAddCheckedIngredients(listId, listName) {
  const items = state.loadedIngredients
    .filter((ing, i) => state.ingredientChecked[i] && !ing.isTitle);
  if (items.length === 0) return;

  toast(`Adding ${items.length} ingredient${items.length !== 1 ? 's' : ''}...`);

  let added = 0;
  for (const ing of items) {
    try {
      const body = { shoppingListId: listId, checked: false };
      if (!ing.name) continue;

      let foodId = ing.foodId;
      if (!foodId) {
        const food = await findOrCreateFood(ing.name);
        foodId = food?.id || null;
      }
      if (foodId) {
        body.foodId = foodId;
      } else {
        body.note = ing.name;
      }

      if (ing.qty != null && ing.qty > 0 && ing.unitId) {
        const unitName = (ing.unitName || '').toLowerCase();
        if (SHOPPING_UNITS.has(unitName)) {
          body.quantity = ing.qty;
          body.unitId = ing.unitId;
        }
      }

      if (ing.ingNote) body.note = ing.ingNote;

      await api('/households/shopping/items', { method: 'POST', body });
      added++;
    } catch (e) { /* skip failed items */ }
  }

  toast(`Added ${added} ingredient${added !== 1 ? 's' : ''} to ${listName}`);
  if (listId === state.activeListId) refreshList();
}

export function closeIngredientModal() {
  document.getElementById('ingredient-modal').classList.remove('visible');
  saveIngredientsToRecipe();
}

async function saveIngredientsToRecipe() {
  if (!state.ingredientSlug || state.loadedIngredients.length === 0) return;

  const recipeIngredient = state.loadedIngredients.map(ing => {
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
    await api(`/recipes/${state.ingredientSlug}`, {
      method: 'PATCH',
      body: { recipeIngredient },
    });
  } catch (e) {
    // Silent fail
  }
}
