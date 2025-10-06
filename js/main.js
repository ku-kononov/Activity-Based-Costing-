// js/main.js
import { initRouter } from './router.js';
import { initIconsOnce, refreshIcons, qs } from './utils.js';
import { initAppearance, toggleAppearance, getAppearance } from './theme.js';

function injectAppearanceToggle() {
  const sidebar = qs('.sidebar');
  if (!sidebar || qs('#appearanceToggle')) return;

  const btn = document.createElement('button');
  btn.id = 'appearanceToggle';
  btn.className = 'appearance-toggle';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Переключить тему');
  btn.title = 'Переключить тему';
  btn.innerHTML = `<i data-lucide="sun"></i>`; // только иконка, без текста

  btn.addEventListener('click', () => {
    const theme = toggleAppearance();
    const icon = btn.querySelector('i[data-lucide]');
    if (icon) icon.setAttribute('data-lucide', theme === 'dark' ? 'moon' : 'sun');
    refreshIcons();
  });

  sidebar.appendChild(btn);

  const theme = getAppearance();
  const icon = btn.querySelector('i[data-lucide]');
  if (icon) icon.setAttribute('data-lucide', theme === 'dark' ? 'moon' : 'sun');
  refreshIcons();
}

function initGlobalUI() {
  qs('#year') && (qs('#year').textContent = new Date().getFullYear());

  const sidebarToggle = qs('#sidebarToggle');
  sidebarToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    const iconEl = sidebarToggle.querySelector('i[data-lucide]');
    if (iconEl) iconEl.setAttribute('data-lucide', isCollapsed ? 'panel-left-open' : 'panel-left-close');
    refreshIcons();
  });

  const userMenuButton = qs('#userMenuButton');
  const userMenu = qs('#userMenu');
  if (userMenuButton && userMenu) {
    const closeMenu = () => {
      userMenu.setAttribute('aria-hidden', 'true');
      userMenuButton.setAttribute('aria-expanded', 'false');
    };
    userMenuButton.addEventListener('click', e => {
      e.stopPropagation();
      const isHidden = userMenu.getAttribute('aria-hidden') === 'true';
      userMenu.setAttribute('aria-hidden', String(!isHidden));
      userMenuButton.setAttribute('aria-expanded', String(isHidden));
    });
    document.addEventListener('click', closeMenu);
    document.addEventListener('keydown', e => e.key === 'Escape' && closeMenu());
  }

  injectAppearanceToggle();
}

function initApp() {
  initAppearance();    // применяем тему рано, без "мигания"
  initGlobalUI();
  initRouter();
  initIconsOnce();
}

document.addEventListener('DOMContentLoaded', initApp);