// js/pages/analytics.js
import { refreshIcons } from '../utils.js';

// --- MOCK DATA FOR THE LAYOUT ---
const mockData = {
  kpi: {
    netProfit: { value: 1.2, unit: 'млн ₽', trend: 5.2, vsText: 'vs План', trendAbs: 0.06 },
    netMargin: { value: 15.8, unit: '%', trend: 1.2, vsText: 'vs ПП', trendAbs: 1.2 },
    revenue: { value: 7.6, unit: 'млн ₽', trend: -2.1, vsText: 'vs ПП', trendAbs: -0.16 },
    ebitda: { value: 1.7, unit: 'млн ₽', trend: 3.5, vsText: 'vs План', trendAbs: 0.09 }
  },
  stability: {
    marginOfSafety: { value: 28 },
    operatingLeverage: { value: 1.8, info: 'Чувствительность прибыли к изменению выручки' },
    sgaRatio: { value: 22.4, trend: -1.5, vsText: 'vs ПП' }
  },
  charts: {
    profitabilityTrend: {
      labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'],
      datasets: [
        { label: 'Валовая', data: [70, 72, 71, 73, 72.5, 72.3], tension: 0.4, borderWidth: 2.5 },
        { label: 'Операционная', data: [22, 24, 23, 25, 26, 25.1], tension: 0.4, borderWidth: 2.5 },
        { label: 'Чистая', data: [14, 15, 14.5, 16, 17, 15.8], tension: 0.4, borderWidth: 2.5 },
      ]
    },
    costGrowth: {
        labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'],
        datasets: [
            { label: 'Рост выручки, %', data: [5, 6, 4, 7, 5, 6], type: 'line', yAxisID: 'yPercentage' },
            { label: 'Рост COGS, %', data: [4, 5, 3, 6, 4, 5], type: 'bar', yAxisID: 'yPercentage' },
            { label: 'Рост OPEX, %', data: [6, 7, 5, 8, 6, 7], type: 'bar', yAxisID: 'yPercentage' },
        ]
    },
    opexStructure: {
      labels: ['Коммерческие', 'Административные', 'Логистика', 'Прочие'],
      datasets: [{ data: [45, 25, 18, 12] }]
    },
    waterfall: { start: 1.1, bars: [ { label: 'Рост выручки', value: 0.4 }, { label: 'Рост COGS', value: -0.2 }, { label: 'Рост OPEX', value: -0.15 } ], end: 1.15 }
  }
};

// --- HTML TEMPLATES ---
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
        <div class="analytics-filter"><label>Год</label><select><option>2023</option><option selected>2024</option><option>2025</option></select></div>
        <div class="analytics-filter"><label>Детализация</label><div class="analytics-segmented-control"><button class="active">Месяц</button><button>Квартал</button><button>Год</button></div></div>
        <div class="analytics-filter"><label>Сравнение</label><select><option selected>с Пред. периодом</option><option>с YoY</option><option disabled>с Бюджетом</option></select></div>
      </div>
    </header>
  `;
}

function createTopKpiCardHTML(title, subtitle, icon, data, info) {
  const isPositive = data.trend >= 0;
  const trendSign = isPositive ? '+' : '−';
  const trendClass = isPositive ? 'is-positive' : 'is-negative';
  const formattedValue = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(data.value);
  const formattedAbs = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Math.abs(data.trendAbs));
  return `
    <div class="analytics-kpi">
      <div class="analytics-kpi__header">
        <i data-lucide="${icon}" class="analytics-kpi__icon"></i>
        <div class="analytics-kpi__title-block">
          <div class="analytics-kpi__title">${title}</div>
          <p class="analytics-kpi__subtitle">${subtitle}</p>
        </div>
        <i data-lucide="info" class="info-icon" title="${info}"></i>
      </div>
      <div class="analytics-kpi__value">${formattedValue}<span class="analytics-kpi__unit">${data.unit}</span></div>
      <div class="analytics-kpi__trend ${trendClass}">
        <i data-lucide="${isPositive ? 'trending-up' : 'trending-down'}"></i>
        <span>${trendSign}${Math.abs(data.trend)}% | ${trendSign}${formattedAbs}${data.unit === '%' ? 'п.п.' : ''} ${data.vsText}</span>
      </div>
    </div>
  `;
}

function createChartCardHTML(id, title, subtitle, icon, info) {
  return `
    <div class="analytics-chart">
      <div class="analytics-chart__header">
        <i data-lucide="${icon}"></i>
        <div class="analytics-chart__title-block">
          <h3 class="analytics-chart__title">${title}</h3>
          <p class="analytics-chart__subtitle">${subtitle}</p>
        </div>
        <i data-lucide="info" class="info-icon" title="${info}"></i>
      </div>
      <div class="analytics-chart__body"><canvas id="${id}"></canvas></div>
    </div>
  `;
}

// --- CHART INITIALIZATION (FIXED) ---
function initCharts(data) {
    if (!window.Chart) return;
    ['profitabilityTrendChart', 'costGrowthChart', 'opexStructureChart', 'waterfallChart'].forEach(id => {
        if (Chart.getChart(id)) Chart.getChart(id).destroy();
    });

    const styles = getComputedStyle(document.documentElement);
    
    // Chart 1: Profitability Trend
    const trendCtx = document.getElementById('profitabilityTrendChart')?.getContext('2d');
    if (trendCtx) {
      const trendColors = [styles.getPropertyValue('--blue').trim(), styles.getPropertyValue('--accent').trim(), styles.getPropertyValue('--success').trim()];
      const chartData = data.charts.profitabilityTrend;
      chartData.datasets.forEach((ds, i) => {
          ds.borderColor = trendColors[i];
          ds.pointBackgroundColor = trendColors[i];
      });
      new Chart(trendCtx, { type: 'line', data: chartData, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'rectRounded' } } }, scales: { y: { ticks: { callback: v => `${v}%` } } } } });
    }

    // Chart 2: Cost Growth
    const costGrowthCtx = document.getElementById('costGrowthChart')?.getContext('2d');
    if (costGrowthCtx) {
        const trendColors = [styles.getPropertyValue('--blue').trim(), styles.getPropertyValue('--accent').trim(), styles.getPropertyValue('--success').trim()];
        new Chart(costGrowthCtx, {
            type: 'bar', data: { ...data.charts.costGrowth, datasets: [
                {...data.charts.costGrowth.datasets[0], borderColor: trendColors[0], backgroundColor: 'transparent'},
                {...data.charts.costGrowth.datasets[1], backgroundColor: trendColors[1]},
                {...data.charts.costGrowth.datasets[2], backgroundColor: trendColors[2]},
            ]},
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { yPercentage: { position: 'left', title: { display: true, text: 'Темп роста, %' } } } }
        });
    }

    // Chart 3: OPEX Structure (Doughnut Chart)
    const opexCtx = document.getElementById('opexStructureChart')?.getContext('2d');
    if (opexCtx) {
        const structureColors = [
            styles.getPropertyValue('--blue').trim(),
            styles.getPropertyValue('--accent').trim(),
            styles.getPropertyValue('--warning').trim(),
            styles.getPropertyValue('--muted').trim()
        ];
        
        const chartData = {
            labels: data.charts.opexStructure.labels,
            datasets: [{
                data: data.charts.opexStructure.datasets[0].data,
                backgroundColor: structureColors,
                // <<< THE ONLY CRITICAL FIX IS HERE
                borderColor: styles.getPropertyValue('--surface-color').trim(),
                borderWidth: 4,
                hoverOffset: 12
            }]
        };

        new Chart(opexCtx, {
            type: 'doughnut',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'rectRounded',
                            padding: 20,
                            boxWidth: 14
                        }
                    }
                }
            }
        });
    }
    
    // Chart 4: Profit Bridge (Waterfall/Bar Chart)
    const waterfallCtx = document.getElementById('waterfallChart')?.getContext('2d');
    if (waterfallCtx) {
        const wfData = data.charts.waterfall;
        let cumulative = wfData.start;
        const chartData = {
            labels: ['ЧП (пред.)', ...wfData.bars.map(b => b.label), 'ЧП (тек.)'],
            datasets: [{
                data: [[0, wfData.start], ...wfData.bars.map(b => {
                    const result = [cumulative, cumulative + b.value];
                    cumulative = result[1];
                    return result;
                }), [0, cumulative]],
                backgroundColor: (ctx) => {
                    if (ctx.dataIndex === 0 || ctx.dataIndex === chartData.labels.length - 1) return styles.getPropertyValue('--blue').trim();
                    return wfData.bars[ctx.dataIndex - 1].value > 0 ? styles.getPropertyValue('--success').trim() : styles.getPropertyValue('--danger').trim();
                },
                borderRadius: 2,
            }]
        };
        new Chart(waterfallCtx, { type: 'bar', data: chartData, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    }
}

// --- MAIN RENDER FUNCTION ---

export function renderAnalyticsPage(container) {
  container.innerHTML = `
    <div class="analytics-page">
      ${createHeaderHTML()}
      
      <div class="analytics-grid analytics-grid--kpi">
        ${createTopKpiCardHTML('Чистая прибыль', 'Net Profit', 'gem', mockData.kpi.netProfit, 'Итоговый финансовый результат компании.')}
        ${createTopKpiCardHTML('Чистая рентабельность', 'Net Profit Margin', 'percent', mockData.kpi.netMargin, 'Доля чистой прибыли в выручке.')}
        ${createTopKpiCardHTML('Выручка', 'Revenue', 'dollar-sign', mockData.kpi.revenue, 'Общая сумма доходов от основной деятельности.')}
        ${createTopKpiCardHTML('EBITDA', 'Operating Profit', 'shield', mockData.kpi.ebitda, 'Прибыль до вычета процентов, налогов и амортизации.')}
      </div>

      <div class="analytics-grid analytics-grid--2-col">
        ${createChartCardHTML('profitabilityTrendChart', 'Динамика рентабельности', 'Profitability Dynamics', 'activity', 'Отслеживание изменения маржинальности во времени.')}
        ${createChartCardHTML('costGrowthChart', 'Темпы роста', 'Cost vs. Revenue Growth', 'bar-chart-3', 'Сравнение темпов роста выручки и ключевых статей затрат.')}
      </div>

      <div class="analytics-grid analytics-grid--3-col">
        <div class="analytics-chart is-placeholder">Запас фин. прочности (Margin of Safety)</div>
        <div class="analytics-chart is-placeholder">Операционный рычаг (Operating Leverage)</div>
        <div class="analytics-chart is-placeholder">SG&A к выручке (SG&A to Sales)</div>
      </div>

      <div class="analytics-grid analytics-grid--1-1">
        ${createChartCardHTML('waterfallChart', 'Факторы изменения прибыли', 'Profit Bridge Analysis', 'align-end-vertical', 'Объяснение, за счет каких факторов изменилась прибыль.')}
        ${createChartCardHTML('opexStructureChart', 'Операционные расходы', 'Operating Expenses (OPEX)', 'pie-chart', 'Структура операционных расходов.')}
      </div>
    </div>
  `;
  initCharts(mockData);
  refreshIcons();
}