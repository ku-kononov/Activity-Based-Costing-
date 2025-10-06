// js/theme.js
import { applyChartTheme } from './charts-theme.js';

const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';

export function applyAppearance(theme) {
  const html = document.documentElement;
  if (theme === THEME_DARK) html.setAttribute('data-theme', 'dark');
  else html.removeAttribute('data-theme');

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const bg = getComputedStyle(html).getPropertyValue('--bg').trim() || '#ffffff';
    meta.setAttribute('content', bg);
  }

  applyChartTheme(theme);
  try { window.lucide?.createIcons?.(); } catch {}
}

export function getAppearance() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? THEME_DARK : THEME_LIGHT;
}

export function initAppearance() {
  applyAppearance(THEME_LIGHT); // старт всегда со светлой
  return THEME_LIGHT;
}

export function toggleAppearance() {
  const next = getAppearance() === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  applyAppearance(next);
  document.dispatchEvent(new CustomEvent('appearance:change', { detail: { theme: next } }));
  return next;
}