import { html, useEffect, useRef } from '../lib.js';

export function Icon({ name, size = 16, style: extraStyle = '', class: cls = '' }) {
  const spanRef = useRef(null);

  useEffect(() => {
    if (spanRef.current && window.lucide) {
      const i = spanRef.current.querySelector('i');
      if (i) lucide.createIcons({ nodes: [i] });
    }
  });

  return html`<span ref=${spanRef} class=${cls}>
    <i data-lucide=${name} style=${`width:${size}px;height:${size}px;${extraStyle}`}></i>
  </span>`;
}
