import { html, useState, useEffect, useRef, useCallback } from '../lib.js';
import { PLAN_DAYS, MEAL_ORDER, MEAL_ICONS, DAY_NAMES, MONTH_SHORT } from '../constants.js';
import { formatDateParam, getPlanRange, getRangeLabel, isUrl, esc } from '../utils.js';
import { api } from '../api.js';
import { activeListId } from '../signals.js';
import { toast } from './Toast.js';
import { Icon } from './Icon.js';
import { showListPicker } from './ListPicker.js';
import { refreshList } from './ShoppingList.js';
import { useAutocomplete } from './Autocomplete.js';
import { Modal } from './Modal.js';
import { useRefresh, useTogglePanel } from '../hooks.js';

export function MealPlan({ onOpenIngredients }) {
  const [entries, setEntries] = useState(null);
  const [rangeStart, setRangeStart] = useState(null);
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Working...');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);
  const dateRef = useRef(null);
  const mealRef = useRef(null);

  const loadMealPlan = useCallback(async () => {
    setEntries(null);
    const { start, end } = getPlanRange();
    setRangeStart(start);
    try {
      const data = await api(`/households/mealplans?start_date=${formatDateParam(start)}&end_date=${formatDateParam(end)}&perPage=50&page=1`);
      setEntries(data.items || []);
    } catch {
      setEntries([]);
    }
  }, []);

  const { refreshing, handleRefresh } = useRefresh(loadMealPlan);
  const { panelOpen: addPanelOpen, setPanelOpen: setAddPanelOpen, togglePanel } = useTogglePanel(inputRef);

  useEffect(() => { loadMealPlan(); }, [loadMealPlan]);

  const populateDateOptions = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const opts = [];
    for (let i = 0; i < PLAN_DAYS; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const val = formatDateParam(d);
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAY_NAMES[d.getDay()];
      opts.push({ val, label: `${label} \u2013 ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}` });
    }
    return opts;
  };

  const deleteMealEntry = async (entryId) => {
    try {
      await api(`/households/mealplans/${entryId}`, { method: 'DELETE' });
      toast('Removed from meal plan');
      loadMealPlan();
    } catch {
      toast('Failed to remove entry');
    }
  };

  const addRecipeToShoppingList = (recipeId, recipeName) => {
    showListPicker(async (listId, listName) => {
      if (!recipeId) return;
      toast('Adding ingredients...');
      try {
        await api(`/households/shopping/lists/${listId}/recipe/${recipeId}`, { method: 'POST' });
        toast(`Added "${recipeName}" ingredients to ${listName}`);
        if (listId === activeListId.value) refreshList();
      } catch {
        toast('Failed to add ingredients');
      }
    });
  };

  const selectRecipe = (slug, name) => {
    if (inputRef.current) inputRef.current.value = name;
    setSelectedSlug(slug);
    ac.close();
  };

  const ac = useAutocomplete({
    onSearch: async (q) => {
      const data = await api(`/recipes?search=${encodeURIComponent(q)}&perPage=5&page=1`);
      return data.items || [];
    },
    onSelect: (r) => selectRecipe(r.slug, r.name),
    onFallbackEnter: () => submitMealPlan(),
    debounceMs: 300,
  });

  const onMpInput = () => {
    const val = inputRef.current?.value.trim() || '';
    if (isUrl(val)) { ac.close(); return; }
    ac.search(val);
  };

  const submitMealPlan = async () => {
    const val = inputRef.current?.value.trim();
    if (!val) return;
    const date = dateRef.current?.value;
    const entryType = mealRef.current?.value;
    setSubmitting(true);
    setErrorMsg('');
    try {
      let slug;
      let newlyCreated = false;
      if (isUrl(val)) {
        setLoadingMsg('Importing from URL...');
        const result = await api('/recipes/create/url', { method: 'POST', body: { url: val, includeTags: false } });
        slug = typeof result === 'string' ? result : result.slug || result;
      } else if (selectedSlug) {
        slug = selectedSlug;
        setSelectedSlug(null);
      } else {
        setLoadingMsg('Creating recipe...');
        const result = await api('/recipes', { method: 'POST', body: { name: val } });
        slug = typeof result === 'string' ? result : result.slug || result;
        newlyCreated = true;
      }
      if (typeof slug === 'string') slug = slug.replace(/^"|"$/g, '');
      const recipe = await api(`/recipes/${slug}`);
      if (newlyCreated && recipe.recipeIngredient?.length) {
        await api(`/recipes/${slug}`, { method: 'PATCH', body: { recipeIngredient: [] } });
      }
      setLoadingMsg('Adding to meal plan...');
      await api('/households/mealplans', { method: 'POST', body: { date, entryType, recipeId: recipe.id } });
      if (inputRef.current) inputRef.current.value = '';
      ac.close();
      toast(`Added "${recipe.name}" to ${entryType}`);
      loadMealPlan();
    } catch (err) {
      setErrorMsg(err.message);
      setTimeout(() => setErrorMsg(''), 4000);
    } finally {
      setSubmitting(false);
    }
  };

  const dateOptions = populateDateOptions();
  const todayStr = formatDateParam(new Date());

  // Group entries by date
  const renderPlan = () => {
    if (entries === null) {
      return html`<div class="loading-bar visible"><span class="spinner"></span> Loading meal plan...</div>`;
    }
    const byDate = {};
    entries.forEach(e => { if (!byDate[e.date]) byDate[e.date] = []; byDate[e.date].push(e); });
    const start = rangeStart || new Date();
    const days = [];
    for (let i = 0; i < PLAN_DAYS; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = formatDateParam(d);
      const isToday = dateStr === todayStr;
      const dayEntries = byDate[dateStr] || [];
      const dayLabel = isToday ? 'Today' : (i === 1 ? 'Tomorrow' : DAY_NAMES[d.getDay()]);
      days.push({ dateStr, isToday, dayEntries, dayLabel, d });
    }
    return days.map(({ dateStr, isToday, dayEntries, dayLabel, d }) => html`
      <div class="mp-day" key=${dateStr}>
        <div class=${`mp-day-header ${isToday ? 'today' : ''}`}>
          <span class="day-name">${dayLabel}</span>
          <span class="day-date">${MONTH_SHORT[d.getMonth()]} ${d.getDate()}</span>
        </div>
        ${dayEntries.length === 0
          ? html`<div class="mp-day-empty">No meals planned</div>`
          : renderDayEntries(dayEntries)}
      </div>
    `);
  };

  const renderDayEntries = (dayEntries) => {
    const byMeal = {};
    dayEntries.forEach(e => {
      const type = e.entryType || 'dinner';
      if (!byMeal[type]) byMeal[type] = [];
      byMeal[type].push(e);
    });
    const sortedMeals = Object.keys(byMeal).sort((a, b) => MEAL_ORDER.indexOf(a) - MEAL_ORDER.indexOf(b));
    return html`<div class="mp-meal-group">
      ${sortedMeals.map(mealType => html`
        <div class="mp-meal-type" key=${mealType}>${mealType}</div>
        ${byMeal[mealType].map(entry => {
          const name = entry.recipe?.name || entry.title || '(untitled)';
          const icon = MEAL_ICONS[mealType] || 'utensils';
          const recipeId = entry.recipe?.id || entry.recipeId || '';
          const recipeSlug = entry.recipe?.slug || '';
          return html`
            <div class="mp-entry" key=${entry.id}>
              <span class="mp-entry-icon"><${Icon} name=${icon} size=${16} /></span>
              <span class=${`mp-entry-name ${recipeSlug ? 'clickable' : ''}`}
                    data-action="open-ingredients" data-slug=${recipeSlug} data-name=${name} data-recipe-id=${recipeId}
                    onclick=${recipeSlug ? () => onOpenIngredients(recipeSlug, name, recipeId) : undefined}>
                ${name}
              </span>
              ${recipeId ? html`
                <button class="mp-entry-action" data-action="add-to-list" data-recipe-id=${recipeId} data-name=${name}
                        title="Add to shopping list" onclick=${() => addRecipeToShoppingList(recipeId, name)}>
                  <${Icon} name="shopping-cart" size=${14} />
                </button>` : null}
              <button class="mp-entry-action mp-entry-delete" data-action="delete-entry" data-entry-id=${entry.id}
                      title="Remove" onclick=${() => deleteMealEntry(entry.id)}>
                <${Icon} name="x" size=${14} />
              </button>
            </div>
          `;
        })}
      `)}
    </div>`;
  };

  return html`
    <div id="mealplan-tab" class=${`tab active`}>
      <div class="mp-range-header">
        <span id="mp-range-label" style="flex:1;text-align:center">${getRangeLabel()}</span>
        <button class="btn btn-outline btn-sm" onclick=${handleRefresh} disabled=${refreshing}
                style="display:flex;align-items:center;padding:6px">
          <span class=${refreshing ? 'icon-spin' : ''}><${Icon} name="refresh-cw" size=${14} /></span>
        </button>
      </div>
      <div class="mp-plan-scroll">
        <div id="mp-plan-content">${renderPlan()}</div>
      </div>
      <button class=${`fab ${addPanelOpen ? 'fab-active' : ''}`} onclick=${togglePanel} id="mp-fab">
        <${Icon} name="plus" size=${24} />
      </button>
      <${Modal} id="mp-add-modal" visible=${addPanelOpen} onClose=${() => setAddPanelOpen(false)} class="add-modal-overlay">
        <div class="modal-panel add-modal">
          <div class="modal-header modal-header-bordered">
            <span>Add to Meal Plan</span>
            <button onclick=${() => setAddPanelOpen(false)}><${Icon} name="x" size=${18} /></button>
          </div>
          <div ref=${ac.containerRef}>
            <div class="form-group">
              <label><${Icon} name="search" size=${14} style="vertical-align:-2px" /> Recipe name or URL</label>
              <input type="text" id="mp-input" ref=${inputRef} placeholder="Paste URL or type recipe name..."
                     autocomplete="off" oninput=${onMpInput} onkeydown=${ac.handleKeydown} />
            </div>
            <div class="input-hint">Paste a URL to import, or type to search existing recipes</div>
            <div id="mp-search-results" class="search-results" style=${ac.visible ? 'display:block' : 'display:none'}>
              ${ac.items.map((r, i) => html`
                <div class=${`item ${i === ac.kbIndex ? 'kb-active' : ''}`} key=${r.slug}
                     data-action="select-recipe" data-slug=${r.slug} data-name=${r.name}
                     onclick=${() => selectRecipe(r.slug, r.name)}>
                  ${r.name}
                  <div class="slug">${r.slug}</div>
                </div>
              `)}
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Date</label>
              <select id="mp-date" ref=${dateRef}>
                ${dateOptions.map(o => html`<option value=${o.val} key=${o.val}>${o.label}</option>`)}
              </select>
            </div>
            <div class="form-group">
              <label>Meal</label>
              <select id="mp-meal" ref=${mealRef}>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner" selected>Dinner</option>
                <option value="side">Side</option>
                <option value="snack">Snack</option>
                <option value="dessert">Dessert</option>
                <option value="drink">Drink</option>
              </select>
            </div>
          </div>
          <div style="padding: 0 16px 16px">
            <button class="btn btn-primary" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px"
                    id="mp-submit" onclick=${submitMealPlan} disabled=${submitting}>
              <${Icon} name="plus" class="icon" /> Add to Meal Plan
            </button>
          </div>
          <div id="mp-loading" class=${`loading-bar ${submitting ? 'visible' : ''}`}>
            <span class="spinner"></span> ${loadingMsg}
          </div>
          <div id="mp-results">
            ${errorMsg ? html`
              <div class="result-card error">
                <h3><${Icon} name="circle-x" size=${16} style="vertical-align:-3px;color:var(--accent)" /> Error</h3>
                <p>${errorMsg}</p>
              </div>
            ` : null}
          </div>
        </div>
      <//>
    </div>
  `;
}
