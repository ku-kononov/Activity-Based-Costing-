// js/pages/analytics.js
import { refreshIcons } from '../utils.js';
import { fetchPnlData } from '../api.js';

// ====== Константы и настройки ======
const LABEL_FIELD = 'pnl_item';
const MONTH_KEYS = [
  null,
  'jan_24','feb_24','mar_24','apr_24','may_24','jun_24',
  'jul_24','aug_24','sep_24','oct_24','nov_24','dec_24'
];
const RU_MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
const QUARTER_MAP = {
  1: ['jan_24','feb_24','mar_24'],
  2: ['apr_24','may_24','jun_24'],
  3: ['jul_24','aug_24','sep_24'],
  4: ['oct_24','nov_24','dec_24'],
};
// Данные в v_pnl_2024 — в тыс. руб. → показываем в млн ₽
const UNIT_DIVISOR = 1000;

// Нормализованные имена строк (точные соответствия)
const EXACT = {
  revenue: 'выручка от реализации продукции работ услуг',
  grossProfit: 'валовая прибыль',
  operatingProfit: 'операционная прибыль old',
  netProfit: 'чистая прибыль',
  ebitda: 'ebitda',
  depreciationTotal: 'амортизация всего',
  netInterest: 'чистые процентные доходы и расходы',
  incomeTax: 'налог на прибыль',
  otherOperating: 'прочие операционные доходы расходы',
  otherOperating2: 'прочие операционные доходы / расходы',
  assetOps: 'доходы расходы от операций с основными средствами',
};

// Доли переменной части OPEX по корзинам (аппрокс.)
const VAR_SHARE = {
  commercial: 0.60,
  transport:  0.70,
  it:         0.20,
  rent_utils: 0.10,
  repairs:    0.30,
  admin:      0.00,
  other:      0.20
};

// ====== Утилиты ======
const fmt = (val, digits = 1) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: digits })
    .format(isFinite(val) ? val : 0);
const fmt2 = (v) => fmt(v, 2);
const fmtSigned = (v, digits = 2) => `${v >= 0 ? '+' : '-'}${fmt(Math.abs(v), digits)}`;

const toNum = (v) => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
};
const norm = (s) =>
  String(s ?? '')
    .replace(/\u00A0/g, ' ')
    .toLowerCase()
    .replace(/[«»"'.(),/\\:\-\u2013\u2014]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const eq = (a, b) => norm(a) === norm(b);
const escAttr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function findRowExact(pnlData, exactNormalized) {
  return pnlData.find((r) => norm(r[LABEL_FIELD]) === exactNormalized) || null;
}
function sumRowPeriods(row, periodKeys) {
  if (!row || !Array.isArray(periodKeys)) return 0;
  return periodKeys.reduce((acc, p) => acc + toNum(row[p]), 0);
}
function sumWhere(pnlData, periodKeys, predicate) {
  return pnlData.reduce((acc, r) => (predicate(r) ? acc + sumRowPeriods(r, periodKeys) : acc), 0);
}
function monthlySeries(row) {
  return MONTH_KEYS.slice(1).map((p) => (row ? toNum(row[p]) : 0));
}
function seriesMoMPercent(arr) {
  return arr.map((v, i) => (i === 0 ? 0 : (arr[i - 1] ? ((v - arr[i - 1]) / Math.abs(arr[i - 1])) * 100 : 0)));
}

// eqLabel — нужен для быстрых проверок наличия агрегатов в данных
const eqLabel = (r, s) => eq(r[LABEL_FIELD], s);

// ====== Тултипы (.info-tip) ======
function injectInfoTipStyles() {
  if (document.getElementById('analytics-info-tip-styles')) return;
  const style = document.createElement('style');
  style.id = 'analytics-info-tip-styles';
  style.textContent = `
    .info-tip { display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; color:#B7BFC6; opacity:.9; cursor:help; user-select:none; }
    .info-tip:hover { color:#AAB3BA; }
    .info-tip svg { width:16px; height:16px; stroke: currentColor; }
    .ai-info-bubble { position:fixed; z-index:9999; max-width:460px; background:rgba(17,24,39,.96); color:#fff; padding:10px 12px; border-radius:8px; font-size:15.6px; line-height:1.45; box-shadow:0 8px 20px rgba(0,0,0,.28); pointer-events:none; opacity:0; transform:translate(-50%,-120%); transition:opacity .08s; white-space:pre-line; word-wrap:break-word; }
    .metric-footer { display:flex; justify-content:flex-end; margin-top:6px; }
    .metric-chip { display:inline-flex; align-items:baseline; gap:8px; padding:6px 10px; border:1px solid var(--border); border-radius:10px; background:var(--bg); font-weight:600; }
    .metric-chip .label { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.3px; }
    .metric-chip .value { font-size:20px; color: var(--blue); font-variant-numeric: tabular-nums; }
  `;
  document.head.appendChild(style);
}
let infoTipInited = false;
function setupInfoTooltips() {
  if (infoTipInited) return;
  infoTipInited = true;
  injectInfoTipStyles();

  const bubble = document.createElement('div');
  bubble.className = 'ai-info-bubble';
  document.body.appendChild(bubble);

  let active = null;
  const escapeHtml = (s) => String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  function show(text, x, y) {
    bubble.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
    bubble.style.opacity = '1';
    position(x, y);
  }
  function hide() { bubble.style.opacity = '0'; }
  function position(x, y) {
    const pad = 14;
    let left = x, top = y - 12;
    const rect = bubble.getBoundingClientRect();
    if (left + rect.width / 2 + pad > window.innerWidth) left = window.innerWidth - rect.width / 2 - pad;
    if (left - rect.width / 2 - pad < 0) left = rect.width / 2 + pad;
    if (top - rect.height - pad < 0) top = rect.height + pad + 8;
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
  }

  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest('.info-tip');
    if (!t) return;
    active = t;
    const text = t.getAttribute('data-tip') || '';
    show(text, e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', (e) => { if (active) position(e.clientX, e.clientY); });
  document.addEventListener('mouseout', (e) => {
    if (!active) return;
    const related = e.relatedTarget;
    if (!related || !related.closest || !related.closest('.info-tip')) { active = null; hide(); }
  });
}

// ====== Классификация OPEX ======
function isProductionOrLogistics(labelN) {
  return (
    labelN.includes('производ') || labelN.includes('произв') ||
    labelN.includes('логистик') || labelN.includes('доставка') ||
    labelN.includes('перевозк') || labelN.includes('таможенн') ||
    labelN.includes('входящая логистика') || labelN.includes('исходящая логистика')
  );
}

// Классификация статей OPEX по корзинам
function classifyOpexLabel(L, hasCommAgg, hasAdminAgg) {
  if (isProductionOrLogistics(L)) return null; // это COGS, не OPEX

  if (hasCommAgg && L === norm('расходы по продаже продукции')) return 'commercial';
  if (!hasCommAgg && (
    L.startsWith('реклама') || L.startsWith('выставоч') ||
    L.includes('маркетинг') || L.includes('маркетингов') ||
    L.includes('акции') || L.includes('федеральная рекламная') ||
    L.includes('прочие маркетинговые') || L.startsWith('активация продаж')
  )) return 'commercial';

  if (hasAdminAgg && L === norm('расходы на оплату труда и затраты на коммерческий и административный персонал')) return 'admin';
  if (!hasAdminAgg && (
    L.startsWith('фот коммерческий и управленческий персонал') ||
    L.startsWith('прочие выплаты и расходы на ку персонал') ||
    L.startsWith('питание ку персонал') || L.startsWith('доставка ку персонала') ||
    L.startsWith('расходы по охране труда ку персонал') ||
    L.startsWith('прочие расходы на организацию труда ку персонал') ||
    L.startsWith('начисления на заработную плату коммерческого и административного персонала') ||
    L === 'прочие административные расходы'
  )) return 'admin';

  if (
    (L.includes('аренд') && (L.includes('офис') || L.includes('инфраструктура') || L.includes('основных средств'))) ||
    L.startsWith('аренда тс') ||
    L.startsWith('энергетика офисн инфраструктура') ||
    L.startsWith('электроэнергия офисн инфраструктура') ||
    L.startsWith('вода холодная офисн инфраструктура') ||
    L.startsWith('отопление офисн инфраструктура')
  ) return 'rent_utils';

  if (
    L.startsWith('ремонт и техническое обслуживание офисных зданий и сооружений') ||
    L.startsWith('текущий ремонт офисных зданий и сооружений') ||
    L === 'ремонт оргтехники' || L.includes('прочие расходы на содержание служебного транспорта')
  ) return 'repairs';

  if (
    L.startsWith('программное обеспечение и сопровождение программ') ||
    L.startsWith('лицензии за использование по') ||
    L.startsWith('техническая поддержка по и систем') ||
    L.startsWith('услуги по развитию по') ||
    L.startsWith('услуги связи') || L.includes('интернет') || L.includes('эл почта') ||
    L.startsWith('услуги доступа к информационным продуктам') ||
    L === 'почтовые услуги' || L === 'прочие услуги связи'
  ) return 'it';

  if (
    L.startsWith('расходы на содержание служебного транспорта') ||
    L.startsWith('топливо cлужебный') || L.startsWith('ремонт и то а м') ||
    L.startsWith('медосмотр водителей') || L.startsWith('расходные материалы для а м') ||
    L.startsWith('аренда тс')
  ) return 'transport';

  if (
    L.startsWith('услуги управления и прочие услуги') || L === 'юридические услуги' ||
    L.startsWith('экономические бухгалтерские услуги') || L === 'содержание франчайзинговой сети' ||
    (L.startsWith('прочие услуги') && !L.endsWith('связи')) ||
    L === 'представительские расходы' || L === 'командировочные расходы' ||
    L === 'налог на имущество' || L === 'транспортный налог' || L === 'госпошлина' ||
    L.startsWith('обеспечение офисных мест мебелью') || L.startsWith('обеспечение рабочих мест оргтехникой') ||
    L.startsWith('расходы на оргтехнику до') || L === 'расходные материалы' || L === 'офисное обеспечение' ||
    L === 'бумага' || L.includes('канцелярские') || L === 'печатная продукция' || L === 'вода питьевая' ||
    L === 'прочие офисные расходы' || L === 'экологический налог' || L === 'земельный налог' || L === 'списание рбп и нма'
  ) return 'other';

  return null;
}

function buildOpexBreakdown(pnlData, periodKeys) {
  const hasCommAgg = pnlData.some((r) => eqLabel(r, 'расходы по продаже продукции'));
  const hasAdminAgg = pnlData.some((r) =>
    eqLabel(r, 'расходы на оплату труда и затраты на коммерческий и административный персонал')
  );

  const buckets = { commercial: 0, admin: 0, rent_utils: 0, repairs: 0, it: 0, transport: 0, other: 0 };

  for (const r of pnlData) {
    const L = norm(r[LABEL_FIELD]);
    const cat = classifyOpexLabel(L, hasCommAgg, hasAdminAgg);
    if (!cat) continue;
    buckets[cat] += sumRowPeriods(r, periodKeys);
  }

  return {
    buckets,
    categories: [
      { key: 'Коммерческие', label: 'Коммерческие', value: buckets.commercial },
      { key: 'Административные', label: 'Административные', value: buckets.admin },
      { key: 'Аренда и коммунальные', label: 'Аренда и коммунальные', value: buckets.rent_utils },
      { key: 'Обслуживание и ремонт', label: 'Обслуживание и ремонт', value: buckets.repairs },
      { key: 'ИТ и связь', label: 'ИТ и связь', value: buckets.it },
      { key: 'Транспорт (адм.)', label: 'Транспорт (адм.)', value: buckets.transport },
      { key: 'Прочие', label: 'Прочие', value: buckets.other },
    ],
  };
}
function monthlyOpexSeries(pnlData) {
  const hasCommAgg = pnlData.some((r) => eqLabel(r, 'расходы по продаже продукции'));
  const hasAdminAgg = pnlData.some((r) =>
    eqLabel(r, 'расходы на оплату труда и затраты на коммерческий и административный персонал')
  );
  const arr = new Array(12).fill(0);
  for (const r of pnlData) {
    const L = norm(r[LABEL_FIELD]);
    const cat = classifyOpexLabel(L, hasCommAgg, hasAdminAgg);
    if (!cat) continue;
    MONTH_KEYS.slice(1).forEach((p, i) => { arr[i] += toNum(r[p]); });
  }
  return arr;
}

// ====== Бейзлайн (вместо «ПП») ======
function rollingAvg(arr, endIndex, window = 3) {
  const end = Math.max(0, endIndex);
  const start = Math.max(0, end - window);
  const slice = arr.slice(start, end).filter(v => isFinite(v));
  if (!slice.length) return 0;
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}
function nonZeroAvg(arr) {
  const s = arr.filter(v => isFinite(v) && Math.abs(v) > 0);
  if (!s.length) return 0;
  return s.reduce((a, b) => a + b, 0) / s.length;
}

// ====== Графики (Chart.js) ======
let charts = {};
function destroyCharts() {
  Object.values(charts).forEach((ch) => ch?.destroy?.());
  charts = {};
}
function initCharts(chartData) {
  if (!window.Chart) return;
  destroyCharts();

  const compactLegend = { position: 'bottom', labels: { padding: 6, boxWidth: 10, boxHeight: 10 } };

  // 1) Динамика рентабельности (line)
  const el1 = document.getElementById('profitabilityTrendChart');
  if (el1) {
    charts.profitabilityTrend = new Chart(el1.getContext('2d'), {
      type: 'line',
      data: {
        labels: chartData.profitabilityTrend.labels,
        datasets: chartData.profitabilityTrend.datasets.map((d, idx) => ({
          ...d,
          borderColor: ['#60A5FA', '#34D399', '#FBBF24'][idx] || '#4D5964',
          backgroundColor: 'transparent',
          pointRadius: 2,
        })),
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: compactLegend },
        scales: { y: { ticks: { callback: (v) => `${v}%` } } },
      },
    });
  }

  // 2) Темпы роста (Revenue vs OPEX, MoM)
  const el2 = document.getElementById('costGrowthChart');
  if (el2) {
    charts.costGrowth = new Chart(el2.getContext('2d'), {
      type: 'bar',
      data: {
        labels: chartData.costGrowth.labels,
        datasets: chartData.costGrowth.datasets,
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: compactLegend },
        scales: { y: { ticks: { callback: (v) => `${v}%` } } },
      },
    });
  }

  // 3) Waterfall (плавающие столбики: пары [low,high])
  const el3 = document.getElementById('waterfallChart');
  if (el3) {
    charts.waterfall = new Chart(el3.getContext('2d'), {
      type: 'bar',
      data: {
        labels: chartData.waterfall.labels,
        datasets: [{
          label: 'Переход',
          data: chartData.waterfall.pairs, // [low, high]
          backgroundColor: chartData.waterfall.colors,
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const meta = chartData.waterfall.tooltip[ctx.dataIndex];
                if (!meta) return '';
                if (meta.type === 'start')  return `Старт (среднее): ${fmt(meta.value, 2)} млн ₽`;
                if (meta.type === 'finish') return `Финиш (текущий): ${fmt(meta.value, 2)} млн ₽`;
                return [
                  `${meta.label}: ${fmt(meta.delta, 2)} млн ₽`,
                  `От: ${fmt(meta.from, 2)} → До: ${fmt(meta.to, 2)} млн ₽`,
                ];
              }
            }
          }
        },
        scales: { y: { title: { display: true, text: 'млн ₽' } } },
      },
    });
  }

  // 4) OPEX структура (doughnut)
  const el4 = document.getElementById('opexStructureChart');
  if (el4) {
    const parent = el4.parentElement;
    if (parent) parent.style.minHeight = '240px';
    el4.style.height = '200px';
    charts.opex = new Chart(el4.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: chartData.opexStructure.labels,
        datasets: [{ data: chartData.opexStructure.datasets[0].data, backgroundColor: ['#60A5FA','#F59E0B','#A78BFA','#34D399','#F87171','#10B981','#9CA3AF'] }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        plugins: {
          legend: compactLegend,
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)} млн ₽` } }
        },
      },
    });
  }

  // 5) Safety Margin (stacked bar)
  const elSM = document.getElementById('safetyMarginChart');
  if (elSM) {
    charts.safety = new Chart(elSM.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Выручка / Точка безубыточности'],
        datasets: [
          { label: 'Точка безубыточности', data: [Math.max(0, chartData.safetyMargin.beRevenueM)], backgroundColor: '#9CA3AF' },
          { label: 'Запас (выше точки)', data: [Math.max(0, chartData.safetyMargin.revenueM - chartData.safetyMargin.beRevenueM)], backgroundColor: '#34D399' },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: compactLegend,
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw ?? 0)} млн ₽`, afterBody: () => [`Safety Margin: ${fmt(chartData.safetyMargin.safetyPct, 2)}%`] } },
        },
        scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: 'млн ₽' } } },
      },
    });
  }

  // 6) DOL (bar, 2 столбца)
  const elDOL = document.getElementById('operatingLeverageChart');
  if (elDOL) {
    charts.dol = new Chart(elDOL.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Текущий vs среднее'],
        datasets: [
          { label: 'Δ Revenue %', data: [chartData.operatingLeverage.revChangePct], backgroundColor: '#60A5FA' },
          { label: 'Δ Op. Profit %', data: [chartData.operatingLeverage.opChangePct], backgroundColor: '#F59E0B' },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: compactLegend, tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw, 2)}%`, afterBody: () => [`DOL ≈ ${fmt(chartData.operatingLeverage.dol, 2)}`] } } },
        scales: { y: { title: { display: true, text: '%' } } },
      },
    });
  }

  // 7) SG&A / Revenue (stacked %)
  const elSGA = document.getElementById('sgaToRevenueChart');
  if (elSGA) {
    charts.sga = new Chart(elSGA.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['SG&A к выручке'],
        datasets: [
          { label: 'Коммерческие', data: [chartData.sgaRatio.commPctOfRev], backgroundColor: '#60A5FA' },
          { label: 'Административные', data: [chartData.sgaRatio.adminPctOfRev], backgroundColor: '#F59E0B' },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: compactLegend, tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.raw, 2)}%` } } },
        scales: { x: { stacked: true }, y: { stacked: true, max: 100, title: { display: true, text: '%' } } },
      },
    });
  }
}

// ====== Основной расчёт ======
function calculateMetrics(pnlData, periodKeys, prevPeriodKeys = [], state) {
  const rowRevenue = findRowExact(pnlData, EXACT.revenue);
  const rowGross = findRowExact(pnlData, EXACT.grossProfit);
  const rowOp = findRowExact(pnlData, EXACT.operatingProfit);
  const rowNet = findRowExact(pnlData, EXACT.netProfit);
  const rowEbitda = findRowExact(pnlData, EXACT.ebitda);
  const rowDeprTotal = findRowExact(pnlData, EXACT.depreciationTotal);
  const rowNetInterest = findRowExact(pnlData, EXACT.netInterest);
  const rowIncomeTax = findRowExact(pnlData, EXACT.incomeTax);

  const revenue = sumRowPeriods(rowRevenue, periodKeys);
  const gross = sumRowPeriods(rowGross, periodKeys);
  const operatingProfit = sumRowPeriods(rowOp, periodKeys);
  const netProfit = sumRowPeriods(rowNet, periodKeys);

  // EBITDA (строка или OP + D&A)
  let ebitda = sumRowPeriods(rowEbitda, periodKeys);
  let depr = sumRowPeriods(rowDeprTotal, periodKeys);
  if (!ebitda) {
    if (!depr) {
      depr = sumWhere(pnlData, periodKeys, (r) => norm(r[LABEL_FIELD]).startsWith('амортизация'));
    }
    ebitda = operatingProfit + depr;
  } else if (!depr) {
    depr = Math.max(0, ebitda - operatingProfit);
  }

  const opexBreak = buildOpexBreakdown(pnlData, periodKeys);
  const totalOpex = opexBreak.categories.reduce((s, c) => s + c.value, 0);
  const { commercial: comm, admin, it, rent_utils, repairs, transport, other } = opexBreak.buckets;
  const sga = comm + admin;

  const otherOp = sumWhere(pnlData, periodKeys, (r) => {
    const L = norm(r[LABEL_FIELD]);
    return (eq(L, EXACT.otherOperating) || eq(L, EXACT.otherOperating2) || eq(L, EXACT.assetOps));
  });
  const netInterest = sumRowPeriods(rowNetInterest, periodKeys);
  const incomeTax = sumRowPeriods(rowIncomeTax, periodKeys);

  const revM = revenue / UNIT_DIVISOR;
  const netM = netProfit / UNIT_DIVISOR;
  const ebitdaM = ebitda / UNIT_DIVISOR;
  const netMargin = revenue ? (netProfit / revenue) * 100 : 0;

  // Бейзлайн (vs средн.)
  const monthlyRevenue = monthlySeries(rowRevenue);
  const monthlyNet = monthlySeries(rowNet);
  const monthlyOp = monthlySeries(rowOp);
  const monthlyGross = monthlySeries(rowGross);
  const monthIdx = state.periodType === 'month' ? Math.max(0, (state.month || 1) - 1)
                    : state.periodType === 'quarter' ? (state.quarter - 1) * 3 + 2 : 11;

  function baselineOf(arr) {
    if (state.periodType === 'month') {
      const base = rollingAvg(arr, monthIdx, 3);
      return base || nonZeroAvg(arr.slice(0, monthIdx));
    }
    if (state.periodType === 'quarter') {
      const qStart = (state.quarter - 1) * 3;
      const prevQ = state.quarter > 1 ? arr.slice(qStart - 3, qStart) : [];
      const base = prevQ.length ? nonZeroAvg(prevQ) : nonZeroAvg(arr.slice(0, qStart));
      return base;
    }
    return nonZeroAvg(arr);
  }

  const baseRev = baselineOf(monthlyRevenue);
  const baseNet = baselineOf(monthlyNet);
  const baseEbitda = baselineOf(monthlyOp.map(v => v)); // приближение
  const baseNetMargin = (baseRev ? (baselineOf(monthlyNet) / baseRev) * 100 : 0);

  const trendVsBase = (cur, base) => {
    const tAbs = cur - base;
    const tPct = base ? (tAbs / Math.abs(base)) * 100 : (cur ? 100 : 0);
    return { trend: tPct, trendAbs: tAbs };
  };

  // Переменный/фиксированный OPEX → CMR/Safety
  const variableOpex =
    VAR_SHARE.commercial * comm +
    VAR_SHARE.transport  * transport +
    VAR_SHARE.it         * it +
    VAR_SHARE.rent_utils * rent_utils +
    VAR_SHARE.repairs    * repairs +
    VAR_SHARE.admin      * admin +
    VAR_SHARE.other      * other;

  const variableTotal = (revenue - gross) + variableOpex; // COGS + var OPEX
  const cmr = revenue > 0 ? Math.max(0, 1 - (variableTotal / revenue)) : 0;
  const fixedCosts = Math.max(0, totalOpex - variableOpex);

  const beRevenue = (cmr > 0) ? (fixedCosts / cmr) : 0;
  const safetyAbs = Math.max(0, revenue - beRevenue);
  const safetyPct = revenue > 0 && beRevenue > 0 ? Math.max(0, (safetyAbs / revenue) * 100) : 0;

  const contribution = revenue * cmr;
  let dolPoint = 0;
  const opIncome = operatingProfit;
  if (Math.abs(opIncome) > 1e-6) {
    dolPoint = Math.max(-10, Math.min(10, contribution / opIncome));
  }
  const revDeltaPct = baseRev ? ((revM - (baseRev/UNIT_DIVISOR)) / Math.abs(baseRev/UNIT_DIVISOR)) * 100 : 0;
  const opDeltaPct  = baseEbitda ? (((ebitdaM) - (baseEbitda/UNIT_DIVISOR)) / Math.abs(baseEbitda/UNIT_DIVISOR)) * 100 : 0;
  let dolDelta = 0;
  if (Math.abs(revDeltaPct) > 0.1) {
    dolDelta = Math.max(-10, Math.min(10, opDeltaPct / revDeltaPct));
  }
  const dol = dolPoint || dolDelta || 0;

  const sgaPct = revenue ? (sga / revenue) * 100 : 0;
  const commPctOfRev = revenue ? (comm / revenue) * 100 : 0;
  const adminPctOfRev = revenue ? (admin / revenue) * 100 : 0;

  const monthlyGrossMargin = monthlyRevenue.map((r, i) => (r ? (monthlyGross[i] / r) * 100 : 0));
  const monthlyOpMargin = monthlyRevenue.map((r, i) => (r ? (monthlyOp[i] / r) * 100 : 0));
  const monthlyNetMargin = monthlyRevenue.map((r, i) => (r ? (monthlyNet[i] / r) * 100 : 0));
  const monthlyOpex = monthlyOpexSeries(pnlData);
  const revenueMoM = seriesMoMPercent(monthlyRevenue);
  const opexMoM = seriesMoMPercent(monthlyOpex);

  // Водопад (среднее → текущий)
  const startM = (baselineOf(monthlyNet)) / UNIT_DIVISOR;
  const endM = netProfit / UNIT_DIVISOR;

  const baseGross = baselineOf(monthlyGross);
  const baseComm = baselineOf([comm/12,comm/12,comm/12,comm/12,comm/12,comm/12,comm/12,comm/12,comm/12,comm/12,comm/12,comm/12]);
  const baseAdmin = baselineOf([admin/12,admin/12,admin/12,admin/12,admin/12,admin/12,admin/12,admin/12,admin/12,admin/12,admin/12,admin/12]);
  const baseIt = baselineOf([it/12, it/12, it/12, it/12, it/12, it/12, it/12, it/12, it/12, it/12, it/12, it/12]);

  const dGrossM = (gross - baseGross) / UNIT_DIVISOR;
  const dCommM = -((comm - (baseComm*12)) / UNIT_DIVISOR);
  const dAdminM = -((admin - (baseAdmin*12)) / UNIT_DIVISOR);
  const dItM = -((it - (baseIt*12)) / UNIT_DIVISOR);
  const dOtherOpM = (otherOp) / UNIT_DIVISOR;
  const dInterestM = -(netInterest / UNIT_DIVISOR);
  const dTaxM = -(incomeTax / UNIT_DIVISOR);

  const rawBars = [
    { key: 'gross', label: 'Δ Валовая прибыль', value: dGrossM, color: '#60A5FA' },
    { key: 'comm',  label: 'Δ Коммерческие',     value: dCommM,  color: '#F59E0B' },
    { key: 'admin', label: 'Δ Административные', value: dAdminM, color: '#A78BFA' },
    { key: 'it',    label: 'Δ ИТ и связь',       value: dItM,    color: '#10B981' },
    { key: 'other', label: 'Δ Прочие опер. дох/расх', value: dOtherOpM, color: '#94A3B8' },
    { key: 'int',   label: 'Δ Проценты (net)',   value: dInterestM, color: '#F87171' },
    { key: 'tax',   label: 'Δ Налог на прибыль', value: dTaxM,   color: '#EF4444' }
  ];
  const sumDeltas = rawBars.reduce((s,b)=>s+(b.value||0),0);
  const balance = endM - (startM + sumDeltas);
  const bars = Math.abs(balance) > 0.005 ? [...rawBars, { key: 'bal', label: 'Δ Прочее (баланс)', value: balance, color: '#9CA3AF' }] : rawBars;

  const wfLabels = ['Старт', ...bars.map((b) => b.label), 'Финиш'];
  const wfPairs = [];
  const wfTooltip = [];
  const wfColors = [];
  let cursor = startM;
  wfPairs.push([startM, startM]);
  wfTooltip.push({ type: 'start', value: startM });
  bars.forEach((b) => {
    const next = cursor + b.value;
    wfPairs.push([Math.min(cursor, next), Math.max(cursor, next)]);
    wfTooltip.push({ type: 'delta', label: b.label, delta: b.value, from: cursor, to: next, color: b.color });
    wfColors.push(b.color);
    cursor = next;
  });
  wfPairs.push([endM, endM]);
  wfTooltip.push({ type: 'finish', value: endM });
  const wfBarColors = ['#9CA3AF', ...wfColors, '#9CA3AF'];

  return {
    kpi: {
      revenue:   { value: revM,     unit: 'млн ₽', ...trendVsBase(revM, baseRev/UNIT_DIVISOR),       vsText: 'vs средн.' },
      ebitda:    { value: ebitdaM,  unit: 'млн ₽', ...trendVsBase(ebitdaM, baseEbitda/UNIT_DIVISOR), vsText: 'vs средн.' },
      netProfit: { value: netM,     unit: 'млн ₽', ...trendVsBase(netM, baseNet/UNIT_DIVISOR),       vsText: 'vs средн.' },
      netMargin: { value: netMargin,unit: '%',     ...trendVsBase(netMargin, baseNetMargin),         vsText: 'vs средн.' },
    },
    charts: {
      profitabilityTrend: {
        labels: RU_MONTHS,
        datasets: [
          { label: 'Валовая',      data: monthlyGrossMargin, tension: 0.35, borderWidth: 2.5 },
          { label: 'Операционная', data: monthlyOpMargin,    tension: 0.35, borderWidth: 2.5 },
          { label: 'Чистая',       data: monthlyNetMargin,   tension: 0.35, borderWidth: 2.5 },
        ],
        info: 'Меняется доля прибыли (валовая, операционная, чистая) относительно выручки, помесячно.',
      },
      costGrowth: {
        labels: RU_MONTHS,
        datasets: [
          { label: 'Revenue MoM', data: seriesMoMPercent(monthlyRevenue), backgroundColor: '#60A5FA' },
          { label: 'OPEX MoM',    data: seriesMoMPercent(monthlyOpex),    backgroundColor: '#F87171' },
        ],
        info: 'Скорость роста выручки и операционных расходов по месяцам (в % к предыдущему).',
      },
      opexStructure: {
        labels: opexBreak.categories.map((c) => c.label),
        datasets: [{ data: opexBreak.categories.map((c) => c.value / UNIT_DIVISOR) }],
        info: 'Структура операционных расходов (без COGS) по основным корзинам.',
      },
      waterfall: {
        labels: wfLabels,
        pairs: wfPairs,
        tooltip: wfTooltip,
        colors: wfBarColors,
        info: 'Мостик чистой прибыли: как факторы привели от среднего базиса к текущему уровню.',
      },
      safetyMargin: {
        revenueM: revM,
        beRevenueM: beRevenue / UNIT_DIVISOR,
        safetyPct,
        safetyM: safetyAbs / UNIT_DIVISOR,
        info: 'Safety = (Выручка − Точка безубыточности) / Выручка.\nТочка = Фикс. затраты / CMR, где CMR = 1 − (COGS + VarOPEX)/Выручка.',
      },
      operatingLeverage: {
        revChangePct: revDeltaPct,
        opChangePct: opDeltaPct,
        dol,
        info: `DOL≈CM/OpIncome (точечно) или ΔOp%/ΔRev% (дельтами), клиппинг ±10.`,
      },
      sgaRatio: {
        commPctOfRev,
        adminPctOfRev,
        sgaPct,
        info: 'SG&A/Выручка: Коммерческие% + Административные%.',
      },
    },
    breakdown: {
      revenue, gross, cogs: revenue - gross, totalOpex, comm, admin, it, rent_utils, repairs, transport, other,
      ebitda, operatingProfit, netProfit, cmr, fixedCosts, variableOpex, beRevenue, safetyAbs, safetyPct,
      otherOp, netInterest, incomeTax, depr
    }
  };
}

// ====== HTML ======
function createHeaderHTML(state) {
  return `
    <div class="analytics-header">
      <div class="analytics-header__title-block">
        <i data-lucide="activity" class="analytics-header__icon"></i>
        <div>
          <h2 class="analytics-header__title">Финансовая аналитика</h2>
          <p class="analytics-header__subtitle">Метрики и показатели PnL</p>
        </div>
      </div>

      <div class="analytics-header__filters">
        <div class="analytics-filter">
          <label for="year-select">Год</label>
          <select id="year-select">
            <option value="2024"${state.year === 2024 ? ' selected' : ''}>2024</option>
          </select>
        </div>

        <div class="analytics-segmented-control" id="period-control" role="tablist" aria-label="Период">
          <button class="${state.periodType === 'month' ? 'active' : ''}" data-period="month" role="tab" aria-selected="${state.periodType==='month'}">Месяц</button>
          <button class="${state.periodType === 'quarter' ? 'active' : ''}" data-period="quarter" role="tab" aria-selected="${state.periodType==='quarter'}">Квартал</button>
          <button class="${state.periodType === 'year' ? 'active' : ''}" data-period="year" role="tab" aria-selected="${state.periodType==='year'}">Год</button>
        </div>

        ${state.periodType === 'month' ? `
          <div class="analytics-filter">
            <label for="month-select">Месяц</label>
            <select id="month-select">
              ${RU_MONTHS.map((m, i) => `<option value="${i+1}" ${state.month === i+1 ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
        ` : ''}

        ${state.periodType === 'quarter' ? `
          <div class="analytics-filter">
            <label for="quarter-select">Квартал</label>
            <select id="quarter-select">
              ${[1,2,3,4].map((q) => `<option value="${q}" ${state.quarter === q ? 'selected' : ''}>Q${q}</option>`).join('')}
            </select>
          </div>
        ` : ''}
      </div>
    </div>
  `;
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
        <span class="info-tip" data-tip="${escAttr(info || '')}" aria-label="Подробнее">
          <i data-lucide="info"></i>
        </span>
      </div>
      <div class="analytics-kpi__value">
        ${fmt(data.value)} <span class="analytics-kpi__unit">${data.unit}</span>
      </div>
      <div class="analytics-kpi__trend ${positive ? ' is-positive' : ' is-negative'}">
        <i data-lucide="${positive ? 'arrow-up-right' : 'arrow-down-right'}"></i>
        <span>${fmt(data.trend, 1)}% ${data.vsText || ''}</span>
      </div>
    </div>
  `;
}
function createChartCardHTML(id, title, subtitle, icon, info, footerHTML = '') {
  return `
    <div class="analytics-chart card">
      <div class="analytics-chart__header">
        <i data-lucide="${icon}"></i>
        <div class="analytics-chart__title-block">
          <h3 class="analytics-chart__title">${title}</h3>
          <div class="analytics-chart__subtitle">${subtitle}</div>
        </div>
        <span class="info-tip" data-tip="${escAttr(info || '')}" aria-label="Подробнее">
          <i data-lucide="info"></i>
        </span>
      </div>
      <div class="analytics-chart__body">
        <canvas id="${id}"></canvas>
      </div>
      ${footerHTML}
    </div>
  `;
}

// ===== P&L компактный блок с экспортом =====
function createPnlCardHTML(breakdown, title = 'Расшифровка PnL и OPEX') {
  const toM = (v) => v / UNIT_DIVISOR;
  const rows = [
    { label: 'Выручка', val: toM(breakdown.revenue), cls: 'strong' },
    { label: 'Себестоимость (COGS)', val: toM(breakdown.cogs), cls: 'muted' },
    { label: 'Валовая прибыль', val: toM(breakdown.gross), cls: 'subtotal' },

    { label: 'Коммерческие', val: toM(breakdown.comm) },
    { label: 'Административные', val: toM(breakdown.admin) },
    { label: 'ИТ и связь', val: toM(breakdown.it) },
    { label: 'Аренда и коммунальные', val: toM(breakdown.rent_utils) },
    { label: 'Обслуживание и ремонт', val: toM(breakdown.repairs) },
    { label: 'Транспорт (адм.)', val: toM(breakdown.transport) },
    { label: 'Прочие', val: toM(breakdown.other) },
    { label: 'OPEX всего', val: toM(breakdown.totalOpex), cls: 'subtotal' },

    { label: 'EBITDA', val: toM(breakdown.ebitda), cls: 'strong' },
    { label: 'Амортизация (D&A)', val: toM(breakdown.depr) },
    { label: 'Опер. прибыль', val: toM(breakdown.operatingProfit), cls: 'subtotal' },

    { label: 'Прочие опер. дох/расх', val: toM(breakdown.otherOp) },
    { label: 'Проценты (net)', val: toM(breakdown.netInterest) },
    { label: 'Налог на прибыль', val: toM(breakdown.incomeTax) },
    { label: 'Чистая прибыль', val: toM(breakdown.netProfit), cls: 'total' },
  ];

  const tableRows = rows.map(r => `
    <tr class="${r.cls || ''}">
      <td class="label">${r.label}</td>
      <td class="num">${fmt2(r.val)}</td>
      <td class="unit">млн ₽</td>
    </tr>
  `).join('');

  return `
    <div class="pnl-card card">
      <div class="pnl-titlebar">
        <div class="pnl-title">
          <i data-lucide="table"></i>
          <span>${title}</span>
        </div>
        <div class="pnl-actions">
          <button id="pnl-export-pdf" class="pnl-btn" title="Скачать PDF" aria-label="Скачать PDF">
            <i data-lucide="file-down"></i><span>PDF</span>
          </button>
          <button id="pnl-export-xls" class="pnl-btn" title="Скачать Excel" aria-label="Скачать Excel">
            <i data-lucide="file-spreadsheet"></i><span>Excel</span>
          </button>
        </div>
      </div>
      <div class="analytics-table-wrap">
        <table id="pnl-table" class="pnl-table">
          <thead>
            <tr><th class="label">Статья</th><th class="num">Сумма</th><th class="unit">Ед.</th></tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ===== Экспорт =====
function exportPnlToExcel() {
  const table = document.getElementById('pnl-table');
  if (!table) return;
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="UTF-8"></head>
    <body>${table.outerHTML}</body></html>`;
  const blob = new Blob(["\uFEFF", html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PnL_${new Date().toISOString().slice(0,10)}.xls`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function exportPnlToPDF() {
  const table = document.getElementById('pnl-table');
  if (!table) return;
  const w = window.open('', '_blank');
  const css = `
    body { font-family: Inter, Arial, sans-serif; color:#111827; }
    h1 { font-size:18px; margin:0 0 10px; }
    table { width:100%; border-collapse: collapse; }
    th, td { padding:8px 10px; border-bottom:1px solid #E5E7EB; }
    th { text-align:left; background:#F3F4F6; }
    td.num { text-align:right; font-variant-numeric: tabular-nums; }
    td.unit { color:#6B7280; width:80px; }
    tr.subtotal td { font-weight:700; background:#FAFAFA; }
    tr.total td { font-weight:800; border-top:2px solid #9CA3AF; }
    .meta { margin-bottom:12px; color:#6B7280; font-size:12px; }
    @page { size: A4; margin: 16mm; }
  `;
  w.document.write(`<html><head><meta charset="UTF-8"><title>PnL</title><style>${css}</style></head><body>`);
  w.document.write(`<h1>Расшифровка PnL и OPEX</h1>`);
  w.document.write(`<div class="meta">Дата выгрузки: ${new Date().toLocaleString('ru-RU')}</div>`);
  w.document.write(table.outerHTML);
  w.document.write(`</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); w.close(); }, 150);
}

// ====== Рендер страницы ======
export async function renderAnalyticsPage(container) {
  const state = {
    year: 2024,
    periodType: 'month',
    month: new Date().getMonth() + 1,
    quarter: Math.ceil((new Date().getMonth() + 1) / 3),
    pnlData: [],
  };

  function getPeriods() {
    if (state.periodType === 'year') return { periodKeys: MONTH_KEYS.slice(1), prevPeriodKeys: [] };
    if (state.periodType === 'quarter') {
      const periodKeys = QUARTER_MAP[state.quarter];
      const prevPeriodKeys = [];
      return { periodKeys, prevPeriodKeys };
    }
    const periodKeys = [MONTH_KEYS[state.month]];
    const prevPeriodKeys = [];
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
    const safetyFooter = `
      <div class="metric-footer">
        <div class="metric-chip"><span class="label">Safety</span><span class="value">${fmt2(metrics.charts.safetyMargin.safetyPct)}%</span></div>
      </div>`;
    const dolFooter = `
      <div class="metric-footer">
        <div class="metric-chip"><span class="label">DOL</span><span class="value">${fmtSigned(metrics.charts.operatingLeverage.dol, 2)}x</span></div>
      </div>`;
    const sgaFooter = `
      <div class="metric-footer">
        <div class="metric-chip"><span class="label">SG&A / Rev</span><span class="value">${fmt2(metrics.charts.sgaRatio.sgaPct)}%</span></div>
      </div>`;

    container.innerHTML = `
      <div class="analytics-page">
        ${createHeaderHTML(state)}

        <div class="analytics-grid analytics-grid--kpi">
          ${createTopKpiCardHTML('Чистая прибыль', 'Net Profit', 'gem', metrics.kpi.netProfit, 'Прибыль после всех расходов (включая налоги и проценты).')}
          ${createTopKpiCardHTML('Чистая рентабельность', 'Net Profit Margin', 'percent', metrics.kpi.netMargin, 'Чистая прибыль в % от выручки.')}
          ${createTopKpiCardHTML('Выручка', 'Revenue', 'dollar-sign', metrics.kpi.revenue, 'Итоговая сумма продаж за выбранный период.')}
          ${createTopKpiCardHTML('EBITDA', 'Operating proxy', 'shield', metrics.kpi.ebitda, 'Прибыль до вычета процентов, налогов и амортизации.')}
        </div>

        <div class="analytics-grid analytics-grid--2-col">
          ${createChartCardHTML('profitabilityTrendChart', 'Динамика рентабельности', 'Profitability Margins Dynamics', 'activity', 'Доля прибыли на разных уровнях относительно выручки (помесячно).')}
          ${createChartCardHTML('costGrowthChart', 'Темпы роста', 'Growth Rates (Revenue vs OPEX, MoM)', 'trending-up', 'Скорость роста выручки и операционных расходов по месяцам (в %).')}
        </div>

        <div class="analytics-grid analytics-grid--3-col">
          ${createChartCardHTML('safetyMarginChart', 'Запас финансовой прочности', 'Financial Safety Margin', 'lifebuoy', metrics.charts.safetyMargin.info, safetyFooter)}
          ${createChartCardHTML('operatingLeverageChart', 'Операционный рычаг', 'Operating Leverage', 'gauge', metrics.charts.operatingLeverage.info, dolFooter)}
          ${createChartCardHTML('sgaToRevenueChart', 'SG&A к выручке', 'SG&A to Revenue', 'percent', metrics.charts.sgaRatio.info, sgaFooter)}
        </div>

        <div class="analytics-grid analytics-grid--1-1">
          ${createChartCardHTML('waterfallChart', 'Факторы изменения (среднее → текущий)', 'Profit Bridge', 'align-end-vertical', metrics.charts.waterfall.info)}
          ${createChartCardHTML('opexStructureChart', 'Операционные расходы', 'OPEX Structure', 'pie-chart', metrics.charts.opexStructure.info)}
        </div>

        ${createPnlCardHTML(metrics.breakdown)}

        <button class="pnl-fab" title="Описание и методология метрик PnL" aria-label="Описание и методология метрик PnL" onclick="navigate('pnl-methodology')">
          <i data-lucide="book-open"></i>
          <span>Описание и методология метрик PnL</span>
        </button>
      </div>
    `;

    // Иконки, тултипы, графики, фильтры
    if (typeof refreshIcons === 'function') { try { refreshIcons(); } catch (e) {} }
    else if (window.lucide?.createIcons) { try { window.lucide.createIcons(); } catch (e) {} }
    setupInfoTooltips();
    initCharts(metrics.charts);
    bindFilters();

    // Экспорт
    container.querySelector('#pnl-export-xls')?.addEventListener('click', exportPnlToExcel);
    container.querySelector('#pnl-export-pdf')?.addEventListener('click', exportPnlToPDF);
  }

  function updateDashboard() {
    if (!state.pnlData?.length) {
      container.innerHTML = `
        <div class="card module-placeholder error">
          Нет данных PnL за ${state.year}. Проверьте доступ к view v_pnl_${state.year}.
        </div>`;
      return;
    }
    const { periodKeys, prevPeriodKeys } = getPeriods();
    const metrics = calculateMetrics(state.pnlData, periodKeys, prevPeriodKeys, state);
    renderUI(metrics);
  }

  async function loadDataAndRender() {
    container.innerHTML = `<div class="card"><p>Загрузка данных за ${state.year} год...</p></div>`;
    try {
      state.pnlData = await fetchPnlData(state.year);
      updateDashboard();
    } catch (err) {
      container.innerHTML = `
        <div class="card module-placeholder error">
          Ошибка загрузки PnL: ${err?.message || err}
        </div>`;
    }
  }

  await loadDataAndRender();
}