// ─── Token storage (localStorage if "Remember me", sessionStorage otherwise) ───
function getTokenStorage() {
  return localStorage.getItem('mealie_remember') === 'true' ? localStorage : sessionStorage;
}
function saveToken(token) {
  accessToken = token;
  getTokenStorage().setItem('mealie_access_token', token);
}
function clearToken() {
  accessToken = '';
  localStorage.removeItem('mealie_access_token');
  sessionStorage.removeItem('mealie_access_token');
}

// ─── State ───
let accessToken = localStorage.getItem('mealie_access_token') || sessionStorage.getItem('mealie_access_token') || '';
let shoppingLists = [];
let activeListId = localStorage.getItem('mealie_active_list') || '';
let activeListItems = [];
let allLabels = [];
let labelMap = {};  // id → {name, ...}
let selectedFood = null; // {id, name, labelId} from autocomplete
let searchTimeout = null;
let acSearchTimeout = null;
let refreshTimer = null;
let acKbIndex = -1;  // keyboard-highlighted index in shopping autocomplete
let mpKbIndex = -1;  // keyboard-highlighted index in recipe search results
const PLAN_DAYS = 8; // show today + 7 more days

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  if (!accessToken) {
    showSetup();
  } else {
    init();
  }
  populateDatePicker();
  setupPullToRefresh();
  document.getElementById('add-item-input').addEventListener('keydown', (e) => {
    const dropdown = document.getElementById('autocomplete-dropdown');
    const items = dropdown.querySelectorAll('.ac-item');
    if (dropdown.classList.contains('visible') && items.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); acKbIndex = Math.min(acKbIndex + 1, items.length - 1); highlightAcItem(items); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); acKbIndex = Math.max(acKbIndex - 1, -1); highlightAcItem(items); return; }
      if (e.key === 'Enter' && acKbIndex >= 0) { e.preventDefault(); items[acKbIndex].click(); return; }
      if (e.key === 'Escape') { dropdown.classList.remove('visible'); acKbIndex = -1; return; }
    }
    if (e.key === 'Enter') addItemFromInput();
  });
  document.getElementById('mp-input').addEventListener('input', onMpInput);
  document.getElementById('mp-input').addEventListener('keydown', (e) => {
    const resultsEl = document.getElementById('mp-search-results');
    const items = resultsEl.querySelectorAll('.item');
    if (resultsEl.style.display === 'block' && items.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); mpKbIndex = Math.min(mpKbIndex + 1, items.length - 1); highlightMpItem(items); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); mpKbIndex = Math.max(mpKbIndex - 1, -1); highlightMpItem(items); return; }
      if (e.key === 'Enter' && mpKbIndex >= 0) { e.preventDefault(); items[mpKbIndex].click(); return; }
      if (e.key === 'Escape') { resultsEl.style.display = 'none'; mpKbIndex = -1; return; }
    }
    if (e.key === 'Enter') submitMealPlan();
  });
  // Close autocomplete on outside tap
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.add-bar')) {
      document.getElementById('autocomplete-dropdown').classList.remove('visible');
    }
  });
});

async function init() {
  hideSetup();
  restoreActiveTab();
  try {
    await Promise.all([loadLabels(), loadShoppingLists(), loadMealPlan()]);
    populateCategoryOverride();
  } catch (err) {
    console.error('Init error:', err);
    if (err.message && err.message.includes('401')) {
      // Token expired, try refresh
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        init();
        return;
      }
      logout();
      toast('Session expired - please sign in again');
    } else {
      toast('Connection error');
    }
  }
}

// ─── API helper ───
async function api(path, opts = {}) {
  const resp = await fetch('/api' + path, {
    ...opts,
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (resp.status === 401) {
    // Try token refresh once
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry the original request with new token
      const retry = await fetch('/api' + path, {
        ...opts,
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(opts.headers || {}),
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      if (!retry.ok) {
        const text = await retry.text();
        throw new Error(`API ${retry.status}: ${text}`);
      }
      const ct = retry.headers.get('content-type');
      return ct && ct.includes('application/json') ? retry.json() : retry.text();
    }
    logout();
    toast('Session expired - please sign in again');
    throw new Error('API 401: Unauthorized');
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API ${resp.status}: ${text}`);
  }
  const contentType = resp.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return resp.json();
  }
  return resp.text();
}

// ─── Auth ───
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const remember = document.getElementById('login-remember').checked;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  if (!email || !password) {
    errEl.textContent = 'Please enter email and password';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in...';
  errEl.style.display = 'none';

  try {
    const body = new URLSearchParams();
    body.append('username', email);
    body.append('password', password);
    body.append('remember_me', remember.toString());

    const resp = await fetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body,
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.detail || 'Invalid email or password');
    }

    const data = await resp.json();
    localStorage.setItem('mealie_remember', remember.toString());
    saveToken(data.access_token);
    scheduleTokenRefresh();
    document.getElementById('login-password').value = '';
    toast('Signed in');
    init();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

async function tryRefreshToken() {
  try {
    const resp = await fetch('/api/auth/refresh', {
      headers: { 'Authorization': 'Bearer ' + accessToken },
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    saveToken(data.access_token);
    scheduleTokenRefresh();
    return true;
  } catch {
    return false;
  }
}

function scheduleTokenRefresh() {
  clearTimeout(refreshTimer);
  // Refresh every 20 minutes (tokens typically expire in ~30 min)
  refreshTimer = setTimeout(async () => {
    const ok = await tryRefreshToken();
    if (!ok) {
      logout();
      toast('Session expired - please sign in again');
    }
  }, 20 * 60 * 1000);
}

function logout() {
  clearToken();
  clearTimeout(refreshTimer);
  showSetup();
}

function showSetup() {
  document.getElementById('setup').classList.add('active');
  document.getElementById('login-error').style.display = 'none';
}
function hideSetup() {
  document.getElementById('setup').classList.remove('active');
}

// ─── Tab switching ───
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById(name + '-tab').classList.add('active');
  document.querySelector(`nav button[onclick*="${name}"]`).classList.add('active');
  localStorage.setItem('mealie_active_tab', name);
  if (name === 'shopping' && activeListId) refreshList();
}

function restoreActiveTab() {
  const saved = localStorage.getItem('mealie_active_tab');
  if (saved && saved !== 'mealplan') switchTab(saved);
}

// ─── Helpers ───
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function populateDatePicker() {
  const sel = document.getElementById('mp-date');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  sel.innerHTML = '';
  for (let i = 0; i < PLAN_DAYS; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const val = formatDateParam(d);
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAY_NAMES[d.getDay()];
    sel.innerHTML += `<option value="${val}">${label} – ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}</option>`;
  }
}
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 2500);
}
function isUrl(s) {
  return /^https?:\/\//i.test(s.trim());
}
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ═══════════════════════════════════
// ─── MEAL PLAN TAB ───
// ═══════════════════════════════════

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'side', 'snack', 'dessert', 'drink'];
const MEAL_ICONS = {
  breakfast: 'sunrise', lunch: 'sun', dinner: 'moon', side: 'salad',
  snack: 'cookie', dessert: 'cake-slice', drink: 'cup-soda',
};
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getPlanRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + PLAN_DAYS - 1);
  return { start, end };
}

function formatDateParam(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function getRangeLabel() {
  const { start, end } = getPlanRange();
  return `${MONTH_SHORT[start.getMonth()]} ${start.getDate()} – ${MONTH_SHORT[end.getMonth()]} ${end.getDate()}`;
}

async function loadMealPlan() {
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
  const todayS = todayStr();

  // Group entries by date
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
      // Group by meal type, sorted
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
        html += `<div class="mp-meal-type">${escHtml(mealType)}</div>`;
        byMeal[mealType].forEach(entry => {
          const name = entry.recipe?.name || entry.title || '(untitled)';
          const icon = MEAL_ICONS[mealType] || 'utensils';
          html += `
            <div class="mp-entry">
              <span class="mp-entry-icon"><i data-lucide="${icon}" style="width:16px;height:16px"></i></span>
              <span class="mp-entry-name">${escHtml(name)}</span>
              <button class="mp-entry-delete" onclick="event.stopPropagation();deleteMealEntry(${entry.id})" title="Remove">
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

async function deleteMealEntry(entryId) {
  try {
    await api(`/households/mealplans/${entryId}`, { method: 'DELETE' });
    toast('Removed from meal plan');
    loadMealPlan();
  } catch (err) {
    toast('Failed to remove entry');
  }
}

function onMpInput() {
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
  mpKbIndex = -1;
  try {
    const data = await api(`/recipes?search=${encodeURIComponent(query)}&perPage=5&page=1`);
    const items = data.items || [];
    if (items.length === 0) {
      resultsEl.style.display = 'none';
      return;
    }
    resultsEl.innerHTML = items.map(r => `
      <div class="item" onclick="selectRecipe('${escHtml(r.slug)}', '${escHtml(r.name)}')">
        ${escHtml(r.name)}
        <div class="slug">${escHtml(r.slug)}</div>
      </div>
    `).join('');
    resultsEl.style.display = 'block';
  } catch (e) {
    resultsEl.style.display = 'none';
  }
}

function selectRecipe(slug, name) {
  document.getElementById('mp-input').value = name;
  document.getElementById('mp-input').dataset.selectedSlug = slug;
  document.getElementById('mp-search-results').style.display = 'none';
}

async function submitMealPlan() {
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
    let slug, recipeId, recipeName;

    if (isUrl(val)) {
      loading.querySelector('span').nextSibling.textContent = ' Importing from URL...';
      const result = await api('/recipes/create/url', { method: 'POST', body: { url: val, includeTags: false } });
      slug = typeof result === 'string' ? result : result.slug || result;
      if (typeof slug === 'string') slug = slug.replace(/^"|"$/g, '');
      const recipe = await api(`/recipes/${slug}`);
      recipeId = recipe.id;
      recipeName = recipe.name;
    } else if (input.dataset.selectedSlug) {
      slug = input.dataset.selectedSlug;
      const recipe = await api(`/recipes/${slug}`);
      recipeId = recipe.id;
      recipeName = recipe.name;
      delete input.dataset.selectedSlug;
    } else {
      loading.querySelector('span').nextSibling.textContent = ' Creating recipe...';
      const result = await api('/recipes', { method: 'POST', body: { name: val } });
      slug = typeof result === 'string' ? result : result.slug || result;
      if (typeof slug === 'string') slug = slug.replace(/^"|"$/g, '');
      const recipe = await api(`/recipes/${slug}`);
      recipeId = recipe.id;
      recipeName = recipe.name;
    }

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
      <p>${escHtml(msg)}</p>
    </div>
  `;
  initIcons();
  setTimeout(() => { el.innerHTML = ''; }, 4000);
}

// ═══════════════════════════════════
// ─── SHOPPING TAB ───
// ═══════════════════════════════════

async function loadLabels() {
  const data = await api('/groups/labels');
  allLabels = (data.items || data);
  labelMap = {};
  allLabels.forEach(l => { labelMap[l.id] = l; });
}

async function loadShoppingLists() {
  const data = await api('/households/shopping/lists');
  shoppingLists = data.items || data;
  const sel = document.getElementById('list-selector');
  sel.innerHTML = shoppingLists.map(l =>
    `<option value="${l.id}" ${l.id === activeListId ? 'selected' : ''}>${escHtml(l.name)}</option>`
  ).join('');
  if (!activeListId && shoppingLists.length > 0) {
    activeListId = shoppingLists[0].id;
  }
  if (activeListId) selectList(activeListId);
}

function populateCategoryOverride() {
  const sel = document.getElementById('category-override');
  sel.innerHTML = '<option value="">Auto / None</option>' +
    allLabels.sort((a,b) => a.name.localeCompare(b.name))
      .map(l => `<option value="${l.id}">${escHtml(l.name)}</option>`)
      .join('');
}

async function selectList(id) {
  activeListId = id;
  localStorage.setItem('mealie_active_list', id);
  await refreshList();
}

async function refreshList() {
  if (!activeListId) return;
  const content = document.getElementById('shopping-content');
  content.innerHTML = '<div class="loading-bar visible"><span class="spinner"></span> Loading...</div>';
  try {
    const data = await api(`/households/shopping/lists/${activeListId}`);
    activeListItems = data.listItems || [];
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

function renderShoppingList() {
  const content = document.getElementById('shopping-content');
  const unchecked = activeListItems.filter(i => !i.checked);
  const checked = activeListItems.filter(i => i.checked);

  if (unchecked.length === 0 && checked.length === 0) {
    content.innerHTML = '<div class="empty-state">List is empty. Add items above!</div>';
    return;
  }

  // Group unchecked by label
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
          <span class="arrow">▼</span>
          <span class="cat-name">${escHtml(groupName)}</span>
          <span class="cat-count">${items.length}</span>
        </div>
        <div class="category-items">
          ${items.map(i => renderItem(i, false)).join('')}
        </div>
      </div>
    `;
  });

  if (checked.length > 0) {
    // Sort checked items by most recently updated first
    const sortedChecked = [...checked].sort((a, b) => {
      const aTime = a.updateAt || a.updatedAt || '';
      const bTime = b.updateAt || b.updatedAt || '';
      return bTime.localeCompare(aTime);
    });
    html += `
      <div class="checked-section">
        <div class="checked-header">
          <span>Checked (${checked.length})</span>
          <button class="btn btn-outline btn-sm" onclick="clearCheckedItems()">Clear checked</button>
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
  // Show note inline only if item is food-linked and has a separate note
  const inlineNote = isFoodLinked && itemNote ? itemNote : '';
  const labelName = item.label?.name || item.food?.label?.name || '';
  const hasNote = isFoodLinked && !!itemNote;
  return `
    <div class="shop-item ${isChecked ? 'checked' : ''}">
      <div class="check-circle" onclick="toggleItem('${item.id}', ${!isChecked})"></div>
      <span class="item-text" onclick="toggleItem('${item.id}', ${!isChecked})">${escHtml(name)}${inlineNote ? ` <span style="color:var(--text-dim);font-size:13px">(${escHtml(inlineNote)})</span>` : ''}</span>
      <div class="item-actions">
        <div class="qty-stepper">
          <button onclick="event.stopPropagation();adjustQty('${item.id}',-1)" title="Decrease">−</button>
          <span class="qty-val">${qty}</span>
          <button onclick="event.stopPropagation();adjustQty('${item.id}',1)" title="Increase">+</button>
        </div>
        ${isFoodLinked ? `<button class="item-note-btn ${hasNote ? 'has-note' : ''}" onclick="event.stopPropagation();openNoteModal('${item.id}')" title="${hasNote ? 'Edit note' : 'Add note'}">
          <i data-lucide="message-square" style="width:14px;height:14px"></i>
        </button>` : ''}
        <button class="item-label-btn" onclick="event.stopPropagation();openLabelModal('${item.id}')">${labelName ? escHtml(labelName) : 'No label'}</button>
      </div>
    </div>
  `;
}

async function toggleItem(itemId, checked) {
  const item = activeListItems.find(i => i.id === itemId);
  if (!item) return;
  item.checked = checked;
  renderShoppingList();

  try {
    await api(`/households/shopping/items/${itemId}`, {
      method: 'PUT',
      body: { ...item, checked },
    });
  } catch (err) {
    item.checked = !checked;
    renderShoppingList();
    toast('Failed to update item');
  }
}

async function adjustQty(itemId, delta) {
  const item = activeListItems.find(i => i.id === itemId);
  if (!item) return;
  const oldQty = item.quantity || 1;
  const newQty = Math.max(1, oldQty + delta);
  if (newQty === oldQty) return;
  item.quantity = newQty;
  renderShoppingList();
  try {
    await api(`/households/shopping/items/${itemId}`, {
      method: 'PUT',
      body: { ...item, quantity: newQty },
    });
  } catch (err) {
    item.quantity = oldQty;
    renderShoppingList();
    toast('Failed to update quantity');
  }
}

let noteEditItemId = null;

function openNoteModal(itemId) {
  noteEditItemId = itemId;
  const item = activeListItems.find(i => i.id === itemId);
  if (!item) return;
  const name = getItemDisplayName(item);
  document.getElementById('note-modal-title').textContent = name;
  document.getElementById('note-modal-input').value = item.note || '';
  document.getElementById('note-modal').classList.add('visible');
  setTimeout(() => document.getElementById('note-modal-input').focus(), 100);
}

function closeNoteModal() {
  document.getElementById('note-modal').classList.remove('visible');
  noteEditItemId = null;
}

async function saveNote() {
  const item = activeListItems.find(i => i.id === noteEditItemId);
  if (!item) return;
  const newNote = document.getElementById('note-modal-input').value.trim();
  const oldNote = item.note;
  item.note = newNote;
  closeNoteModal();
  renderShoppingList();
  try {
    await api(`/households/shopping/items/${item.id}`, {
      method: 'PUT',
      body: { ...item, note: newNote },
    });
  } catch (err) {
    item.note = oldNote;
    renderShoppingList();
    toast('Failed to update note');
  }
}

async function clearCheckedItems() {
  const checked = activeListItems.filter(i => i.checked);
  if (checked.length === 0) return;

  for (const item of checked) {
    try {
      await api(`/households/shopping/items/${item.id}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to delete item:', e);
    }
  }

  activeListItems = activeListItems.filter(i => !i.checked);
  renderShoppingList();
  toast(`Cleared ${checked.length} items`);
}

// ─── Autocomplete (via Foods API) ───
function onAddItemInput() {
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

async function searchFoods(query) {
  const dropdown = document.getElementById('autocomplete-dropdown');
  acKbIndex = -1;
  try {
    const data = await api(`/foods?search=${encodeURIComponent(query)}&perPage=8&page=1`);
    const foods = data.items || [];

    const rawVal = document.getElementById('add-item-input').value.trim();
    let html = foods.map(f => {
      const labelName = f.label?.name || '';
      const fData = escHtml(JSON.stringify({ id: f.id, name: f.name, labelId: f.labelId || '' }));
      return `
        <div class="ac-item" onclick='selectFoodItem(${fData})'>
          ${escHtml(f.name)}
          ${labelName ? `<span class="ac-label">${escHtml(labelName)}</span>` : ''}
        </div>
      `;
    }).join('');

    html += `<div class="ac-item ac-new" onclick="addItemDirect()">+ Add "${escHtml(rawVal)}" as new item</div>`;

    dropdown.innerHTML = html;
    dropdown.classList.add('visible');
  } catch (e) {
    dropdown.classList.remove('visible');
  }
}

function selectFoodItem(food) {
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

async function addItemFromInput() {
  const input = document.getElementById('add-item-input');
  const text = input.value.trim();
  if (!text) return;

  const overrideLabel = document.getElementById('category-override').value;
  document.getElementById('autocomplete-dropdown').classList.remove('visible');
  document.getElementById('category-select-bar').classList.remove('visible');
  setAddButtonLoading(true);

  try {
    const body = {
      shoppingListId: activeListId,
      checked: false,
    };

    const hasLabel = overrideLabel || (selectedFood && selectedFood.labelId);

    if (selectedFood) {
      body.foodId = selectedFood.id;
      if (overrideLabel && overrideLabel !== selectedFood.labelId) {
        body.labelId = overrideLabel;
      }
    } else {
      // Create a food entry so the name is stored in food.name
      // and the note field stays available for actual notes
      try {
        const newFood = await api('/foods', {
          method: 'POST',
          body: { name: text, labelId: overrideLabel || undefined },
        });
        body.foodId = newFood.id;
        if (overrideLabel) {
          body.labelId = overrideLabel;
        }
      } catch (e) {
        // Fall back to note-only if food creation fails
        body.note = text;
        if (overrideLabel) {
          body.labelId = overrideLabel;
        }
      }
    }

    await api('/households/shopping/items', {
      method: 'POST',
      body,
    });
    input.value = '';
    selectedFood = null;
    document.getElementById('category-override').value = '';
    toast(`Added "${text}"`);
    await refreshList();

    // If item had no category, prompt user to pick one
    if (!hasLabel) {
      const added = activeListItems.find(i =>
        (!i.checked) && (
          (i.food?.name && i.food.name.toLowerCase() === text.toLowerCase()) ||
          (i.note && i.note.toLowerCase() === text.toLowerCase())
        )
      );
      if (added) {
        openLabelModal(added.id);
      }
    }
  } catch (err) {
    toast('Failed to add item');
  } finally {
    setAddButtonLoading(false);
  }
}

function addItemDirect() {
  selectedFood = null;
  document.getElementById('autocomplete-dropdown').classList.remove('visible');
  addItemFromInput();
}

// ─── Label picker modal ───
let labelEditItemId = null;

function openLabelModal(itemId) {
  labelEditItemId = itemId;
  const item = activeListItems.find(i => i.id === itemId);
  if (!item) return;

  const currentLabelId = item.labelId || item.label?.id || item.food?.label?.id || null;
  const name = getItemDisplayName(item);
  document.getElementById('label-modal-title').textContent = name;

  const list = document.getElementById('label-modal-list');
  let html = `<div class="label-modal-item ${!currentLabelId ? 'active' : ''}" onclick="setItemLabel(null)">
    <span class="lm-check">${!currentLabelId ? '✓' : ''}</span> No label
  </div>`;
  allLabels.sort((a,b) => a.name.localeCompare(b.name)).forEach(l => {
    const isActive = currentLabelId === l.id;
    html += `<div class="label-modal-item ${isActive ? 'active' : ''}" onclick="setItemLabel('${l.id}')">
      <span class="lm-check">${isActive ? '✓' : ''}</span> ${escHtml(l.name)}
    </div>`;
  });
  list.innerHTML = html;

  document.getElementById('label-modal').classList.add('visible');
  const searchInput = document.getElementById('label-search-input');
  searchInput.value = '';
  setTimeout(() => searchInput.focus(), 100);
}

function closeLabelModal() {
  document.getElementById('label-modal').classList.remove('visible');
  labelEditItemId = null;
}

async function setItemLabel(labelId) {
  const item = activeListItems.find(i => i.id === labelEditItemId);
  if (!item) return;
  closeLabelModal();

  const oldLabelId = item.labelId;
  const oldLabel = item.label;
  item.labelId = labelId;
  item.label = labelId ? labelMap[labelId] || { id: labelId, name: '...' } : null;
  renderShoppingList();

  try {
    await api(`/households/shopping/items/${item.id}`, {
      method: 'PUT',
      body: { ...item, labelId: labelId || null },
    });
    // Also update the food's label in Mealie so future uses inherit it
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

// ─── Pull to refresh ───
function setupPullToRefresh() {
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
      indicator.textContent = '↓ Release to refresh';
    } else if (diff > 0) {
      indicator.style.display = 'block';
      indicator.textContent = '↓ Pull to refresh';
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

// ─── Keyboard navigation helpers ───
function highlightAcItem(items) {
  items.forEach((el, i) => el.classList.toggle('kb-active', i === acKbIndex));
  if (acKbIndex >= 0) items[acKbIndex].scrollIntoView({ block: 'nearest' });
}
function highlightMpItem(items) {
  items.forEach((el, i) => el.classList.toggle('kb-active', i === mpKbIndex));
  if (mpKbIndex >= 0) items[mpKbIndex].scrollIntoView({ block: 'nearest' });
}

// ─── Label modal search ───
function filterLabelModal() {
  const query = document.getElementById('label-search-input').value.trim();
  const queryLower = query.toLowerCase();
  const items = document.querySelectorAll('#label-modal-list .label-modal-item:not(.lm-create)');
  let exactMatch = false;
  items.forEach(el => {
    const name = el.textContent.toLowerCase().trim();
    const matches = name.includes(queryLower);
    el.style.display = matches ? '' : 'none';
    if (matches && name.replace('✓', '').trim() === queryLower) exactMatch = true;
  });
  // Show or hide the "create" option
  let createEl = document.querySelector('#label-modal-list .lm-create');
  if (query.length >= 2 && !exactMatch) {
    if (!createEl) {
      createEl = document.createElement('div');
      createEl.className = 'label-modal-item lm-create';
      document.getElementById('label-modal-list').appendChild(createEl);
    }
    createEl.innerHTML = `<span class="lm-check">+</span> Create "${escHtml(query)}"`;
    createEl.onclick = () => createLabel(query);
    createEl.style.display = '';
  } else if (createEl) {
    createEl.style.display = 'none';
  }
}

async function createLabel(name) {
  try {
    const newLabel = await api('/groups/labels', {
      method: 'POST',
      body: { name },
    });
    // Add to local state
    allLabels.push(newLabel);
    labelMap[newLabel.id] = newLabel;
    populateCategoryOverride();
    toast(`Created "${name}"`);
    // Apply the new label to the item being edited
    if (labelEditItemId) {
      setItemLabel(newLabel.id);
    } else {
      closeLabelModal();
    }
  } catch (err) {
    toast('Failed to create category');
  }
}

// ─── Icons ───
function initIcons() {
  if (window.lucide) lucide.createIcons();
}

// ─── Service Worker ───
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Initialize icons after DOM + Lucide loaded
document.addEventListener('DOMContentLoaded', () => setTimeout(initIcons, 50));
