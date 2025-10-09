import { refreshIcons } from '../utils.js';
import { fetchPnlData } from '../api.js';

// ===== Настройки под вашу схему =====
const LABEL_FIELD = 'pnl_item'; // имя колонки с названием статьи PnL
const MONTH_KEYS = [null, 'jan_24', 'feb_24', 'mar_24', 'apr_24', 'may_24', 'jun_24', 'jul_24', 'aug_24', 'sep_24', 'oct_24', 'nov_24', 'dec_24'];
const RU_MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const QUARTER_MAP = {
    1: ['jan_24', 'feb_24', 'mar_24'],
    2: ['apr_24', 'may_24', 'jun_24'],
    3: ['jul_24', 'aug_24', 'sep_24'],
    4: ['oct_24', 'nov_24', 'dec_24'],
};

// Делитель для вывода в млн ₽:
// Ваши данные в тыс. ₽, поэтому для получения млн ₽ делим на 1000.
const UNIT_DIVISOR = 1000;

// Синонимы/варианты написания для поиска целевых строк PnL
const ALIASES = {
    revenue: [
        'выручка от реализации продукции,работ,услуг',
        'выручка итого',
        'выручка',
    ],
    grossProfit: ['валовая прибыль'],
    operatingProfit: ['операционная прибыль (old)', 'операционная прибыль'],
    netProfit: ['чистая прибыль'],
    ebitda: ['ebitda', 'ebitda.'],
    cogs: [
        'себестоимость продаж',
        'себестоимость реализации',
        'затраты на производство и реализацию продукции (total delivery costs)',
    ],
    commercialExpenses: [
        'расходы по продаже продукции',
        'расходы по продажам',
        'коммерческие расходы',
    ],
    adminExpenses: [
        'расходы на оплату труда и затраты на коммерческий и административный персонал',
        'административные расходы',
        'ку расходы',
    ],
};

// ===== Утилиты =====
const fmt = (val, digits = 1) =>
    new Intl.NumberFormat('ru-RU', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
    }).format(val ?? 0);

const toNum = (v) => {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    if (v == null) return 0;
    const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
};

const norm = (s) =>
    String(s ?? '')
    .replace(/\u00A0/g, ' ') // NBSP -> пробел
    .toLowerCase()
    .replace(/[«»"'.(),-\u2013\u2014]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function findRow(pnlData, aliasKey) {
    const synonyms = (ALIASES[aliasKey] || []).map(norm);
    return pnlData.find((r) => {
        const label = norm(r[LABEL_FIELD]);
        return synonyms.some((a) => label === a || label.startsWith(a));
    });
}

function sumRowByPeriods(row, periodKeys) {
    if (!row || !Array.isArray(periodKeys)) return 0;
    return periodKeys.reduce((acc, p) => acc + toNum(row[p]), 0);
}

function sumByLabelPrefix(pnlData, prefixes, periodKeys) {
    const pfx = prefixes.map(norm);
    return pnlData.reduce((sum, r) => {
        const label = norm(r[LABEL_FIELD]);
        if (pfx.some((p) => label.startsWith(p))) {
            return sum + sumRowByPeriods(r, periodKeys);
        }
        return sum;
    }, 0);
}

// ===== Калькулятор метрик =====
function calculateMetrics(pnlData, periodKeys, prevPeriodKeys = []) {
    const rowRevenue = findRow(pnlData, 'revenue');
    const rowGross = findRow(pnlData, 'grossProfit');
    const rowOp = findRow(pnlData, 'operatingProfit');
    const rowNet = findRow(pnlData, 'netProfit');
    const rowEbitda = findRow(pnlData, 'ebitda');
    const rowCOGS = findRow(pnlData, 'cogs');
    const rowComm = findRow(pnlData, 'commercialExpenses');
    const rowAdmin = findRow(pnlData, 'adminExpenses');

    let revenue = rowRevenue ? sumRowByPeriods(rowRevenue, periodKeys) : 0;
    if (!revenue) {
        revenue = sumByLabelPrefix(pnlData, ['выручка'], periodKeys);
    }

    const gross = rowGross ? sumRowByPeriods(rowGross, periodKeys) : 0;
    let cogs = rowCOGS ? sumRowByPeriods(rowCOGS, periodKeys) : 0;
    if (!cogs && revenue && gross) cogs = revenue - gross;

    const operatingProfit = rowOp ? sumRowByPeriods(rowOp, periodKeys) : 0;
    const netProfit = rowNet ? sumRowByPeriods(rowNet, periodKeys) : 0;
    const ebitda = rowEbitda ? sumRowByPeriods(rowEbitda, periodKeys) : 0;
    const comm = rowComm ? sumRowByPeriods(rowComm, periodKeys) : 0;
    const admin = rowAdmin ? sumRowByPeriods(rowAdmin, periodKeys) : 0;
    const opex = comm + admin;

    const prevRevenue = prevPeriodKeys.length ?
        (rowRevenue ? sumRowByPeriods(rowRevenue, prevPeriodKeys) : sumByLabelPrefix(pnlData, ['выручка'], prevPeriodKeys)) :
        0;
    const prevGross = prevPeriodKeys.length && rowGross ? sumRowByPeriods(rowGross, prevPeriodKeys) : 0;
    let prevCogs = prevPeriodKeys.length && rowCOGS ? sumRowByPeriods(rowCOGS, prevPeriodKeys) : 0;
    if (!prevCogs && prevRevenue && prevGross) prevCogs = prevRevenue - prevGross;

    const prevNetProfit = prevPeriodKeys.length && rowNet ? sumRowByPeriods(rowNet, prevPeriodKeys) : 0;
    const prevEbitda = prevPeriodKeys.length && rowEbitda ? sumRowByPeriods(rowEbitda, prevPeriodKeys) : 0;
    const prevComm = prevPeriodKeys.length && rowComm ? sumRowByPeriods(rowComm, prevPeriodKeys) : 0;
    const prevAdmin = prevPeriodKeys.length && rowAdmin ? sumRowByPeriods(rowAdmin, prevPeriodKeys) : 0;
    const prevOpex = prevComm + prevAdmin;

    const revM = revenue / UNIT_DIVISOR;
    const netM = netProfit / UNIT_DIVISOR;
    const ebitdaM = ebitda / UNIT_DIVISOR;

    const prevRevM = prevRevenue / UNIT_DIVISOR;
    const prevNetM = prevNetProfit / UNIT_DIVISOR;
    const prevEbitdaM = prevEbitda / UNIT_DIVISOR;

    const netMargin = revenue ? (netProfit / revenue) * 100 : 0;
    const prevNetMargin = prevRevenue ? (prevNetProfit / prevRevenue) * 100 : 0;

    const trend = (cur, prev) => {
        if (!prevPeriodKeys.length) return { trend: 0, trendAbs: 0 };
        const tAbs = cur - prev;
        const t = prev ? (tAbs / Math.abs(prev)) * 100 : (cur ? 100 : 0);
        return { trend: t, trendAbs: tAbs };
    };

    const monthlyRevenue = MONTH_KEYS.slice(1).map((p) => {
        if (rowRevenue) return toNum(rowRevenue[p]);
        return pnlData.reduce((sum, r) => (norm(r[LABEL_FIELD]).startsWith('выручка') ? sum + toNum(r[p]) : sum), 0);
    });

    const monthlyGross = MONTH_KEYS.slice(1).map((p) => (rowGross ? toNum(rowGross[p]) : 0));
    const monthlyOp = MONTH_KEYS.slice(1).map((p) => (rowOp ? toNum(rowOp[p]) : 0));
    const monthlyNet = MONTH_KEYS.slice(1).map((p) => (rowNet ? toNum(rowNet[p]) : 0));
    const monthlyComm = MONTH_KEYS.slice(1).map((p) => (rowComm ? toNum(rowComm[p]) : 0));
    const monthlyAdmin = MONTH_KEYS.slice(1).map((p) => (rowAdmin ? toNum(rowAdmin[p]) : 0));
    const monthlyOpex = monthlyComm.map((v, i) => v + monthlyAdmin[i]);
    const monthlyGrossMargin = monthlyRevenue.map((r, i) => (r ? (monthlyGross[i] / r) * 100 : 0));
    const monthlyOpMargin = monthlyRevenue.map((r, i) => (r ? (monthlyOp[i] / r) * 100 : 0));
    const monthlyNetMargin = monthlyRevenue.map((r, i) => (r ? (monthlyNet[i] / r) * 100 : 0));

    const mom = (arr) => arr.map((v, i) => {
        if (i === 0) return 0;
        const prev = arr[i - 1];
        return prev ? ((v - prev) / Math.abs(prev)) * 100 : 0;
    });

    const revenueMoM = mom(monthlyRevenue);
    const opexMoM = mom(monthlyOpex);

    const dRevenue = revenue - prevRevenue;
    const dCogs = cogs - prevCogs;
    const dOpex = opex - prevOpex;
    
    // Дополнительный фактор "Прочее" для балансировки водопада
    const dOther = (netProfit - prevNetProfit) - (dRevenue - dCogs - dOpex);

    return {
        kpi: {
            netProfit: { value: netM, unit: 'млн ₽', ...trend(netM, prevNetM), vsText: 'vs ПП' },
            netMargin: { value: netMargin, unit: '%', ...trend(netMargin, prevNetMargin), vsText: 'vs ПП' },
            revenue: { value: revM, unit: 'млн ₽', ...trend(revM, prevRevM), vsText: 'vs ПП' },
            ebitda: { value: ebitdaM, unit: 'млн ₽', ...trend(ebitdaM, prevEbitdaM), vsText: 'vs ПП' },
        },
        charts: {
            profitabilityTrend: {
                labels: RU_MONTHS,
                datasets: [
                    { label: 'Валовая', data: monthlyGrossMargin, tension: 0.35, borderWidth: 2.5 },
                    { label: 'Операционная', data: monthlyOpMargin, tension: 0.35, borderWidth: 2.5 },
                    { label: 'Чистая', data: monthlyNetMargin, tension: 0.35, borderWidth: 2.5 },
                ],
            },
            costGrowth: {
                labels: RU_MONTHS,
                revenueMoM,
                opexMoM,
            },
            opexStructure: {
                labels: ['Коммерческие', 'Административные'],
                datasets: [{ data: [comm / UNIT_DIVISOR, admin / UNIT_DIVISOR] }],
            },
            waterfall: {
                start: prevNetProfit / UNIT_DIVISOR,
                bars: [
                    { label: 'Δ Выручка', value: dRevenue / UNIT_DIVISOR },
                    { label: 'Δ COGS', value: -(dCogs / UNIT_DIVISOR) },
                    { label: 'Δ OPEX', value: -(dOpex / UNIT_DIVISOR) },
                    { label: 'Δ Прочее', value: dOther / UNIT_DIVISOR },
                ],
                end: netProfit / UNIT_DIVISOR,
            },
        },
    };
}

// ===== HTML-шаблоны =====
function createHeaderHTML(state) {
    return `
    <div class="analytics-header card-header">
      <div class="analytics-header__title-block">
        <i data-lucide="activity" class="analytics-header__icon"></i>
        <div>
          <h2 class="analytics-header__title">Финансовая аналитика</h2>
          <p class="analytics-header__subtitle">PnL • KPI • Тренды</p>
        </div>
      </div>
      <div class="analytics-header__filters">
        <div class="analytics-filter">
          <label for="year-select">Год</label>
          <select id="year-select">
            <option value="2024"${state.year === 2024 ? ' selected' : ''}>2024</option>
          </select>
        </div>
        <div class="analytics-segmented-control" id="period-control">
          <button class="${state.periodType === 'month' ? 'active' : ''}" data-period="month">Месяц</button>
          <button class="${state.periodType === 'quarter' ? 'active' : ''}" data-period="quarter">Квартал</button>
          <button class="${state.periodType === 'year' ? 'active' : ''}" data-period="year">Год</button>
        </div>
        ${state.periodType === 'month' ? `
        <div class="analytics-filter">
          <label for="month-select">Месяц</label>
          <select id="month-select">
            ${RU_MONTHS.map((m, i) => `<option value="${i+1}" ${state.month === i+1 ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>` : ''}
        ${state.periodType === 'quarter' ? `
        <div class="analytics-filter">
          <label for="quarter-select">Квартал</label>
          <select id="quarter-select">
            ${[1,2,3,4].map((q) => `<option value="${q}" ${state.quarter === q ? 'selected' : ''}>Q${q}</option>`).join('')}
          </select>
        </div>` : ''}
      </div>
    </div>`;
}

function createTopKpiCardHTML(title, subtitle, icon, data, info) {
    const positive = (data.trend ?? 0) >= 0;
    return `
    <div class="analytics-kpi card">
      <div class="analytics-kpi__header">
        <i data-lucide="${icon}" class="analytics-kpi__icon"></i>
        <div class="analytics-kpi__title-block">
          <div class="analytics-kpi__title">${title}</div>
          <div class="analytics-kpi__subtitle">${subtitle}</div>
        </div>
        <i data-lucide="info" class="info-icon" title="${info || ''}"></i>
      </div>
      <div class="analytics-kpi__value">
        ${fmt(data.value)}
        <span class="analytics-kpi__unit">${data.unit}</span>
      </div>
      <div class="analytics-kpi__trend ${positive ? 'is-positive' : 'is-negative'}">
        <i data-lucide="${positive ? 'arrow-up-right' : 'arrow-down-right'}"></i>
        <span>${fmt(data.trend, 1)}% ${data.vsText || ''}</span>
      </div>
    </div>`;
}

function createChartCardHTML(id, title, subtitle, icon, info) {
    return `
    <div class="analytics-chart card">
      <div class="analytics-chart__header">
        <i data-lucide="${icon}"></i>
        <div class="analytics-chart__title-block">
          <h3 class="analytics-chart__title">${title}</h3>
          <div class="analytics-chart__subtitle">${subtitle}</div>
        </div>
        <i data-lucide="info" class="info-icon" title="${info || ''}"></i>
      </div>
      <div class="analytics-chart__body">
        <canvas id="${id}"></canvas>
      </div>
    </div>`;
}

// ===== Графики (Chart.js) =====
let charts = {};

function destroyCharts() {
    Object.values(charts).forEach((ch) => ch?.destroy?.());
    charts = {};
}

function initCharts(chartData) {
    if (!window.Chart) return;
    destroyCharts();

    const colors = ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#9CA3AF'];

    const ctx1 = document.getElementById('profitabilityTrendChart')?.getContext('2d');
    if (ctx1) {
        charts.profitabilityTrend = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: chartData.profitabilityTrend.labels,
                datasets: chartData.profitabilityTrend.datasets.map((d, idx) => ({
                    ...d,
                    borderColor: colors[idx % colors.length],
                    backgroundColor: 'transparent',
                    pointRadius: 2,
                })),
            },
            options: { responsive: true, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' } }, scales: { y: { ticks: { callback: (v) => `${v.toFixed(1)}%` } } } },
        });
    }

    const ctx2 = document.getElementById('costGrowthChart')?.getContext('2d');
    if (ctx2) {
        charts.costGrowth = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: chartData.costGrowth.labels,
                datasets: [
                    { label: 'Revenue MoM', data: chartData.costGrowth.revenueMoM, backgroundColor: colors[0] },
                    { label: 'OPEX MoM', data: chartData.costGrowth.opexMoM, backgroundColor: colors[3] },
                ],
            },
            options: { responsive: true, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom' } }, scales: { y: { ticks: { callback: (v) => `${v}%` } } } },
        });
    }

    const ctx3 = document.getElementById('waterfallChart')?.getContext('2d');
    if (ctx3 && chartData.waterfall.start !== undefined) {
        const { start, bars, end } = chartData.waterfall;
        const labels = ['Старт', ...bars.map((b) => b.label), 'Финиш'];
        let runningTotal = 0;
        const data = [
            start, 
            ...bars.map(b => { runningTotal += b.value; return b.value; }),
            end
        ];

        charts.waterfall = new Chart(ctx3, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Изменение',
                    data: data,
                    backgroundColor: (ctx) => {
                        if (ctx.dataIndex === 0 || ctx.dataIndex === data.length - 1) return colors[4]; // Старт и финиш
                        return data[ctx.dataIndex] >= 0 ? colors[1] : colors[3]; // Рост и падение
                    },
                    barPercentage: 0.9,
                    categoryPercentage: 0.9,
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { title: { display: true, text: 'млн ₽' } },
                    x: { grid: { display: false } }
                },
                indexAxis: 'x',
            },
            plugins: [{
                id: 'waterfall',
                beforeRender: (chart) => {
                    const meta = chart.getDatasetMeta(0);
                    let total = 0;
                    meta.data.forEach((bar, index) => {
                        if (index > 0 && index < meta.data.length - 1) {
                            bar.y = chart.scales.y.getPixelForValue(total + data[index]);
                            bar.height = chart.scales.y.getPixelForValue(total) - chart.scales.y.getPixelForValue(total + data[index]);
                            total += data[index];
                        }
                    });
                }
            }]
        });
    }

    const ctx4 = document.getElementById('opexStructureChart')?.getContext('2d');
    if (ctx4) {
        charts.opex = new Chart(ctx4, {
            type: 'doughnut',
            data: {
                labels: chartData.opexStructure.labels,
                datasets: [{ ...chartData.opexStructure.datasets[0], backgroundColor: [colors[0], colors[2]] }],
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)} млн ₽` } } } },
        });
    }
}

// ===== Рендер страницы =====
export async function renderAnalyticsPage(container) {
    const state = {
        year: 2024,
        periodType: 'month',
        month: new Date().getMonth() + 1,
        quarter: Math.ceil((new Date().getMonth() + 1) / 3),
        pnlData: [],
    };

    function getPeriods() {
        if (state.periodType === 'year') {
            return { periodKeys: MONTH_KEYS.slice(1), prevPeriodKeys: [] };
        }
        if (state.periodType === 'quarter') {
            const periodKeys = QUARTER_MAP[state.quarter];
            const prevPeriodKeys = state.quarter > 1 ? QUARTER_MAP[state.quarter - 1] : [];
            return { periodKeys, prevPeriodKeys };
        }
        const periodKeys = [MONTH_KEYS[state.month]];
        const prevPeriodKeys = state.month > 1 ? [MONTH_KEYS[state.month - 1]] : [];
        return { periodKeys, prevPeriodKeys };
    }

    function bindFilters() {
        container.querySelector('#year-select')?.addEventListener('change', (e) => {
            state.year = parseInt(e.target.value, 10);
            loadDataAndRender();
        });
        container.querySelector('#period-control')?.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-period]');
            if (!btn) return;
            state.periodType = btn.dataset.period;
            if (state.periodType === 'quarter') state.quarter = Math.ceil(state.month / 3);
            updateDashboard();
        });
        container.querySelector('#month-select')?.addEventListener('change', (e) => {
            state.month = parseInt(e.target.value, 10);
            updateDashboard();
        });
        container.querySelector('#quarter-select')?.addEventListener('change', (e) => {
            state.quarter = parseInt(e.target.value, 10);
            updateDashboard();
        });
    }

    function renderUI(metrics) {
        container.innerHTML = `
        <div class="analytics-page">
            ${createHeaderHTML(state)}
            <div class="analytics-grid analytics-grid--kpi">
                ${createTopKpiCardHTML('Чистая прибыль', 'Net Profit', 'gem', metrics.kpi.netProfit, 'Чистая прибыль за период')}
                ${createTopKpiCardHTML('Чистая рентабельность', 'Net Profit Margin', 'percent', metrics.kpi.netMargin, 'Net Profit / Revenue')}
                ${createTopKpiCardHTML('Выручка', 'Revenue', 'dollar-sign', metrics.kpi.revenue, 'Сумма выручки за период')}
                ${createTopKpiCardHTML('EBITDA', 'Operating Proxy', 'shield', metrics.kpi.ebitda, 'EBITDA')}
            </div>
            <div class="analytics-grid analytics-grid--2-col">
                ${createChartCardHTML('profitabilityTrendChart', 'Динамика рентабельности', 'Gross / Op / Net Margins', 'activity', 'Помесячная маржинальность')}
                ${createChartCardHTML('costGrowthChart', 'Темпы роста', 'Revenue vs OPEX MoM', 'bar-chart-3', 'Месяц к месяцу')}
            </div>
            <div class="analytics-grid analytics-grid--3-col">
                <div class="analytics-chart is-placeholder">Запас фин. прочности (позже)</div>
                <div class="analytics-chart is-placeholder">Операционный рычаг (позже)</div>
                <div class="analytics-chart is-placeholder">SG&A к выручке (позже)</div>
            </div>
            <div class="analytics-grid analytics-grid--1-1">
                ${createChartCardHTML('waterfallChart', 'Факторы изменения прибыли', 'Profit Bridge', 'align-end-vertical', 'Δ Revenue / COGS / OPEX')}
                ${createChartCardHTML('opexStructureChart', 'Операционные расходы', 'OPEX Structure', 'pie-chart', 'Коммерческие vs Административные')}
            </div>
        </div>`;
        initCharts(metrics.charts);
        if (typeof refreshIcons === 'function') refreshIcons();
        else if (window.lucide?.createIcons) window.lucide.createIcons();
        bindFilters();
    }

    function updateDashboard() {
        if (!state.pnlData?.length) {
            container.innerHTML = `<div class="card module-placeholder error">Нет данных PnL за ${state.year}. Проверьте доступ к view v_pnl_${state.year}.</div>`;
            return;
        }
        const { periodKeys, prevPeriodKeys } = getPeriods();
        const metrics = calculateMetrics(state.pnlData, periodKeys, prevPeriodKeys);
        renderUI(metrics);
    }

    async function loadDataAndRender() {
        container.innerHTML = `<div class="card"><p>Загрузка данных за ${state.year} год...</p></div>`;
        try {
            state.pnlData = await fetchPnlData(state.year);
            updateDashboard();
        } catch (err) {
            container.innerHTML = `<div class="card module-placeholder error">Ошибка загрузки PnL: ${err?.message || err}</div>`;
        }
    }

    await loadDataAndRender();
}