// js/main.js
import { initRouter } from './router.js';
import { refreshIcons, initIconsOnce } from './utils.js';

/**
 * Инициализирует глобальные обработчики UI.
 */
function initGlobalUI() {
  document.getElementById('year')?.textContent = new Date().getFullYear();
  
  const sidebarToggle = document.getElementById('sidebarToggle');
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
      const iconEl = sidebarToggle.querySelector('i[data-lucide]');
      if (iconEl) {
        iconEl.setAttribute('data-lucide', isCollapsed ? 'panel-left-open' : 'panel-left-close');
      }
      sidebarToggle.setAttribute('aria-label', isCollapsed ? 'Развернуть меню' : 'Свернуть меню');
      refreshIcons();
    });
  }

  const userMenuButton = document.getElementById('userMenuButton');
  const userMenu = document.getElementById('userMenu');
  if (userMenuButton && userMenu) {
    const closeMenu = () => {
      userMenu.classList.remove('open');
      userMenu.setAttribute('aria-hidden', 'true');
      userMenuButton.setAttribute('aria-expanded', 'false');
    };
    const openMenu = () => {
      userMenu.classList.add('open');
      userMenu.setAttribute('aria-hidden', 'false');
      userMenuButton.setAttribute('aria-expanded', 'true');
    };
    userMenuButton.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = userMenu.classList.contains('open');
      if (isOpen) { closeMenu(); } else { openMenu(); }
    });
    userMenu.addEventListener('click', e => { e.stopPropagation(); });
    document.addEventListener('click', () => { closeMenu(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  }
}

/**
 * Главная функция инициализации приложения.
 */
function initApp() {
  initGlobalUI();
  // Инициализируем иконки Lucide один раз (для хедера, сайдбара и т.д.)
  initIconsOnce();
  initRouter();
}

document.addEventListener('DOMContentLoaded', initApp);