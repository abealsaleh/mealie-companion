import { state } from './state.js';

// Callbacks set by main.js to break circular deps
let _tryRefresh = null;
let _onUnauthorized = null;

export function setApiCallbacks({ tryRefresh, onUnauthorized }) {
  _tryRefresh = tryRefresh;
  _onUnauthorized = onUnauthorized;
}

// DRY #1/#2: extracted doFetch + parseResponse
export async function api(path, opts = {}) {
  const doFetch = () => fetch('/api' + path, {
    ...opts,
    headers: {
      'Authorization': 'Bearer ' + state.accessToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const parseResponse = async (resp) => {
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`API ${resp.status}: ${text}`);
    }
    const ct = resp.headers.get('content-type');
    return ct && ct.includes('application/json') ? resp.json() : resp.text();
  };

  let resp = await doFetch();
  if (resp.status === 401) {
    const refreshed = _tryRefresh ? await _tryRefresh() : false;
    if (refreshed) {
      resp = await doFetch();
      return parseResponse(resp);
    }
    _onUnauthorized?.();
    throw new Error('API 401: Unauthorized');
  }
  return parseResponse(resp);
}

// DRY #7: shared food search + sort (used by shopping and ingredient autocompletes)
export async function searchAndSortFoods(query, limit = 8) {
  const data = await api(`/foods?search=${encodeURIComponent(query)}&perPage=25&page=1`);
  const foods = data.items || [];
  const q = query.toLowerCase();
  foods.sort((a, b) => {
    const aName = a.name.toLowerCase(), bName = b.name.toLowerCase();
    const aExact = aName === q, bExact = bName === q;
    if (aExact !== bExact) return aExact ? -1 : 1;
    const aPre = aName.startsWith(q), bPre = bName.startsWith(q);
    if (aPre !== bPre) return aPre ? -1 : 1;
    return aName.localeCompare(bName);
  });
  return foods.slice(0, limit);
}

// DRY #8: shared find-or-create food (used by shopping add, ingredient add, recipe-to-list)
export async function findOrCreateFood(name, labelId = null) {
  try {
    const data = await api(`/foods?search=${encodeURIComponent(name)}&perPage=20&page=1`);
    const foods = data.items || [];
    const exact = foods.find(f => f.name.toLowerCase() === name.toLowerCase());
    if (exact) return exact;
    const body = { name };
    if (labelId) body.labelId = labelId;
    return await api('/foods', { method: 'POST', body });
  } catch (e) {
    return null;
  }
}
