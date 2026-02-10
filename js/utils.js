import { MONTH_SHORT } from './constants.js';

export function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function isUrl(s) {
  return /^https?:\/\//i.test(s.trim());
}

export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function formatDateParam(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function getPlanRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7); // PLAN_DAYS - 1
  return { start, end };
}

export function getRangeLabel() {
  const { start, end } = getPlanRange();
  return `${MONTH_SHORT[start.getMonth()]} ${start.getDate()} \u2013 ${MONTH_SHORT[end.getMonth()]} ${end.getDate()}`;
}

export function getItemDisplayName(item) {
  if (item.food?.name) return item.food.name;
  if (item.note) return item.note;
  if (item.display) return item.display;
  return '(unnamed)';
}

export function getItem(itemId, items) {
  return items.find(i => i.id === itemId);
}

export function ingredientDisplayText(ing) {
  let parts = [];
  if (ing.qty != null) {
    let q = ing.qty % 1 === 0 ? String(Math.round(ing.qty)) : String(ing.qty);
    if (ing.unitName) q += ' ' + ing.unitName;
    parts.push(q);
  }
  if (ing.name) parts.push(ing.name);
  let text = parts.join(' ') || '(unnamed)';
  if (ing.ingNote) text += ` (${ing.ingNote})`;
  return text;
}

export function updateSignalArray(signal, idx, updates) {
  const arr = [...signal.value];
  arr[idx] = { ...arr[idx], ...updates };
  signal.value = arr;
}

export function ingLinkBadge(ing) {
  if (ing.foodId && ing.labelName) {
    return { text: ing.labelName, linked: true };
  }
  if (ing.foodId) {
    return { text: 'Linked', linked: true };
  }
  return { text: 'Not linked', linked: false };
}
