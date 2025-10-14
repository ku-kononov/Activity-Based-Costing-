// js/pages/home.js
import { fetchOrgStats } from '../api.js';
import { refreshIcons } from '../utils.js';

// ——— Локальные стили для главной (инжектим один раз) ———
let __homeStylesInjected = false;
function ensureHomeStyles() {
  if (__homeStylesInjected) return;
  const css = `
    /* Блоки заголовков и подзаголовков */
    .home-block-title { color: var(--blue) !important; margin: 0 0 6px 0 !important; }
    .home-block-title .home-block-icon { color: var(--blue) !important; }
    .home-block-subtitle {
      color: var(--muted) !important;
      margin: 2px 0 12px 42px !important; /* ближе к заголовку, компактнее снизу */
      font-weight: 600; font-size: 13px; letter-spacing: .2px;
    }

    /* Современная верстка метрик внутри карточек модулей */
    .metrics-list {
      display: flex; flex-direction: column; gap: 4px;
    }
    .metric-row {
      display: grid; grid-template-columns: 1fr auto;
      align-items: baseline; gap: 12px;
      padding: 6px 0;
      border-bottom: 1px dashed var(--divider);
    }
    .metric-row:last-child { border-bottom: none; }
    .metric-label {
      font-size: 12px; text-transform: uppercase; letter-spacing: .3px;
      color: var(--muted); font-weight: 700;
    }
    .metric-value {
      font-variant-numeric: tabular-nums; font-size: 22px; font-weight: 800;
      color: var(--blue);
    }

    /* Небольшая полировка карточек для лучшей читаемости */
    .module-card .module-header { padding: 16px 18px; }
    .module-card .module-title { font-size: 1.1em; }
    .module-card .module-body { padding: 16px 18px; }

    /* Текст-плейсхолдер внутри модуля (например, для "Затраты процессов") */
    .module-body .module-text {
      margin: 0; color: var(--muted); font-weight: 600;
    }
  `;
  const s = document.createElement('style');
  s.id = 'home-local-styles';
  s.textContent = css;
  document.head.appendChild(s);
  __homeStylesInjected = true;
}

// ——— Конфигурация модулей (два блока, один под другим) ———

// Блок 1: Бизнес-архитектура (Business Framework)
const BA_MODULES = [
  {
    key: 'company',
    title: 'Компания',
    icon: 'ship',
    color: 'var(--blue)',
    link: () => navigate('org'),
    metrics: [
      { label: 'Сотрудники', value: '...' },
      { label: 'Подразделения', value: '...' },
    ],
  },
  {
    key: 'processes',
    title: 'Процессы',
    icon: 'waypoints',
    color: 'var(--blue)',
    link: () => navigate('pcf'),
    metrics: [
      { label: 'Управление', value: '2', className: 'management' },
      { label: 'Основные', value: '5', className: 'core' },
      { label: 'Обеспечение', value: '6', className: 'enablement' },
    ],
  },
  {
    key: 'costs',
    title: 'Затраты процессов',
    icon: 'chart-pie',
    color: 'var(--blue)',
    link: () => navigate('costs'),
    text: 'Модуль в разработке. Скоро здесь появятся данные',
  },
];

// Блок 2: Интегрированное бизнес‑планирование (IBP)
const IBP_MODULES = [
  {
    key: 'ibp-financial',
    title: 'Управление финансовыми операциями',
    icon: 'calculator',
    color: 'var(--blue)',
    link: () => navigate('ibp/financial'),
    text: 'FP&A (Financial Planning & Analysis)',
  },
  {
    key: 'ibp-operational',
    title: 'Продажи и операционное планирование',
    icon: 'trending-up-down',
    color: 'var(--blue)',
    link: () => navigate('ibp/operational'),
    text: 'S&OP (Sales & Operations Planning)',
  },
  {
    key: 'ibp-plan-vs-fact',
    title: 'Анализ плана и факта',
    icon: 'chart-column-stacked',
    color: 'var(--blue)',
    link: () => navigate('ibp/plan-vs-fact'),
    text: 'Integrated Reconciliation',
  },
];

// ——— Вспомогательные генераторы HTML ———
function metricId(moduleTitle, label) {
  return `metric-${moduleTitle.toLowerCase().replace(/\s/g, '-')}-${label.toLowerCase().replace(/\s/g, '-')}`;
}

function createMetricsHTML(module) {
  if (!module.metrics?.length) {
    // Пусто — вернем плейсхолдер или текст, если есть
    return module.text
      ? `<p class="module-text">${module.text}</p>`
      : '<div class="module-placeholder">Скоро здесь появятся данные</div>';
  }

  const idBase = module.title;
  return `
    <div class="metrics-list">
      ${module.metrics.map(m => `
        <div class="metric-row ${m.className || ''}">
          <div class="metric-label">${m.label}</div>
          <div class="metric-value" id="${metricId(idBase, m.label)}">${m.value}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function createModuleHTML(module, index, groupKey) {
  return `
    <div class="module-card" style="--module-color:${module.color};" role="button" tabindex="0"
         data-group="${groupKey}" data-index="${index}" aria-label="${module.title}">
      <div class="module-header">
        <i data-lucide="${module.icon}" class="module-icon"></i>
        <h3 class="module-title" style="color:${module.color};">${module.title}</h3>
      </div>
      <div class="module-body">
        ${module.text && !module.metrics?.length ? `<p class="module-text">${module.text}</p>` : createMetricsHTML(module)}
      </div>
    </div>
  `;
}

function createBlockHTML({ title, subtitle, icon, modules, color = 'var(--blue)', groupKey }) {
  return `
    <section class="home-block">
      <h2 class="home-block-title" style="color:${color};">
        <i data-lucide="${icon}" class="home-block-icon" style="color:${color};"></i>
        <span>${title}</span>
      </h2>
      <div class="home-block-subtitle">${subtitle}</div>
      <div class="widgets-grid">
        ${modules.map((m, i) => createModuleHTML(m, i, groupKey)).join('')}
      </div>
    </section>
  `;
}

// ——— Главная функция рендеринга ———
export async function renderHomePage(container) {
  ensureHomeStyles();

  // Каркас страницы (два блока один под другим)
  container.innerHTML = `
    <div class="home-page">
      ${createBlockHTML({
        title: 'Бизнес-архитектура',
        subtitle: 'Business Framework',
        icon: 'orbit',
        modules: BA_MODULES,
        color: 'var(--blue)',
        groupKey: 'ba',
      })}
      ${createBlockHTML({
        title: 'Интегрированное бизнес планирование',
        subtitle: 'Integrated Business Planning (IBP)',
        icon: 'database',
        modules: IBP_MODULES,
        color: 'var(--blue)',
        groupKey: 'ibp',
      })}
    </div>
  `;

  // Навешиваем обработчики кликов и клавиатуры
  container.querySelectorAll('.module-card').forEach((card) => {
    const group = card.getAttribute('data-group');
    const idx = Number(card.getAttribute('data-index'));
    const mod = group === 'ba' ? BA_MODULES[idx] : IBP_MODULES[idx];
    if (!mod || typeof mod.link !== 'function') return;

    card.addEventListener('click', mod.link);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        mod.link();
      }
    });
  });

  // Подтягиваем живые цифры по «Компания» из Supabase (BOLT_orgchat)
  try {
    const stats = await fetchOrgStats();
    const employees = Number(stats?.total_employees) || 0;
    const departments = Number(stats?.total_departments) || 0;

    const employeesEl = container.querySelector('#' + metricId('Компания', 'Сотрудники'));
    const departmentsEl = container.querySelector('#' + metricId('Компания', 'Подразделения'));

    if (employeesEl) employeesEl.textContent = new Intl.NumberFormat('ru-RU').format(employees);
    if (departmentsEl) departmentsEl.textContent = new Intl.NumberFormat('ru-RU').format(departments);
  } catch (err) {
    console.error('Ошибка загрузки статистики компании:', err);
    const body =
      container.querySelector('#' + metricId('Компания', 'Сотрудники'))?.closest('.module-body') ||
      container.querySelector('#' + metricId('Компания', 'Подразделения'))?.closest('.module-body');
    if (body) body.innerHTML = '<div class="module-placeholder error">Ошибка загрузки данных</div>';
  }

  // Отрисовка иконок
  refreshIcons();
}