import { describe, it, expect } from 'vitest';
import { esc, isUrl, generateUUID } from '../../js/utils.js';

describe('esc()', () => {
  it('escapes HTML entities', () => {
    expect(esc('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes ampersands', () => {
    expect(esc('a & b')).toBe('a &amp; b');
  });

  it('escapes quotes', () => {
    expect(esc(`"hello" & 'world'`)).toBe('&quot;hello&quot; &amp; &#39;world&#39;');
  });

  it('passes through plain text', () => {
    expect(esc('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(esc('')).toBe('');
  });
});

describe('isUrl()', () => {
  it('accepts http URLs', () => {
    expect(isUrl('http://example.com')).toBe(true);
  });

  it('accepts https URLs', () => {
    expect(isUrl('https://example.com/path')).toBe(true);
  });

  it('rejects plain text', () => {
    expect(isUrl('not a url')).toBe(false);
  });

  it('trims whitespace', () => {
    expect(isUrl('  https://example.com  ')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(isUrl('HTTPS://EXAMPLE.COM')).toBe(true);
  });
});

describe('generateUUID()', () => {
  it('matches v4 UUID format', () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('generates unique values', () => {
    const uuids = new Set(Array.from({ length: 100 }, () => generateUUID()));
    expect(uuids.size).toBe(100);
  });
});
