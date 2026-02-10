import { html } from '../lib.js';
import { activeTab } from '../signals.js';
import { SK } from '../constants.js';
import { Icon } from './Icon.js';
import { logout } from '../auth.js';

export function switchTab(name) {
  activeTab.value = name;
  localStorage.setItem(SK.ACTIVE_TAB, name);
}

export function Header() {
  return html`
    <header>
      <div class="header-bar">
        <span class="app-title">Mealie Companion</span>
        <div class="header-actions">
          <a class="header-action-btn" href="https://github.com/abealsaleh/mealie-companion/issues/new" target="_blank" rel="noopener" title="Report issue">
            <${Icon} name="bug" class="icon" />
          </a>
          <button class="header-action-btn" onclick=${logout} title="Sign out">
            <${Icon} name="log-out" class="icon" />
          </button>
        </div>
      </div>
      <nav>
        <button class=${activeTab.value === 'mealplan' ? 'active' : ''} onclick=${() => switchTab('mealplan')}>
          <${Icon} name="calendar-plus" class="icon" /> Meal Plan
        </button>
        <button class=${activeTab.value === 'shopping' ? 'active' : ''} onclick=${() => switchTab('shopping')}>
          <${Icon} name="shopping-cart" class="icon" /> Shopping
        </button>
      </nav>
    </header>
  `;
}
