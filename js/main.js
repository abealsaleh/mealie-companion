import { render, html } from './lib.js';
import { App } from './app.js';

render(html`<${App} />`, document.getElementById('app'));

// Service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
}
