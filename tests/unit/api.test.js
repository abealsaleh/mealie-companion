import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockFetch, jsonResponse } from './fetch-mock.js';
import { FOOD_SEARCH } from '../fixtures/data.js';

// Fresh imports per test — state.js reads localStorage at load time
let api, searchAndSortFoods, findOrCreateFood, state;

beforeEach(async () => {
  // Reset modules so state.js re-evaluates with fresh localStorage
  vi.resetModules();
  localStorage.setItem('mealie_access_token', 'test-token');
  const stateModule = await import('../../js/state.js');
  state = stateModule.state;
  state.accessToken = 'test-token';
  const apiModule = await import('../../js/api.js');
  api = apiModule.api;
  searchAndSortFoods = apiModule.searchAndSortFoods;
  findOrCreateFood = apiModule.findOrCreateFood;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api()', () => {
  it('sends GET with auth header', async () => {
    const fetchFn = mockFetch(() => jsonResponse({ ok: true }));
    await api('/test');
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, opts] = fetchFn.mock.calls[0];
    expect(url).toBe('/api/test');
    expect(opts.headers.Authorization).toBe('Bearer test-token');
  });

  it('sends POST with JSON body', async () => {
    const fetchFn = mockFetch(() => jsonResponse({ id: 1 }));
    await api('/items', { method: 'POST', body: { name: 'test' } });
    const [, opts] = fetchFn.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(JSON.stringify({ name: 'test' }));
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('throws on non-ok response', async () => {
    mockFetch(() => ({
      ok: false,
      status: 404,
      headers: { get: () => null },
      text: () => Promise.resolve('Not found'),
    }));
    await expect(api('/missing')).rejects.toThrow('API 404: Not found');
  });
});

describe('searchAndSortFoods()', () => {
  it('sorts exact -> prefix -> rest', async () => {
    mockFetch(() => jsonResponse(FOOD_SEARCH));
    const results = await searchAndSortFoods('tomato');
    expect(results[0].name).toBe('Tomato');
    expect(results[1].name).toBe('Tomato Paste');
    // Cherry Tomato and Sun-dried Tomato are "rest" — alphabetical
    expect(results[2].name).toBe('Cherry Tomato');
    expect(results[3].name).toBe('Sun-dried Tomato');
  });

  it('respects limit', async () => {
    mockFetch(() => jsonResponse(FOOD_SEARCH));
    const results = await searchAndSortFoods('tomato', 2);
    expect(results).toHaveLength(2);
  });

  it('handles empty results', async () => {
    mockFetch(() => jsonResponse({ items: [] }));
    const results = await searchAndSortFoods('xyz');
    expect(results).toEqual([]);
  });
});

describe('findOrCreateFood()', () => {
  it('returns exact match when found', async () => {
    mockFetch(() => jsonResponse(FOOD_SEARCH));
    const result = await findOrCreateFood('Tomato');
    expect(result.id).toBe('food-10');
    expect(result.name).toBe('Tomato');
  });

  it('creates food when no exact match', async () => {
    let callCount = 0;
    mockFetch((url, opts) => {
      callCount++;
      if (callCount === 1) return jsonResponse({ items: [] });
      // POST to create
      return jsonResponse({ id: 'food-new', name: 'Kale' });
    });
    const result = await findOrCreateFood('Kale');
    expect(result.name).toBe('Kale');
  });

  it('passes labelId when creating', async () => {
    const fetchFn = mockFetch((url, opts) => {
      if (!opts?.method) return jsonResponse({ items: [] });
      return jsonResponse({ id: 'food-new', name: 'Kale', labelId: 'label-1' });
    });
    await findOrCreateFood('Kale', 'label-1');
    const postCall = fetchFn.mock.calls.find(([, o]) => o?.method === 'POST');
    expect(JSON.parse(postCall[1].body)).toEqual({ name: 'Kale', labelId: 'label-1' });
  });

  it('returns null on error', async () => {
    mockFetch(() => { throw new Error('network fail'); });
    const result = await findOrCreateFood('anything');
    expect(result).toBeNull();
  });
});
