// js/pages/analytics.js
import { refreshIcons } from '../utils.js';

// --- ДАННЫЕ-ЗАГЛУШКИ ---
const mockData = {
  kpi: {
    netProfit: { value: 1.2, unit: 'млн ₽', trend: 5.2, vs: 'vs План' },
    netMargin: { value: 15.8, unit: '%', trend: 1.2, vs: 'vs ПП' },
    revenue: { value: 7.6, unit: 'млн ₽', trend: -2.1, vs: 'vs ПП' },
    ebitda: { value: 1.7, unit: 'млн ₽', trend: 3.5, vs: 'vs План' }
  },
  charts: {
    profitabilityTrend: {
      labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'],
      datasets: [ { label: 'Валовая', data: [70, 72, 71, 73, 72.5, 72.3], tension: 0.4, borderWidth: 2 }, { label: 'Операционная', data: [22, 24, 23, 25, 26, 25.1], tension: 0.4, borderWidth: 2 }, { label: 'Чистая', data: [14, 15, 14.5, 16, 17, 15.8], tension: 0.4, borderWidth: 2 }, ]
    },
    opexStructure: { labels: ['Коммерческие', 'Административные', 'Логистика', 'Прочие'], datasets: [{ data: [45, 25, 18, 12] }] },
    waterfall: { start: 1.1, bars: [ { label: 'Рост выручки', value: 0.4 }, { label: 'Рост себестоимости', value: -0.2 }, { label: 'Рост комм. расходов', value: -0.15 }, { label: 'Снижение админ. расходов', value: 0.05 }, ], end: 1.2 }
  }
};

// --- HTML-ШАБЛОНЫ ---
function createHeaderHTML() {
  return `
    <header class="analytics-header">
      <div class="analytics-header__title-block">
        <i data-lucide="bar-chart-big" class="analytics-header__icon"></i>
        <div class="analytics-header__text">
          <h1 class="analytics-header__title">Анализ PnL</h1>
          <p class="analytics-header__subtitle">FP&A (Financial Planning & Analysis)</p>
        </div>
      </div>
      <div class="analytics-header__filters">
        <div class="analytics-filter">
          <label for="year-select">Год</label>
          <select id="year-select"><option>2023</option><option selected>2024</option><option>2025</option></select>
        </div>
        <div class="analytics-filter">
          <label>Детализация</label>
          <div class="analytics-segmented-control"><button class="active">Месяц</button><button>Квартал</button><button>Год</button></div>
        </div>
        <div class="analytics-filter">
          <label for="compare-select">Сравнение</label>
          <select id="compare-select"><option selected>с Пред. периодом</option><option>с YoY</option><option>с Бюджетом</option></select>
        </div>
      </div>
    </header>
  `;
}
function createTopKpiCardHTML(title, data) {
  const trendClass = data.trend >= 0 ? 'is-positive' : 'is-negative';
  return `
    <div class="analytics-kpi">
      <div class="analytics-kpi__title">${title}</div>
      <div class="analytics-kpi__value">${new Intl.NumberFormat('ru-RU').format(data.value)} <span class="analytics-kpi__unit">${data.unit}</span></div>
      <div class="analytics-kpi__trend ${trendClass}">
        <i data-lucide="${data.trend >= 0 ? 'trending-up' : 'trending-down'}"></i>
        <span>${Math.abs(data.trend)}% ${data.vs}</span>
      </div>
    </div>
  `;
}
function createChartCardHTML(id, title, icon) {
  return `
    <div class="analytics-chart">
      <div class="analytics-chart__header">
        <i data-lucide="${icon}"></i>
        <h3 class="analytics-chart__title">${title}</h3>
      </div>
      <div class="analytics-chart__body"><canvas id="${id}"></canvas></div>
    </div>
  `;
}

// --- ИНИЦИАЛИЗАЦИЯ ГРАФИКОВ ---
function initCharts(data) {
  if (!window.Chart) return;
  ['profitabilityTrendChart', 'opexStructureChart', 'waterfallChart'].forEach(id => {
    if (Chart.getChart(id)) Chart.getChart(id).destroy();
  });

  const styles = getComputedStyle(document.documentElement);
  const trendColors = [styles.getPropertyValue('--blue').trim(), styles.getPropertyValue('--accent').trim(), styles.getPropertyValue('--success').trim()];
  const structureColors = [styles.getPropertyValue('--blue').trim(), styles.getPropertyValue('--accent').trim(), styles.getPropertyValue('--warning').trim(), styles.getPropertyValue('--muted').trim()];

  const trendCtx = document.getElementById('profitabilityTrendChart')?.getContext('2d');
  if (trendCtx) new Chart(trendCtx, { type: 'line', data: { ...data.charts.profitabilityTrend, datasets: data.charts.profitabilityTrend.datasets.map((ds, i) => ({ ...ds, borderColor: trendColors[i] })) }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { ticks: { callback: v => `${v}%` } } } } });

  const opexCtx = document.getElementById('opexStructureChart')?.getContext('2d');
  if (opexCtx) new Chart(opexCtx, { type: 'doughnut', data: { ...data.charts.opexStructure, datasets: [{ ...data.charts.opexStructure.datasets[0], backgroundColor: structureColors, borderWidth: 4 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right' } } } });
  
  const waterfallCtx = document.getElementById('waterfallChart')?.getContext('2d');
  if (waterfallCtx) {
    const wfData = data.charts.waterfall;
    let cumulative = wfData.start;
    const chartData = {
      labels: ['ЧП (пред.)', ...wfData.bars.map(b => b.label), 'ЧП (тек.)'],
      datasets: [{
        data: [[0, wfData.start], ...wfData.bars.map(b => [cumulative, cumulative += b.value]), [0, cumulative]],
        backgroundColor: (ctx) => {
          if (ctx.dataIndex === 0 || ctx.dataIndex === chartData.labels.length - 1) return styles.getPropertyValue('--blue').trim();
          return wfData.bars[ctx.dataIndex - 1].value > 0 ? styles.getPropertyValue('--success').trim() : styles.getPropertyValue('--danger').trim();
        },
      }]
    };
    new Chart(waterfallCtx, { type: 'bar', data: chartData, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  }
}

// --- ГЛАВНАЯ ФУНКЦИЯ РЕНДЕРИНГА ---
export function renderAnalyticsPage(container) {
  container.innerHTML = `
    <div class="analytics-page">
      ${createHeaderHTML()}
      <div class="analytics-grid analytics-grid--kpi">
        ${createTopKpiCardHTML('Чистая прибыль', mockData.kpi.netProfit)}
        ${createTopKpiCardHTML('Чистая рентабельность', mockData.kpi.netMargin)}
        ${createTopKpiCardHTML('Выручка', mockData.kpi.revenue)}
        ${createTopKpiCardHTML('EBITDA', mockData.kpi.ebitda)}
      </div>
      <div class="analytics-grid analytics-grid--2-1">
        ${createChartCardHTML('profitabilityTrendChart', 'Динамика рентабельности', 'activity')}
        ${createChartCardHTML('opexStructureChart', 'Операционные расходы', 'pie-chart')}
      </div>
      <div class="analytics-grid analytics-grid--3-col">
        <div class="analytics-chart is-placeholder">Запас фин. прочности</div>
        <div class="analytics-chart is-placeholder">Операционный рычаг</div>
        <div class="analytics-chart is-placeholder">Производительность труда</div>
      </div>
      <div class="analytics-grid">
        ${createChartCardHTML('waterfallChart', 'Драйверы изменения чистой прибыли', 'align-end-vertical')}
      </div>
    </div>
  `;
  initCharts(mockData);
  refreshIcons();
}