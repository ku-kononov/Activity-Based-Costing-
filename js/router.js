// js/router.js
import { renderHomePage } from './pages/home.js';
import { renderOrgPage } from './pages/org-structure.js';
import { renderPCFPage } from './pages/pcf-catalog.js';
import { qs, refreshIcons } from './utils.js';

const appEl = qs('#app-container');

const jsRoutes = {
  home: renderHomePage,
  org: renderOrgPage,
  pcf: renderPCFPage,
};

const htmlRoutes = ['profile', 'pnl-methodology']; // добавили страницу методологии

function setActiveNav(route) {
  const nav = qs('#main-nav');
  if (!nav) return;

  nav.querySelectorAll('a.nav-link:not(.nav-group-link)').forEach(a => {
    const isActive = a.dataset.route === route;
    a.classList.toggle('active', isActive);
    a.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  nav.querySelectorAll('.nav-group').forEach(group => {
    const submenu = group.querySelector('.nav-submenu');
    const chevron = group.querySelector('.nav-chevron');

    const hasActiveChild = submenu?.querySelector(`a.nav-link[data-route="${route}"]`);
    const shouldOpen = !!hasActiveChild;

    group.classList.toggle('is-open', shouldOpen);
    chevron?.setAttribute('aria-expanded', String(shouldOpen));

    if (submenu) {
      submenu.setAttribute('aria-hidden', String(!shouldOpen));
      if (shouldOpen) {
        submenu.style.transition = '';
        submenu.style.maxHeight = 'none';
        submenu.style.opacity = '1';
        submenu.style.overflow = 'visible';
      } else {
        submenu.style.transition = '';
        submenu.style.maxHeight = '0px';
        submenu.style.opacity = '0';
        submenu.style.overflow = 'hidden';
      }
    }
  });
}

async function loadHtmlPage(pageName) {
  const response = await fetch(`${pageName}.html`);
  if (!response.ok) throw new Error(`HTML-страница ${pageName}.html не найдена.`);
  appEl.innerHTML = await response.text();

  appEl.querySelectorAll('script').forEach(oldScript => {
    const s = document.createElement('script');
    Array.from(oldScript.attributes).forEach(attr => s.setAttribute(attr.name, attr.value));
    s.appendChild(document.createTextNode(oldScript.innerHTML));
    oldScript.parentNode.replaceChild(s, oldScript);
  });
  refreshIcons();
}

async function navigate(routeName) {
  if (!appEl) return;

  let route = (routeName || 'home');
  const baseRoute = route.split('/')[0];

  if (baseRoute === 'ibp' && route === 'ibp') {
    route = 'ibp/financial';
  }

  if (window.location.hash !== `#!/${route}`) {
    window.location.hash = `#!/${route}`;
  }

  appEl.innerHTML = '<div class="card"><div class="card-header"><h3 class="card-title">Загрузка…</h3></div><div style="padding:8px;">Пожалуйста, подождите.</div></div>';

  try {
    if (baseRoute === 'analytics') {
      setActiveNav(route);
      const mod = await import('./pages/analytics.js');
      await mod.renderAnalyticsPage(appEl);
      refreshIcons();
      return;
    }

    if (baseRoute === 'ibp') {
      const sub = route.split('/')[1] || 'financial';
      setActiveNav(`ibp/${sub}`);
      const mod = await import('./pages/ibp.js');
      await mod.renderIBPPage(appEl, sub);
      refreshIcons();
      return;
    }

    if (baseRoute === 'costs') {
      setActiveNav('costs');
      const mod = await import('./pages/costs.js');
      await mod.renderCostsPage(appEl);
      refreshIcons();
      return;
    }

    if (jsRoutes[baseRoute]) {
      setActiveNav(baseRoute);
      await jsRoutes[baseRoute](appEl);
      refreshIcons();
      return;
    }

    if (htmlRoutes.includes(baseRoute)) {
      setActiveNav(route);
      await loadHtmlPage(baseRoute);
      refreshIcons();
      return;
    }

    setActiveNav('home');
    await renderHomePage(appEl);
    refreshIcons();
  } catch (e) {
    console.error(`Ошибка навигации на /${route}:`, e);
    appEl.innerHTML = `<div class="card" style="border-color:var(--danger);">
      <h3 style="color:var(--danger);">Ошибка</h3>
      <p>${e.message}</p>
      <pre style="white-space:pre-wrap;font-size:12px;opacity:0.7;">${e.stack || ''}</pre>
    </div>`;
    refreshIcons();
  }
}

window.navigate = (routeName) => navigate(routeName.replace(/^\//, ''));

export function initRouter() {
  const navMenu = qs('#main-nav') || qs('.nav');

  navMenu?.addEventListener('click', (e) => {
    const link = e.target.closest('a.nav-link');
    if (!link) return;
    e.preventDefault();
    const route = link.dataset.route || 'home';
    navigate(route);
  });

  const handleHashChange = () => {
    const route = window.location.hash.startsWith('#!/') ? window.location.hash.substring(3) : 'home';
    navigate(route);
  };

  window.addEventListener('hashchange', handleHashChange);
  handleHashChange();
}