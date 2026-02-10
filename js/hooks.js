import { useState, useRef } from './lib.js';

export function useRefresh(loadFn, minMs = 600) {
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    const min = new Promise(r => setTimeout(r, minMs));
    try { await Promise.all([loadFn(), min]); } finally { setRefreshing(false); }
  };
  return { refreshing, handleRefresh };
}

export function useTogglePanel(inputRef) {
  const [panelOpen, setPanelOpen] = useState(false);
  const togglePanel = () => {
    const opening = !panelOpen;
    setPanelOpen(opening);
    if (opening) setTimeout(() => inputRef.current?.focus(), 50);
  };
  return { panelOpen, setPanelOpen, togglePanel };
}
