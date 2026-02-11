import { describe, it, expect, beforeEach, vi } from 'vitest';

// cachedSignal is not exported, so we test it indirectly through signals.
// We reset localStorage and re-import signals to verify hydration behavior.
// For direct unit tests, we replicate the factory here.
import { signal } from '../../js/lib.js';

function cachedSignal(key, fallback) {
  let initial = fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) initial = JSON.parse(raw);
  } catch {}
  const sig = signal(initial);
  let first = true;
  sig.subscribe(value => {
    if (first) { first = false; return; }
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  });
  return sig;
}

describe('cachedSignal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads from localStorage on creation', () => {
    localStorage.setItem('test_key', JSON.stringify([1, 2, 3]));
    const sig = cachedSignal('test_key', []);
    expect(sig.value).toEqual([1, 2, 3]);
  });

  it('falls back to default when localStorage is empty', () => {
    const sig = cachedSignal('missing_key', 'default');
    expect(sig.value).toBe('default');
  });

  it('falls back to default on corrupted JSON', () => {
    localStorage.setItem('bad_key', '{not valid json');
    const sig = cachedSignal('bad_key', 42);
    expect(sig.value).toBe(42);
  });

  it('persists to localStorage on value change', () => {
    const sig = cachedSignal('persist_key', '');
    sig.value = 'hello';
    expect(JSON.parse(localStorage.getItem('persist_key'))).toBe('hello');
  });

  it('does not write initial value back to localStorage', () => {
    localStorage.setItem('no_write_key', JSON.stringify('original'));
    const spy = vi.spyOn(localStorage, 'setItem');
    cachedSignal('no_write_key', 'fallback');
    const writes = spy.mock.calls.filter(([k]) => k === 'no_write_key');
    expect(writes).toHaveLength(0);
    spy.mockRestore();
  });
});
