import { accessToken } from './signals.js';
import { SK } from './constants.js';

let refreshTimer = null;

function getTokenStorage() {
  return localStorage.getItem(SK.REMEMBER) === 'true' ? localStorage : sessionStorage;
}

function saveToken(token) {
  accessToken.value = token;
  getTokenStorage().setItem(SK.TOKEN, token);
}

function clearToken() {
  accessToken.value = '';
  localStorage.removeItem(SK.TOKEN);
  sessionStorage.removeItem(SK.TOKEN);
}

export async function tryRefreshToken() {
  try {
    const resp = await fetch('/api/auth/refresh', {
      headers: { 'Authorization': 'Bearer ' + accessToken.value },
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

export function scheduleTokenRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    const ok = await tryRefreshToken();
    if (!ok) {
      logout();
    }
  }, 20 * 60 * 1000);
}

export function logout() {
  clearToken();
  clearTimeout(refreshTimer);
}

export async function doLogin(email, password, remember) {
  const body = new URLSearchParams();
  body.append('username', email);
  body.append('password', password);
  body.append('remember_me', remember.toString());

  const resp = await fetch('/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.detail || 'Invalid email or password');
  }

  const data = await resp.json();
  localStorage.setItem(SK.REMEMBER, remember.toString());
  saveToken(data.access_token);
  scheduleTokenRefresh();
}
