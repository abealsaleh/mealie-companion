import { vi } from 'vitest';

// Stub localStorage and sessionStorage — state.js reads them at module load
const makeStorage = () => {
  const store = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
};

globalThis.localStorage = makeStorage();
globalThis.sessionStorage = makeStorage();

// Stub lucide (used by ui.js initIcons)
globalThis.lucide = { createIcons: vi.fn() };
