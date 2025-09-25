// js/router.js
import { renderHomePage } from './pages/home.js';
import { renderOrgPage } from './pages/org-structure.js';
import { renderPCFPage } from './pages/pcf-catalog.js';

const appEl = document.getElementById('app-container');

// Карта роутов: какой роут какую функцию рендеринга вызывает.
const routes = {
  'home': renderHomePage,
  'org': renderOrgPage,
  'pcf': renderPCFPage,
  // Добавляйте сюда новые страницы
};

/**
 * "Роутер", который рендерит нужную страницу.
 * @param {string} routeName - Имя роута.
 */
export async function navigate(routeName) {
  if (!appEl) return;
  
  const route = routes[routeName] ? routeName : 'home'; // Fallback на главную
  
  window.location.hash = route === 'home' ? '#/' : `#!/${route}`;
  setActiveNav(route);
  
  appEl.innerHTML = '<p>Загрузка...</p>';
  
  try {
    await routes[route](appEl); // Вызываем асинхронную функцию рендеринга
  } catch (error) {
    console.error(`Ошибка при рендеринге роута "${route}":`, error);
    appEl.innerHTML = `<div class="error-card"><h3>Ошибка</h3><p>${error.message}</p></div>`;
  }
}

/**
 * Обновляет активный пункт в сайдбаре.
 * @param {string} route - Текущий роут.
 */
function setActiveNav(route) {
  document.querySelectorAll('.nav-item').forEach(a => {
    const title = a.title || '';
    const isActive =
      (route === 'home' && /Главная/i.test(title)) ||
      (route === 'org' && /Оргструктура/i.test(title)) ||
      (route === 'pcf' && /PCF-процессы/i.test(title));
    a.classList.toggle('active', isActive);
    a.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

/** Инициализирует роутер при загрузке страницы. */
export function initRouter() {
  document.querySelector('.nav')?.addEventListener('click', (e) => {
    const link = e.target.closest('.nav-item');
    if (link) {
      e.preventDefault();
      const title = link.title || '';
      let route = 'home';
      if (/Оргструктура/i.test(title)) route = 'org';
      if (/PCF-процессы/i.test(title)) route = 'pcf';
      navigate(route);
    }
  });

  const currentRoute = window.location.hash.startsWith('#!/')
    ? window.location.hash.substring(3)
    : 'home';
  navigate(currentRoute);
}