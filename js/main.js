// js/main.js
import { initRouter } from './router.js';
import { initIconsOnce, refreshIcons, qs } from './utils.js';

/**
 * Инициализирует глобальные элементы UI: шапку, меню, сайдбар.
 */
function initGlobalUI() {
  qs('#year') && (qs('#year').textContent = new Date().getFullYear());

  // Логика сворачивания сайдбара
  const sidebarToggle = qs('#sidebarToggle');
  sidebarToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    const iconEl = sidebarToggle.querySelector('i[data-lucide]');
    if (iconEl) iconEl.setAttribute('data-lucide', isCollapsed ? 'panel-left-open' : 'panel-left-close');
    refreshIcons();
  });

  // Логика выпадающего меню пользователя
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
}

/**
 * Главная функция инициализации приложения
 */
function initApp() {
  initGlobalUI();
  initRouter();
  initIconsOnce(); // Инициализируем иконки один раз при старте
}

// Запускаем приложение
document.addEventListener('DOMContentLoaded', initApp);