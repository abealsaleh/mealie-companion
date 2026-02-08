import { state, PLAN_DAYS, MEAL_ORDER, MEAL_ICONS, DAY_NAMES, MONTH_SHORT } from './state.js';
import { api } from './api.js';
import { toast, esc, isUrl, initIcons, showListPicker } from './ui.js';
import { refreshList } from './shopping.js';

let searchTimeout = null;
let selectedSlug = null;

function formatDateParam(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getPlanRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + PLAN_DAYS - 1);
  return { start, end };
}

function getRangeLabel() {
  const { start, end } = getPlanRange();
  return `${MONTH_SHORT[start.getMonth()]} ${start.getDate()} \u2013 ${MONTH_SHORT[end.getMonth()]} ${end.getDate()}`;
}

export function populateDatePicker() {
  const sel = document.getElementById('mp-date');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  sel.innerHTML = '';
  for (let i = 0; i < PLAN_DAYS; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const val = formatDateParam(d);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAY_NAMES[d.getDay()];
    sel.innerHTML += `<option value="${val}">${label} \u2013 ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}</option>`;
  }
}

export async function loadMealPlan() {
  const { start, end } = getPlanRange();
  const content = document.getElementById('mp-plan-content');
  content.innerHTML = '<div class="loading-bar visible"><span class="spinner"></span> Loading...</div>';
  document.getElementById('mp-range-label').textContent = getRangeLabel();

  try {
    const data = await api(`/households/mealplans?start_date=${formatDateParam(start)}&end_date=${formatDateParam(end)}&perPage=50&page=1`);
    const entries = data.items || [];
    renderMealPlan(start, entries);
  } catch (err) {
    content.innerHTML = '<div class="empty-state">Failed to load meal plan</div>';
  }
}

function renderMealPlan(rangeStart, entries) {
  const content = document.getElementById('mp-plan-content');
  // DRY #6: removed todayStr(), using formatDateParam directly
  const todayS = formatDateParam(new Date());

  const byDate = {};
  entries.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });

  let html = '';
  for (let i = 0; i < PLAN_DAYS; i++) {
    const d = new Date(rangeStart);
    d.setDate(rangeStart.getDate() + i);
    const dateStr = formatDateParam(d);
    const isToday = dateStr === todayS;
    const dayEntries = byDate[dateStr] || [];
    const dayLabel = isToday ? 'Today' : (i === 1 ? 'Tomorrow' : DAY_NAMES[d.getDay()]);

    html += `<div class="mp-day">`;
    html += `<div class="mp-day-header ${isToday ? 'today' : ''}">
      <span class="day-name">${dayLabel}</span>
      <span class="day-date">${MONTH_SHORT[d.getMonth()]} ${d.getDate()}</span>
    </div>`;

    if (dayEntries.length === 0) {
      html += `<div class="mp-day-empty">No meals planned</div>`;
    } else {
      const byMeal = {};
      dayEntries.forEach(e => {
        const type = e.entryType || 'dinner';
        if (!byMeal[type]) byMeal[type] = [];
        byMeal[type].push(e);
      });

      const sortedMeals = Object.keys(byMeal).sort((a, b) =>
        MEAL_ORDER.indexOf(a) - MEAL_ORDER.indexOf(b)
      );

      html += '<div class="mp-meal-group">';
      sortedMeals.forEach(mealType => {
        html += `<div class="mp-meal-type">${esc(mealType)}</div>`;
        byMeal[mealType].forEach(entry => {
          const name = entry.recipe?.name || entry.title || '(untitled)';
          const icon = MEAL_ICONS[mealType] || 'utensils';
          const recipeId = entry.recipe?.id || entry.recipeId || '';
          const recipeSlug = entry.recipe?.slug || '';
          html += `
            <div class="mp-entry">
              <span class="mp-entry-icon"><i data-lucide="${icon}" style="width:16px;height:16px"></i></span>
              <span class="mp-entry-name ${recipeSlug ? 'clickable' : ''}" ${recipeSlug ? `onclick="openIngredientModal('${esc(recipeSlug)}','${esc(name)}','${recipeId}')"` : ''}>${esc(name)}</span>
              ${recipeId ? `<button class="mp-entry-action" onclick="event.stopPropagation();addRecipeToShoppingList('${recipeId}','${esc(name)}')" title="Add to shopping list">
                <i data-lucide="shopping-cart" style="width:14px;height:14px"></i>
              </button>` : ''}
              <button class="mp-entry-action mp-entry-delete" onclick="event.stopPropagation();deleteMealEntry(${entry.id})" title="Remove">
                <i data-lucide="x" style="width:14px;height:14px"></i>
              </button>
            </div>
          `;
        });
      });
      html += '</div>';
    }
    html += '</div>';
  }

  content.innerHTML = html;
  initIcons();
}

export async function deleteMealEntry(entryId) {
  try {
    await api(`/households/mealplans/${entryId}`, { method: 'DELETE' });
    toast('Removed from meal plan');
    loadMealPlan();
  } catch (err) {
    toast('Failed to remove entry');
  }
}

// DRY #9/#10/#11: uses shared showListPicker with closure callback
export function addRecipeToShoppingList(recipeId, recipeName) {
  showListPicker((listId, listName) => {
    doAddRecipeToList(recipeId, recipeName, listId, listName);
  });
}

async function doAddRecipeToList(recipeId, recipeName, listId, listName) {
  if (!recipeId) return;
  toast('Adding ingredients...');
  try {
    await api(`/households/shopping/lists/${listId}/recipe/${recipeId}`, { method: 'POST' });
    toast(`Added "${recipeName}" ingredients to ${listName}`);
    if (listId === state.activeListId) refreshList();
  } catch (err) {
    toast('Failed to add ingredients');
  }
}

export function onMpInput() {
  const val = document.getElementById('mp-input').value.trim();
  const resultsEl = document.getElementById('mp-search-results');
  if (isUrl(val) || val.length < 2) {
    resultsEl.style.display = 'none';
    return;
  }
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => searchRecipes(val), 300);
}

async function searchRecipes(query) {
  const resultsEl = document.getElementById('mp-search-results');
  state.mpKbIndex = -1;
  try {
    const data = await api(`/recipes?search=${encodeURIComponent(query)}&perPage=5&page=1`);
    const items = data.items || [];
    if (items.length === 0) {
      resultsEl.style.display = 'none';
      return;
    }
    resultsEl.innerHTML = items.map(r => `
      <div class="item" onclick="selectRecipe('${esc(r.slug)}', '${esc(r.name)}')">
        ${esc(r.name)}
        <div class="slug">${esc(r.slug)}</div>
      </div>
    `).join('');
    resultsEl.style.display = 'block';
  } catch (e) {
    resultsEl.style.display = 'none';
  }
}

export function selectRecipe(slug, name) {
  document.getElementById('mp-input').value = name;
  selectedSlug = slug;
  document.getElementById('mp-search-results').style.display = 'none';
}

// DRY #13/#14: consolidated slug cleanup + recipe fetch after branches
export async function submitMealPlan() {
  const input = document.getElementById('mp-input');
  const val = input.value.trim();
  if (!val) return;

  const date = document.getElementById('mp-date').value;
  const entryType = document.getElementById('mp-meal').value;
  const btn = document.getElementById('mp-submit');
  const loading = document.getElementById('mp-loading');

  btn.disabled = true;
  loading.classList.add('visible');

  try {
    let slug;

    if (isUrl(val)) {
      loading.querySelector('span').nextSibling.textContent = ' Importing from URL...';
      const result = await api('/recipes/create/url', { method: 'POST', body: { url: val, includeTags: false } });
      slug = typeof result === 'string' ? result : result.slug || result;
    } else if (selectedSlug) {
      slug = selectedSlug;
      selectedSlug = null;
    } else {
      loading.querySelector('span').nextSibling.textContent = ' Creating recipe...';
      const result = await api('/recipes', { method: 'POST', body: { name: val } });
      slug = typeof result === 'string' ? result : result.slug || result;
    }

    // Shared slug cleanup + recipe fetch (DRY #13/#14)
    if (typeof slug === 'string') slug = slug.replace(/^"|"$/g, '');
    const recipe = await api(`/recipes/${slug}`);
    const recipeId = recipe.id;
    const recipeName = recipe.name;

    loading.querySelector('span').nextSibling.textContent = ' Adding to meal plan...';
    await api('/households/mealplans', {
      method: 'POST',
      body: { date, entryType, recipeId },
    });

    input.value = '';
    document.getElementById('mp-search-results').style.display = 'none';
    toast(`Added "${recipeName}" to ${entryType}`);
    loadMealPlan();
  } catch (err) {
    showMealPlanError(err.message);
  } finally {
    btn.disabled = false;
    loading.classList.remove('visible');
  }
}

function showMealPlanError(msg) {
  const el = document.getElementById('mp-results');
  el.innerHTML = `
    <div class="result-card error">
      <h3><i data-lucide="circle-x" style="width:16px;height:16px;vertical-align:-3px;color:var(--accent)"></i> Error</h3>
      <p>${esc(msg)}</p>
    </div>
  `;
  initIcons();
  setTimeout(() => { el.innerHTML = ''; }, 4000);
}
