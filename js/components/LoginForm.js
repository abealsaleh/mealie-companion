import { html, useState } from '../lib.js';
import { doLogin } from '../auth.js';
import { toast } from './Toast.js';
import { Icon } from './Icon.js';
import { accessToken } from '../signals.js';

export function LoginForm({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isLoggedIn = !!accessToken.value;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await doLogin(email.trim(), password, remember);
      setPassword('');
      toast('Signed in');
      onLoginSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return html`
    <div id="setup" class=${!isLoggedIn ? 'active' : ''}>
      <form id="login-form" action="#" method="post" onsubmit=${handleSubmit}>
        <div style="font-size:48px;margin-bottom:8px;text-align:center">
          <${Icon} name="chef-hat" size=${48} style="color:var(--accent)" />
        </div>
        <h2 style="text-align:center">Sign In</h2>
        <p style="color:var(--text-muted);text-align:center;font-size:14px;max-width:340px;margin:0 auto 16px">Log in with your Mealie account.</p>
        <input type="text" id="login-email" name="username" placeholder="Email or username" autocomplete="username"
               value=${email} oninput=${e => setEmail(e.target.value)} />
        <input type="password" id="login-password" name="password" placeholder="Password" autocomplete="current-password"
               value=${password} oninput=${e => setPassword(e.target.value)} />
        <label style="display:flex;align-items:center;gap:8px;color:var(--text-muted);font-size:14px;width:100%;max-width:400px">
          <input type="checkbox" id="login-remember" name="remember" checked=${remember}
                 onchange=${e => setRemember(e.target.checked)} /> Remember me
        </label>
        <button type="submit" class="btn btn-primary" id="login-btn" disabled=${loading}>
          ${loading ? 'Signing in...' : 'Sign In'}
        </button>
        <div id="login-error" style=${`color:var(--accent);font-size:14px;display:${error ? 'block' : 'none'}`}>
          ${error}
        </div>
      </form>
    </div>
  `;
}
