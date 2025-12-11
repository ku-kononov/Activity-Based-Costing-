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

     .metrics-list { display: flex; flex-direction: column; gap: 8px; }
     .metric-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: rgba(255,255,255,0.05); border-radius: 12px; transition: transform 0.2s ease; }
     .metric-row:hover { transform: translateY(-2px); }
     .metric-icon { width: 32px; height: 32px; flex-shrink: 0; }
     .metric-content { flex: 1; }
     .metric-label { font-size: 14px; color: var(--muted); font-weight: 600; margin-bottom: 4px; }
     .metric-value { font-variant-numeric: tabular-nums; font-size: 28px; font-weight: 800; color: var(--blue); }

     .metric-value.management { color: ${GROUP_COLORS.management} !important; }
     .metric-value.core { color: ${GROUP_COLORS.core} !important; }
     .metric-value.enablement { color: ${GROUP_COLORS.enablement} !important; }

     .company-metrics { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
     .company-item { display: flex; align-items: center; gap: 14px; padding: 10px 14px; background: rgba(255,255,255,0.05); border-radius: 12px; transition: transform 0.2s ease; }
     .company-item:hover { transform: translateY(-1px); }
     .company-metric-icon { width: 22px; height: 22px; flex-shrink: 0; color: var(--blue); }
     .company-metric-label { font-size: 15px; color: var(--muted); font-weight: 600; flex: 1; }
     .company-metric-value { font-variant-numeric: tabular-nums; font-size: 20px; font-weight: 800; color: var(--blue); }

     .module-chart-container { display: flex; align-items: center; gap: 16px; height: 120px; }
     .donut-wrapper { position: relative; width: 100px; height: 100px; flex-shrink: 0; }
     .donut-canvas { width: 100%; height: 100%; }

     .chart-legend { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; justify-content: center; }
     .legend-item { display: flex; align-items: center; gap: 10px; font-size: 13px; }
     .legend-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
     .legend-label { font-weight: 600; color: var(--muted); flex: 1; font-size: 14px; }
     .legend-val { font-weight: 800; font-variant-numeric: tabular-nums; font-size: 14px; }

     .module-card .module-header { padding: 16px 18px 4px; border-bottom: none; }
     .module-card .module-title { font-size: 1.1em; margin-bottom: -16px; }
     .module-card { min-height: 180px; }
     .module-card[data-group="ba"] { min-height: 160px; }
     .module-card[data-group="ibp"] { min-height: 200px; }
     .module-card .module-body { padding: 0px 18px; }
     .module-card[data-group="ibp"] .module-body { padding: 14px 18px; }
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
  { key: 'ibp-financial', title: 'Управление финансовыми операциями', icon: 'calculator', color: 'var(--blue)', link: () => navigate('ibp/financial'), text: 'FP&A (Financial Planning & Analysis) - финансовое планирование, бюджетирование, прогнозирование и анализ для поддержки бизнес-решений' },
  { key: 'ibp-operational', title: 'Продажи и операционное планирование', icon: 'trending-up-down', color: 'var(--blue)', link: () => navigate('ibp/operational'), text: 'S&OP (Sales & Operations Planning) - интегрированное планирование продаж и операций для баланса спроса/предложения, оптимизации логистики и запасов' },
  { key: 'ibp-plan-vs-fact', title: 'Анализ плана и факта', icon: 'chart-column-stacked', color: 'var(--blue)', link: () => navigate('ibp/plan-vs-fact'), text: 'Integrated Reconciliation - сопоставление и анализ отклонений финансовых и операционных данных для коррекции консенсус-плана' },
];

function metricId(moduleTitle, label) {
  return `metric-${moduleTitle.toLowerCase().replace(/\s/g, '-')}-${label.toLowerCase().replace(/\s/g, '-')}`;
}

function createChartHTML(module) {
   const { labels, values, colors } = module.chartData;
   const isProcesses = module.key === 'processes';
   const isCosts = module.key === 'costs';
   const header = isProcesses ? '<h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: var(--muted); text-align: center;">Группы процессов</h4>' :
                 isCosts ? '<h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: var(--muted); text-align: center;">Мера включённости в процессы</h4>' : '';
   const unit = isProcesses ? '' : ' FTE';
   const legendHTML = labels.map((label, i) => `
     <div class="legend-item">
       <span class="legend-dot" style="background-color: ${colors[i]}"></span>
       <span class="legend-label">${label}</span>
       <span class="legend-val" style="color: ${colors[i]}">${values[i]}${unit}</span>
     </div>
   `).join('');

   const paddingTop = '';
   return `
     ${header}
     <div class="module-chart-container" style="${paddingTop}">
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
   const isCompany = module.key === 'company';
   if (isCompany) {
     const content = module.metrics.map(m => `
       <div class="company-item">
         ${m.icon ? `<i data-lucide="${m.icon}" class="company-metric-icon" style="color: var(--blue)"></i>` : ''}
         <div class="company-metric-label">${m.label}</div>
         <div class="company-metric-value ${m.className || ''}" id="${metricId(idBase, m.label)}">${m.value}</div>
       </div>
     `).join('');
     return `<div class="company-metrics">${content}</div>`;
   } else {
     const content = module.metrics.map(m => `
       <div class="metric-row">
         ${m.icon ? `<i data-lucide="${m.icon}" class="metric-icon" style="color: var(--blue)"></i>` : ''}
         <div class="metric-content">
           <div class="metric-label">${m.label}</div>
           <div class="metric-value ${m.className || ''}" id="${metricId(idBase, m.label)}">${m.value}</div>
         </div>
       </div>
     `).join('');
     return `<div class="metrics-list">${content}</div>`;
   }
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

     // Create gradients for segments
     const gradients = data.colors.map(color => {
       const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 100);
       gradient.addColorStop(0, color);
       gradient.addColorStop(1, color.replace(')', ', 0.8)').replace('rgb', 'rgba'));
       return gradient;
     });

     const isProcesses = canvasId === 'processes-donut-home';
     const cutout = isProcesses ? '0%' : '50%';

     ctx.chartInstance = new Chart(ctx, {
       type: 'doughnut',
       data: {
         labels: data.labels,
         datasets: [{ data: data.values, backgroundColor: gradients, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', hoverOffset: 6 }]
       },
       options: {
         responsive: true,
         maintainAspectRatio: false,
         cutout: cutout,
         plugins: { legend: { display: false }, tooltip: { enabled: true, backgroundColor: 'rgba(0,0,0,0.9)', titleColor: '#fff', bodyColor: '#fff', cornerRadius: 8, padding: 12 } },
         animation: { animateScale: true, animateRotate: true, duration: 1500, easing: 'easeOutQuart' }
       }
     });
   }
 }

export async function renderHomePage(container) {
  // Меняем заголовок приложения в DOM (если элемент существует)
  const appBrand = document.querySelector('.app-brand span');
  if (appBrand) appBrand.textContent = 'Ризома. Бизнес-архитектура Лада-Имидж';

  ensureHomeStyles();

  let fteData = { labels: ['Основные', 'Управление', 'Обеспечение'], values: [48.2, 5.5, 14.3], colors: [GROUP_COLORS.core, GROUP_COLORS.management, GROUP_COLORS.enablement] };
  try {
    const realFte = await fetchFTEStats();
    if (realFte) fteData = realFte;
  } catch (e) { console.warn(e); }

  const BA_MODULES = [
    { key: 'company', title: 'Компания', icon: 'ship', color: 'var(--blue)', link: () => navigate('org'), metrics: [
        { label: 'Сотрудники', value: '...', icon: 'users' },
        { label: 'АУП', value: '630', icon: 'briefcase' },
        { label: 'Подразделения', value: '...', icon: 'building-2' }
      ] },
    { key: 'processes', title: 'Процессы', icon: 'waypoints', color: 'var(--blue)', link: () => navigate('pcf'), chartId: 'processes-donut-home', chartData: {
        labels: ['Управление', 'Основные', 'Обеспечение'],
        values: [2, 5, 6],
        colors: [GROUP_COLORS.management, GROUP_COLORS.core, GROUP_COLORS.enablement]
      } },
    { key: 'costs', title: 'Затраты процессов', icon: 'chart-pie', color: 'var(--blue)', link: () => navigate('costs'), chartId: 'costs-donut-home', chartData: fteData },
  ];

  container.innerHTML = `
    <div class="home-page">
      <!-- Секция 1: Бизнес-архитектура -->
      <div class="home-section">
        <div class="section-header">
          <div class="section-icon">
            <i data-lucide="orbit"></i>
          </div>
          <div>
            <h2 class="section-title">Бизнес-архитектура</h2>
            <p class="section-subtitle">Управление процессами и организационной структурой</p>
          </div>
        </div>

        <div class="widgets-grid">
          ${BA_MODULES.map((m, i) => createModuleHTML(m, i, 'ba')).join('')}
        </div>
      </div>

      <!-- Секция 2: Интегрированное бизнес-планирование -->
      <div class="home-section">
        <div class="section-header">
          <div class="section-icon">
            <i data-lucide="database"></i>
          </div>
          <div>
            <h2 class="section-title">Интегрированное бизнес планирование</h2>
            <p class="section-subtitle">Финансовые и операционные планы, анализ исполнения</p>
          </div>
        </div>

        <div class="widgets-grid">
          ${IBP_MODULES.map((m, i) => createModuleHTML(m, i, 'ibp')).join('')}
        </div>
      </div>
    </div>
  `;

  if (fteData && fteData.values.some(v => v > 0)) initDonutChart('costs-donut-home', fteData);
  else { const wrap = document.querySelector('#costs-donut-home')?.closest('.module-chart-container'); if (wrap) wrap.parentElement.innerHTML = '<div class="module-placeholder">Нет данных для отображения</div>'; }

  initDonutChart('processes-donut-home', { labels: ['Управление', 'Основные', 'Обеспечение'], values: [2, 5, 6], colors: [GROUP_COLORS.management, GROUP_COLORS.core, GROUP_COLORS.enablement] });

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

    // Статистика больше не нужна
  } catch (err) { console.error(err); }

  refreshIcons();
}