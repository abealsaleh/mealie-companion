import { state } from './state.js';
import { toast } from './ui.js';

let refreshTimer = null;
let _onLoginSuccess = null;

export function setAuthCallbacks({ onLoginSuccess }) {
  _onLoginSuccess = onLoginSuccess;
}

function getTokenStorage() {
  return localStorage.getItem('mealie_remember') === 'true' ? localStorage : sessionStorage;
}

function saveToken(token) {
  state.accessToken = token;
  getTokenStorage().setItem('mealie_access_token', token);
}

function clearToken() {
  state.accessToken = '';
  localStorage.removeItem('mealie_access_token');
  sessionStorage.removeItem('mealie_access_token');
}

export async function tryRefreshToken() {
  try {
    const resp = await fetch('/api/auth/refresh', {
      headers: { 'Authorization': 'Bearer ' + state.accessToken },
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
      toast('Session expired - please sign in again');
    }
  }, 20 * 60 * 1000);
}

export function logout() {
  clearToken();
  clearTimeout(refreshTimer);
  showSetup();
}

export function showSetup() {
  document.getElementById('setup').classList.add('active');
  document.getElementById('login-error').style.display = 'none';
}

export function hideSetup() {
  document.getElementById('setup').classList.remove('active');
}

export async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const remember = document.getElementById('login-remember').checked;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  if (!email || !password) {
    errEl.textContent = 'Please enter email and password';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in...';
  errEl.style.display = 'none';

  try {
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
    localStorage.setItem('mealie_remember', remember.toString());
    saveToken(data.access_token);
    scheduleTokenRefresh();
    document.getElementById('login-password').value = '';
    toast('Signed in');
    _onLoginSuccess?.();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}
