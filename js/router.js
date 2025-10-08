// js/router.js
import { renderHomePage } from './pages/home.js';
import { renderOrgPage } from './pages/org-structure.js';
import { renderPCFPage } from './pages/pcf-catalog.js';
import { qs, refreshIcons } from './utils.js';

const appEl = qs('#app-container');

// Карта маршрутов для JS-модулей (без analytics — подключим динамически)
const jsRoutes = {
  'home': renderHomePage,
  'org': renderOrgPage,
  'pcf': renderPCFPage,
};

// Список маршрутов для простых HTML-страниц
const htmlRoutes = ['profile'];

function setActiveNav(route) {
  qs('.nav')?.querySelectorAll('.nav-item').forEach(a => {
    const text = a.textContent || '';
    const isActive =
      (route === 'home'      && /Главная/i.test(text)) ||
      (route === 'org'       && /Оргструктура/i.test(text)) ||
      (route === 'pcf'       && /Бизнес-функции/i.test(text)) ||
      (route === 'analytics' && /Аналитика/i.test(text));  // добавили подсветку "Аналитика"
    a.classList.toggle('active', isActive);
    a.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

async function loadHtmlPage(pageName) {
  try {
    const response = await fetch(`${pageName}.html`);
    if (!response.ok) throw new Error(`HTML-страница ${pageName}.html не найдена.`);
    
    appEl.innerHTML = await response.text();
    
    appEl.querySelectorAll('script').forEach(oldScript => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
      newScript.appendChild(document.createTextNode(oldScript.innerHTML));
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
    refreshIcons();
  } catch (e) {
    throw e;
  }
}

async function navigate(routeName) {
  if (!appEl) return;
  
  const baseRoute = (routeName || 'home').split('/')[0];
  window.location.hash = `#!/${routeName}`;
  appEl.innerHTML = '<div class="card"><div class="card-header"><h3 class="card-title">Загрузка…</h3></div><div style="padding:8px;">Пожалуйста, подождите.</div></div>';
  
  try {
    // Отдельно обрабатываем "Аналитика" через динамический импорт (не ломает остальное при ошибке)
    if (baseRoute === 'analytics') {
      setActiveNav('analytics');
      const mod = await import('./pages/analytics.js');
      await mod.renderAnalyticsPage(appEl);
      refreshIcons();
      return;
    }

    if (jsRoutes[baseRoute]) {
      setActiveNav(baseRoute);
      await jsRoutes[baseRoute](appEl);
      refreshIcons();
    } else if (htmlRoutes.includes(baseRoute)) {
      setActiveNav(''); // Снимаем активность с основного меню для профиля
      await loadHtmlPage(baseRoute);
      refreshIcons();
    } else {
      setActiveNav('home');
      await renderHomePage(appEl);
      refreshIcons();
    }
  } catch (e) {
    console.error(`Ошибка навигации на /${routeName}:`, e);
    appEl.innerHTML = `<div class="card" style="border-color:var(--danger);"><h3 style="color:var(--danger);">Ошибка</h3><p>${e.message}</p><pre style="white-space:pre-wrap;font-size:12px;opacity:0.7;">${e.stack || ''}</pre></div>`;
    refreshIcons();
  }
}

window.navigate = (routeName) => navigate(routeName.replace(/^\//, ''));

export function initRouter() {
  qs('.nav')?.addEventListener('click', (e) => {
    const link = e.target.closest('.nav-item');
    if (!link) return;
    e.preventDefault();
    const text = link.textContent || '';
    if (/Оргструктура/i.test(text)) return navigate('org');
    if (/Бизнес-функции/i.test(text)) return navigate('pcf');
    if (/Аналитика/i.test(text)) return navigate('analytics');  // добавили переход на аналитику
    navigate('home');
  });

  const handleHashChange = () => {
    const route = window.location.hash.startsWith('#!/') ? window.location.hash.substring(3) : 'home';
    navigate(route);
  };
  
  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
}