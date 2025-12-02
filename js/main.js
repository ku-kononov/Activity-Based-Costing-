// js/main.js
import { initRouter } from './router.js';
import { initIconsOnce, refreshIcons, qs } from './utils.js';
import { initAppearance, toggleAppearance, getAppearance } from './theme.js';
import { supabase } from './api.js';

function injectAppearanceToggle() {
  const sidebar = qs('.sidebar');
  if (!sidebar || qs('#appearanceToggle')) return;

  const btn = document.createElement('button');
  btn.id = 'appearanceToggle';
  btn.className = 'appearance-toggle';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Переключить тему');
  btn.title = 'Переключить тему';
  btn.innerHTML = `<i data-lucide="sun"></i>`;

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

function animateSubmenu(submenu, open) {
  const currentHeight = submenu.scrollHeight;
  submenu.style.overflow = 'hidden';

  if (open) {
    submenu.style.display = 'flex';
    submenu.style.transition = 'none';
    submenu.style.maxHeight = '0px';
    submenu.style.opacity = '0';
    requestAnimationFrame(() => {
      const target = submenu.scrollHeight || currentHeight;
      submenu.style.transition = 'max-height 240ms ease, opacity 180ms ease';
      submenu.style.maxHeight = `${target}px`;
      submenu.style.opacity = '1';
    });
  } else {
    const start = submenu.scrollHeight || currentHeight;
    submenu.style.transition = 'none';
    submenu.style.maxHeight = `${start}px`;
    submenu.style.opacity = '1';
    requestAnimationFrame(() => {
      submenu.style.transition = 'max-height 240ms ease, opacity 180ms ease';
      submenu.style.maxHeight = '0px';
      submenu.style.opacity = '0';
    });
  }

  const onEnd = (e) => {
    if (e.propertyName !== 'max-height') return;
    submenu.style.transition = '';
    if (open) {
      submenu.style.maxHeight = 'none';
      submenu.style.overflow = 'visible';
    } else {
      submenu.style.maxHeight = '0px';
      submenu.style.overflow = 'hidden';
    }
    submenu.removeEventListener('transitionend', onEnd);
  };
  submenu.addEventListener('transitionend', onEnd);
}

function initNavAccordion() {
  const nav = qs('#main-nav');
  if (!nav) return;

  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-chevron');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const controls = btn.getAttribute('aria-controls');
    const submenu = controls ? qs(`#${controls}`) : null;
    const group = btn.closest('.nav-group');
    const isExpanded = btn.getAttribute('aria-expanded') === 'true';
    const nextState = !isExpanded;

    btn.setAttribute('aria-expanded', String(nextState));
    group?.classList.toggle('is-open', nextState);

    if (submenu) {
      submenu.setAttribute('aria-hidden', String(!nextState));
      animateSubmenu(submenu, nextState);
    }

    refreshIcons();
  });
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

/* ================== Header avatar (user-area) ================== */
function renderHeaderAvatar(url) {
  const btn = qs('#userMenuButton');
  if (!btn) return;
  // remove previous img if any
  const oldImg = btn.querySelector('img.avatar-img');
  if (oldImg) oldImg.remove();
  // ensure we have icon or img
  const icon = btn.querySelector('.avatar-icon');
  if (url) {
    // show image, remove icon
    if (icon) icon.remove();
    const img = document.createElement('img');
    img.className = 'avatar-img';
    img.alt = 'avatar';
    img.src = url;
    // inline size (не нужна правка CSS)
    img.style.width = '24px';
    img.style.height = '24px';
    img.style.borderRadius = '50%';
    img.style.objectFit = 'cover';
    img.style.display = 'block';
    btn.insertBefore(img, btn.firstChild);
  } else {
    // ensure default icon "user" вместо scan-face
    if (icon) {
      icon.setAttribute('data-lucide', 'user');
    } else {
      const i = document.createElement('i');
      i.setAttribute('data-lucide', 'user');
      i.className = 'avatar-icon';
      btn.insertBefore(i, btn.firstChild);
    }
  }
  refreshIcons();
}

async function refreshHeaderAvatar() {
  try {
    if (!supabase) { renderHeaderAvatar(null); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { renderHeaderAvatar(null); return; }
    const { data, error } = await supabase.from('profiles').select('avatar_url').eq('user_id', user.id).maybeSingle?.()
      || await supabase.from('profiles').select('avatar_url').eq('user_id', user.id).single();
    if (error) { renderHeaderAvatar(null); return; }
    const url = data?.avatar_url || null;
    renderHeaderAvatar(url);
  } catch {
    renderHeaderAvatar(null);
  }
}

function initHeaderAvatar() {
  refreshHeaderAvatar(); // initial
  if (supabase?.auth) {
    try {
      supabase.auth.onAuthStateChange((_event, _session) => {
        refreshHeaderAvatar();
      });
    } catch {}
  }
  // listen avatar updates from profile page
  document.addEventListener('profile:avatar-updated', (e) => {
    const url = e.detail?.url || null;
    renderHeaderAvatar(url);
  });
}

function initApp() {
  initAppearance();
  initGlobalUI();
  initRouter();
  initIconsOnce();
  initHeaderAvatar();
}

document.addEventListener('DOMContentLoaded', initApp);