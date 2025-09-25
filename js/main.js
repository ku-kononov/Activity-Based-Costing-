// js/main.js
import { initRouter, navigate } from './router.js';
import { initIconsOnce, refreshIcons, qs } from './utils.js';

// Инициализируем иконки максимально рано
initIconsOnce();
setTimeout(() => { initIconsOnce(); refreshIcons(); }, 0);

function initGlobalUI() {
  qs('#year') && (qs('#year').textContent = new Date().getFullYear());

  const sidebarToggle = qs('#sidebarToggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
      const iconEl = sidebarToggle.querySelector('i[data-lucide]');
      if (iconEl) iconEl.setAttribute('data-lucide', isCollapsed ? 'panel-left-open' : 'panel-left-close');
      refreshIcons();
    });
  }

  const userMenuButton = qs('#userMenuButton');
  const userMenu = qs('#userMenu');
  if (userMenuButton && userMenu) {
    const closeMenu = () => { userMenu.classList.remove('open'); userMenu.setAttribute('aria-hidden', 'true'); userMenuButton.setAttribute('aria-expanded', 'false'); };
    const openMenu = () => { userMenu.classList.add('open'); userMenu.setAttribute('aria-hidden', 'false'); userMenuButton.setAttribute('aria-expanded', 'true'); };
    userMenuButton.addEventListener('click', e => { e.stopPropagation(); (userMenu.classList.contains('open') ? closeMenu : openMenu)(); });
    userMenu.addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', () => closeMenu());
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  }

  qs('#themeToggle')?.addEventListener('click', ()=> document.documentElement.classList.toggle('theme-dark'));
}

function initApp() {
  initGlobalUI();
  initIconsOnce();
  initRouter();
}

document.addEventListener('DOMContentLoaded', initApp);
window.addEventListener('load', () => { initIconsOnce(); refreshIcons(); });