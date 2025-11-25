// js/pages/home.js
import { fetchOrgStats, fetchData } from '../api.js';
import { refreshIcons } from '../utils.js';

const GROUP_COLORS = { core: '#60a5fa', management: '#fbbf24', enablement: '#34d399' };

let __homeStylesInjected = false;
function ensureHomeStyles() {
  if (__homeStylesInjected) return;
  const css = `
    .home-block-title { color: var(--blue) !important; margin: 0 0 6px 0 !important; }
    .home-block-title .home-block-icon { color: var(--blue) !important; }
    .home-block-subtitle { color: var(--muted) !important; margin: 2px 0 12px 42px !important; font-weight: 600; font-size: 13px; letter-spacing: .2px; }
    
    .metrics-list { display: flex; flex-direction: column; gap: 4px; }
    .metric-row { display: grid; grid-template-columns: 1fr auto; align-items: baseline; gap: 12px; padding: 6px 0; border-bottom: 1px dashed var(--divider); }
    .metric-row:last-child { border-bottom: none; }
    .metric-label { font-size: 12px; text-transform: uppercase; letter-spacing: .3px; color: var(--muted); font-weight: 700; }
    .metric-value { font-variant-numeric: tabular-nums; font-size: 22px; font-weight: 800; color: var(--blue); }
    
    .metric-value.management { color: ${GROUP_COLORS.management} !important; }
    .metric-value.core { color: ${GROUP_COLORS.core} !important; }
    .metric-value.enablement { color: ${GROUP_COLORS.enablement} !important; }

    .module-chart-container { display: flex; align-items: center; gap: 12px; height: 110px; }
    .donut-wrapper { position: relative; width: 90px; height: 90px; flex-shrink: 0; }
    .donut-canvas { width: 100%; height: 100%; }
    
    .chart-legend { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; justify-content: center; }
    .legend-item { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; font-size: 12px; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .legend-label { font-weight: 600; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
    .legend-val { font-weight: 800; font-variant-numeric: tabular-nums; font-size: 14px; white-space: nowrap; }

    .module-card .module-header { padding: 16px 18px; }
    .module-card .module-title { font-size: 1.1em; }
    .module-card .module-body { padding: 14px 18px; }
    .module-body .module-text { margin: 0; color: var(--muted); font-weight: 600; font-size: 13px; }
  `;
  const s = document.createElement('style');
  s.id = 'home-local-styles';
  s.textContent = css;
  document.head.appendChild(s);
  
  if (!document.getElementById('chart-js')) {
    const script = document.createElement('script');
    script.id = 'chart-js';
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    document.head.appendChild(script);
  }
  __homeStylesInjected = true;
}

function toNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? '0').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function getGroupKey(pcfCode) {
  const major = parseInt(String(pcfCode || '').split('.')[0], 10) || 0;
  if ([1, 13].includes(major)) return 'management';
  if ([2, 3, 4, 5, 6].includes(major)) return 'core';
  return 'enablement';
}

async function fetchFTEStats() {
  try {
    const [costData, pcfData] = await Promise.all([
      fetchData('BOLT_Cost Driver_pcf+orgchat', '*'),
      fetchData('BOLT_pcf', '"Process ID", "PCF Code"')
    ]);

    if (!costData || !pcfData) return null;

    const processes = {};
    pcfData.forEach(p => {
      const pid = p['Process ID'];
      if (pid) processes[pid] = { group: getGroupKey(p['PCF Code']) };
    });

    const groups = { core: 0, management: 0, enablement: 0 };

    costData.forEach(row => {
      const pid = row['Process ID'];
      const proc = processes[pid];
      if (!proc) return;

      let rowFTE = 0;
      Object.keys(row).forEach(key => {
        if (key.startsWith('ORG-')) {
          const val = toNum(row[key]);
          if (val > 0 && val < 1000) {
            rowFTE += val;
          }
        }
      });
      
      if (groups[proc.group] !== undefined) {
        groups[proc.group] += rowFTE;
      }
    });

    return {
      labels: ['Основные', 'Управление', 'Обеспечение'],
      values: [
        Number(groups.core.toFixed(1)), 
        Number(groups.management.toFixed(1)), 
        Number(groups.enablement.toFixed(1))
      ],
      colors: [GROUP_COLORS.core, GROUP_COLORS.management, GROUP_COLORS.enablement]
    };

  } catch (e) {
    console.error('Error calculating FTE stats:', e);
    return null;
  }
}

const IBP_MODULES = [
  { key: 'ibp-financial', title: 'Управление финансовыми операциями', icon: 'calculator', color: 'var(--blue)', link: () => navigate('ibp/financial'), text: 'FP&A (Financial Planning & Analysis)' },
  { key: 'ibp-operational', title: 'Продажи и операционное планирование', icon: 'trending-up-down', color: 'var(--blue)', link: () => navigate('ibp/operational'), text: 'S&OP (Sales & Operations Planning)' },
  { key: 'ibp-plan-vs-fact', title: 'Анализ плана и факта', icon: 'chart-column-stacked', color: 'var(--blue)', link: () => navigate('ibp/plan-vs-fact'), text: 'Integrated Reconciliation' },
];

function metricId(moduleTitle, label) {
  return `metric-${moduleTitle.toLowerCase().replace(/\s/g, '-')}-${label.toLowerCase().replace(/\s/g, '-')}`;
}

function createChartHTML(module) {
  const { labels, values, colors } = module.chartData;
  const legendHTML = labels.map((label, i) => `
    <div class="legend-item">
      <span class="legend-dot" style="background-color: ${colors[i]}"></span>
      <span class="legend-label">${label}</span>
      <span class="legend-val" style="color: ${colors[i]}">${values[i]} FTE</span>
    </div>
  `).join('');

  return `
    <div class="module-chart-container">
      <div class="donut-wrapper">
        <canvas id="${module.chartId}" class="donut-canvas"></canvas>
      </div>
      <div class="chart-legend">${legendHTML}</div>
    </div>
  `;
}

function createMetricsHTML(module) {
  if (module.chartId && module.chartData) return createChartHTML(module);
  if (!module.metrics?.length) return module.text ? `<p class="module-text">${module.text}</p>` : '<div class="module-placeholder">Скоро здесь появятся данные</div>';
  const idBase = module.title;
  return `
    <div class="metrics-list">
      ${module.metrics.map(m => `
        <div class="metric-row">
          <div class="metric-label">${m.label}</div>
          <div class="metric-value ${m.className || ''}" id="${metricId(idBase, m.label)}">${m.value}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function createModuleHTML(module, index, groupKey) {
  return `
    <div class="module-card" style="--module-color:${module.color};" role="button" tabindex="0" data-group="${groupKey}" data-index="${index}" aria-label="${module.title}">
      <div class="module-header">
        <i data-lucide="${module.icon}" class="module-icon"></i>
        <h3 class="module-title" style="color:${module.color};">${module.title}</h3>
      </div>
      <div class="module-body">${createMetricsHTML(module)}</div>
    </div>
  `;
}

function createBlockHTML({ title, subtitle, icon, modules, color = 'var(--blue)', groupKey }) {
  return `
    <section class="home-block">
      <h2 class="home-block-title" style="color:${color};"><i data-lucide="${icon}" class="home-block-icon" style="color:${color};"></i><span>${title}</span></h2>
      <div class="home-block-subtitle">${subtitle}</div>
      <div class="widgets-grid">
        ${modules.map((m, i) => createModuleHTML(m, i, groupKey)).join('')}
      </div>
    </section>
  `;
}

function initDonutChart(canvasId, data) {
  const checkChart = setInterval(() => {
    if (window.Chart) {
      clearInterval(checkChart);
      renderChart();
    }
  }, 100);
  setTimeout(() => clearInterval(checkChart), 5000);

  function renderChart() {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (ctx.chartInstance) ctx.chartInstance.destroy();
    ctx.chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.labels,
        datasets: [{ data: data.values, backgroundColor: data.colors, borderWidth: 0, hoverOffset: 4 }]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        cutout: '70%', 
        plugins: { legend: { display: false }, tooltip: { enabled: false } }, 
        animation: { animateScale: true, animateRotate: true } 
      }
    });
  }
}

export async function renderHomePage(container) {
  // Меняем заголовок приложения в DOM (если элемент существует)
  const appBrand = document.querySelector('.app-brand span');
  if (appBrand) appBrand.textContent = 'Ризома. Бизнес-архитектура Лада-Имидж';

  ensureHomeStyles();

  let fteData = { labels: ['Основные', 'Управление', 'Обеспечение'], values: [0, 0, 0], colors: [GROUP_COLORS.core, GROUP_COLORS.management, GROUP_COLORS.enablement] };
  try {
    const realFte = await fetchFTEStats();
    if (realFte) fteData = realFte;
  } catch (e) { console.warn(e); }

  const BA_MODULES = [
    { key: 'company', title: 'Компания', icon: 'ship', color: 'var(--blue)', link: () => navigate('org'), metrics: [{ label: 'Сотрудники', value: '...' }, { label: 'Подразделения', value: '...' }] },
    { key: 'processes', title: 'Процессы', icon: 'waypoints', color: 'var(--blue)', link: () => navigate('pcf'), metrics: [
        { label: 'Управление', value: '2', className: 'management' }, 
        { label: 'Основные', value: '5', className: 'core' }, 
        { label: 'Обеспечение', value: '6', className: 'enablement' }
      ] 
    },
    { key: 'costs', title: 'Затраты процессов', icon: 'chart-pie', color: 'var(--blue)', link: () => navigate('costs'), chartId: 'costs-donut-home', chartData: fteData },
  ];

  container.innerHTML = `
    <div class="home-page">
      ${createBlockHTML({ title: 'Бизнес-архитектура', subtitle: 'Enterprise architecture framework', icon: 'orbit', modules: BA_MODULES, color: 'var(--blue)', groupKey: 'ba' })}
      ${createBlockHTML({ title: 'Интегрированное бизнес планирование', subtitle: 'Integrated Business Planning (IBP)', icon: 'database', modules: IBP_MODULES, color: 'var(--blue)', groupKey: 'ibp' })}
    </div>
  `;

  if (fteData && fteData.values.some(v => v > 0)) initDonutChart('costs-donut-home', fteData);
  else { const wrap = document.querySelector('#costs-donut-home')?.closest('.module-chart-container'); if (wrap) wrap.parentElement.innerHTML = '<div class="module-placeholder">Нет данных для отображения</div>'; }

  container.querySelectorAll('.module-card').forEach((card) => {
    const group = card.getAttribute('data-group');
    const idx = Number(card.getAttribute('data-index'));
    const mod = group === 'ba' ? BA_MODULES[idx] : IBP_MODULES[idx];
    if (!mod || typeof mod.link !== 'function') return;
    card.addEventListener('click', mod.link);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); mod.link(); } });
  });

  try {
    const stats = await fetchOrgStats();
    const employees = Number(stats?.total_employees) || 0;
    const departments = Number(stats?.total_departments) || 0;
    const employeesEl = container.querySelector('#' + metricId('Компания', 'Сотрудники'));
    const departmentsEl = container.querySelector('#' + metricId('Компания', 'Подразделения'));
    if (employeesEl) employeesEl.textContent = new Intl.NumberFormat('ru-RU').format(employees);
    if (departmentsEl) departmentsEl.textContent = new Intl.NumberFormat('ru-RU').format(departments);
  } catch (err) { console.error(err); }

  refreshIcons();
}