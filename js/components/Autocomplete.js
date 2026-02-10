import { useState, useRef, useEffect } from '../lib.js';

export function useAutocomplete({
  onSearch,
  onSelect,
  onFooterSelect,
  onFallbackEnter,
  debounceMs = 200,
  minChars = 2,
  footerCount = 0,
}) {
  const [items, setItems] = useState([]);
  const [visible, setVisible] = useState(false);
  const [kbIndex, setKbIndex] = useState(-1);
  const timerRef = useRef(null);
  const containerRef = useRef(null);
  const cbRef = useRef({ onSearch, onSelect, onFooterSelect, onFallbackEnter });
  cbRef.current = { onSearch, onSelect, onFooterSelect, onFallbackEnter };

  // Cleanup timer on unmount
  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Outside-click close
  useEffect(() => {
    if (!visible) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setVisible(false);
        setKbIndex(-1);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [visible]);

  const close = () => {
    setVisible(false);
    setKbIndex(-1);
    setItems([]);
  };

  const search = (query) => {
    if (query.length < minChars) {
      setVisible(false);
      setItems([]);
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setKbIndex(-1);
      try {
        const results = await cbRef.current.onSearch(query);
        setItems(results);
        setVisible(results.length > 0 || footerCount > 0);
      } catch {
        setVisible(false);
      }
    }, debounceMs);
  };

  const handleKeydown = (e) => {
    if (visible && items.length > 0) {
      const total = items.length + footerCount;
      if (e.key === 'ArrowDown') { e.preventDefault(); setKbIndex(i => Math.min(i + 1, total - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setKbIndex(i => Math.max(i - 1, -1)); return; }
      if (e.key === 'Enter' && kbIndex >= 0) {
        e.preventDefault();
        if (kbIndex < items.length) cbRef.current.onSelect?.(items[kbIndex]);
        else if (footerCount > 0) cbRef.current.onFooterSelect?.();
        return;
      }
      if (e.key === 'Escape') { setVisible(false); setKbIndex(-1); return; }
    }
    if (e.key === 'Enter' && cbRef.current.onFallbackEnter) cbRef.current.onFallbackEnter();
  };

  return { items, visible, kbIndex, search, handleKeydown, close, containerRef };
}
