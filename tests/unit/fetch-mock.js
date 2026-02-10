import { vi } from 'vitest';

export function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h) => h.toLowerCase() === 'content-type' ? 'application/json' : null },
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

export function mockFetch(handler) {
  const fn = vi.fn(async (url, opts) => handler(url, opts));
  globalThis.fetch = fn;
  return fn;
}
