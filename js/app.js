import { html, useEffect } from './lib.js';
import { accessToken, activeTab } from './signals.js';
import { setApiCallbacks } from './api.js';
import { tryRefreshToken, logout, scheduleTokenRefresh } from './auth.js';
import { toast } from './components/Toast.js';
import { Toast } from './components/Toast.js';
import { LoginForm } from './components/LoginForm.js';
import { Header, switchTab } from './components/TabNav.js';
import { MealPlan } from './components/MealPlan.js';
import { ShoppingList, loadLabels, loadShoppingLists, refreshList } from './components/ShoppingList.js';
import { IngredientModal } from './components/IngredientModal.js';
import { ListPicker } from './components/ListPicker.js';

// Wire API callbacks
setApiCallbacks({
  tryRefresh: tryRefreshToken,
  onUnauthorized: () => { logout(); toast('Session expired - please sign in again'); },
});

async function init() {
  scheduleTokenRefresh();
  try {
    await Promise.all([loadLabels(), loadShoppingLists()]);
  } catch (err) {
    console.error('Init error:', err);
    if (!err.message?.includes('401')) {
      toast('Connection error');
    }
  }
}

export function App() {
  const isLoggedIn = !!accessToken.value;
  const tab = activeTab.value;

  const onLoginSuccess = () => {
    init();
  };

  // Init on mount if already logged in
  useEffect(() => {
    if (isLoggedIn) init();
  }, []);

  // Refresh shopping list when switching to that tab
  useEffect(() => {
    if (tab === 'shopping' && isLoggedIn) refreshList();
  }, [tab]);

  const openIngredients = (slug, name, recipeId) => {
    window.__openIngredientModal?.(slug, name, recipeId);
  };

  return html`
    ${isLoggedIn ? html`<${Header} />` : null}
    <${LoginForm} onLoginSuccess=${onLoginSuccess} />
    ${isLoggedIn ? html`
      <${MealPlan} onOpenIngredients=${openIngredients} active=${tab === 'mealplan'} />
      <${ShoppingList} active=${tab === 'shopping'} />
      <${IngredientModal} />
      <${ListPicker} />
    ` : null}
    <${Toast} />
  `;
}
