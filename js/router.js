// js/router.js
import { renderHomePage } from './pages/home.js';
import { renderOrgPage } from './pages/org-structure.js';
import { renderPCFPage } from './pages/pcf-catalog.js';
import { qs } from './utils.js';

const appEl = qs('#app-container');

const routes = { home: renderHomePage, org: renderOrgPage, pcf: renderPCFPage };

function setActiveNav(route) {
  document.querySelectorAll('.nav-item').forEach(a => {
    const t = a.textContent || '';
    const isActive = (route==='home' && /Главная/i.test(t)) ||
                     (route==='org' && /\s*Оргструктура\s*/i.test(t)) ||
                     (route==='pcf' && /\s*Бизнес-функции\s*/i.test(t));
    a.classList.toggle('active', isActive);
    a.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}

export async function navigate(routeName) {
  if (!appEl) return;
  const segments = (routeName || '').split('/');
  const base = routes[segments[0]] ? segments[0] : 'home';
  const params = segments.slice(1);
  window.location.hash = base === 'home' && params.length===0 ? '#/' : `#!/${[base,...params].join('/')}`;
  setActiveNav(base);
  appEl.innerHTML = '<div class="data-card"><div class="card-header"><h3 class="card-title">Загрузка…</h3></div></div>';
  try {
    await routes[base](appEl, params);
  } catch (e) {
    appEl.innerHTML = `<div class="data-card" style="border-color:#DC3545;"><div class="card-header"><h3 class="card-title">Ошибка</h3></div><div style="padding:8px;">${e.message||e}</div></div>`;
  }
}

export function initRouter() {
  document.querySelector('.nav')?.addEventListener('click', (e) => {
    const link = e.target.closest('.nav-item'); if (!link) return;
    e.preventDefault();
    const t = link.textContent || '';
    if (/\s*Оргструктура\s*/i.test(t)) return navigate('org');
    if (/\s*Бизнес-функции\s*/i.test(t)) return navigate('pcf');
    return navigate('home');
  });

  const compute = () => window.location.hash.startsWith('#!/') ? window.location.hash.substring(3) : (window.location.hash==='#/' ? 'home' : 'home');
  navigate(compute());
  window.addEventListener('hashchange', () => navigate(compute()));
}



