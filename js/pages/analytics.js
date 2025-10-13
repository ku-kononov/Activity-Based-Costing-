import { refreshIcons } from '../utils.js';
import { fetchPnlData } from '../api.js';

/*
  Что изменено по задаче:
  1) Визуал трёх новых блоков (Safety, DOL, SG&A):
     - шрифт метрик увеличен (value = 20px),
     - ещё уменьшён отступ между легендой графика и метрикой (metric-footer margin-top = 4px),
     - легенды графиков более компактные (уменьшены padding и размеры маркеров).
  2) Полностью переработан водопад «Факторы изменения»:
     - крупные факторы: Δ Валовая прибыль, −Δ Коммерческие, −Δ Административные, −Δ ИТ и связь,
       +Δ Прочие опер. дох/расх, −Δ Проценты (net), −Δ Налог на прибыль,
     - добавлен балансирующий фактор «Δ Прочее (баланс)» при расхождении сумм,
     - Start = Net(prev), Finish = Net(cur), корректные тултипы (уровни и переходы От → До),
     - фиксированные цвета по категориям, хорошая читабельность.
  3) Подсказки (tooltips) — кастомный движок .info-tip с крупным шрифтом (+30%) и переносами строк.
*/

// ===== Конфигурация =====
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

// Точные наименования (нормализованные) для ключевых строк
const EXACT = {
  revenue: 'выручка от реализации продукции работ услуг',
  grossProfit: 'валовая прибыль',
  operatingProfit: 'операционная прибыль old',
  netProfit: 'чистая прибыль',
  ebitda: 'ebitda', // «EBITDA.» → «ebitda»
  depreciationTotal: 'амортизация всего',
  netInterest: 'чистые процентные доходы и расходы',
  incomeTax: 'налог на прибыль',
  otherOperating: 'прочие операционные доходы расходы',
  otherOperating2: 'прочие операционные доходы / расходы',
  assetOps: 'доходы расходы от операций с основными средствами',
};

// ===== Утилиты =====
const fmt = (val, digits = 1) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: digits })
    .format(val ?? 0);
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

// ===== Поиск/Суммирование =====
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

// ===== Tooltip-движок для .info-tip (светло‑серый, +30% шрифт, переносы) =====
function injectInfoTipStyles() {
  if (document.getElementById('analytics-info-tip-styles')) return;
  const style = document.createElement('style');
  style.id = 'analytics-info-tip-styles';
  style.textContent = `
    .info-tip {
      display: inline-flex; align-items: center; justify-content: center;
      width: 20px; height: 20px; color: #B7BFC6; opacity: .9; cursor: help; user-select: none;
    }
    .info-tip:hover { color: #AAB3BA; }
    .info-tip svg { width: 16px; height: 16px; stroke: currentColor; }

    .ai-info-bubble {
      position: fixed; z-index: 9999; max-width: 420px; background: rgba(17, 24, 39, 0.96);
      color: #fff; padding: 10px 12px; border-radius: 8px; font-size: 15.6px; line-height: 1.45;
      box-shadow: 0 8px 20px rgba(0,0,0,.28); pointer-events: none; opacity: 0;
      transform: translate(-50%, -120%); transition: opacity .08s ease; white-space: pre-line; word-wrap: break-word;
    }

    /* Метрики внизу карточек: крупнее и ближе к легенде */
    .metric-footer { display: flex; justify-content: flex-end; margin-top: 4px; }
    .metric-chip { display: inline-flex; align-items: baseline; gap: 8px; padding: 6px 10px;
      border: 1px solid var(--border); border-radius: 10px; background: var(--bg); font-weight: 600; }
    .metric-chip .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .3px; }
    .metric-chip .value { font-size: 20px; color: var(--blue); font-variant-numeric: tabular-nums; }
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

  const escapeHtml = (s) =>
    String(s ?? '')
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

// ===== OPEX классификация (существующая логика) =====
function isProductionOrLogistics(labelN) {
  return (
    labelN.includes('производ') || labelN.includes('произв') ||
    labelN.includes('логистик') || labelN.includes('доставка') ||
    labelN.includes('перевозк') || labelN.includes('таможенн') ||
    labelN.includes('входящая логистика') || labelN.includes('исходящая логистика')
  );
}
const eqLabel = (r, s) => eq(r[LABEL_FIELD], s);

function classifyOpexLabel(L, hasCommAgg, hasAdminAgg) {
  if (isProductionOrLogistics(L)) return null;

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

// ===== Основной расчёт =====
function calculateMetrics(pnlData, periodKeys, prevPeriodKeys = []) {
  const rowRevenue = findRowExact(pnlData, EXACT.revenue);
  const rowGross = findRowExact(pnlData, EXACT.grossProfit);
  const rowOp = findRowExact(pnlData, EXACT.operatingProfit);
  const rowNet = findRowExact(pnlData, EXACT.netProfit);
  const rowEbitda = findRowExact(pnlData, EXACT.ebitda);
  const rowDeprTotal = findRowExact(pnlData, EXACT.depreciationTotal);
  const rowNetInterest = findRowExact(pnlData, EXACT.netInterest);
  const rowIncomeTax = findRowExact(pnlData, EXACT.incomeTax);

  // Текущий/пред. периоды (суммы)
  const revenue = sumRowPeriods(rowRevenue, periodKeys);
  const gross = sumRowPeriods(rowGross, periodKeys);
  const operatingProfit = sumRowPeriods(rowOp, periodKeys);
  const netProfit = sumRowPeriods(rowNet, periodKeys);
  const prevRevenue = sumRowPeriods(rowRevenue, prevPeriodKeys);
  const prevOperatingProfit = sumRowPeriods(rowOp, prevPeriodKeys);
  const prevNetProfit = sumRowPeriods(rowNet, prevPeriodKeys);

  // COGS
  const cogs = revenue && gross ? (revenue - gross) : 0;

  // EBITDA: прямая строка или fallback (OP + D&A)
  let ebitda = sumRowPeriods(rowEbitda, periodKeys);
  if (!ebitda) {
    let depr = sumRowPeriods(rowDeprTotal, periodKeys);
    if (!depr) {
      depr = sumWhere(pnlData, periodKeys, (r) => {
        const L = norm(r[LABEL_FIELD]);
        return (
          L.startsWith('амортизация производственная') ||
          L.startsWith('амортизация производственная стандартная') ||
          L.startsWith('амортизация производственная по фсбу 25') ||
          L.startsWith('амортизация офисная инфраструктура') ||
          L.startsWith('амортизация офисная стандартн') ||
          L.startsWith('амортизация офисная по фсбу 25')
        );
      });
    }
    ebitda = operatingProfit + depr;
  }
  let prevEbitda = sumRowPeriods(rowEbitda, prevPeriodKeys);
  if (!prevEbitda) {
    let prevDepr = sumRowPeriods(rowDeprTotal, prevPeriodKeys);
    if (!prevDepr) {
      prevDepr = sumWhere(pnlData, prevPeriodKeys, (r) => {
        const L = norm(r[LABEL_FIELD]);
        return (
          L.startsWith('амортизация производственная') ||
          L.startsWith('амортизация производственная стандартная') ||
          L.startsWith('амортизация производственная по фсбу 25') ||
          L.startsWith('амортизация офисная инфраструктура') ||
          L.startsWith('амортизация офисная стандартн') ||
          L.startsWith('амортизация офисная по фсбу 25')
        );
      });
    }
    prevEbitda = prevOperatingProfit + prevDepr;
  }

  // OPEX структура и главные корзины
  const opexBreak = buildOpexBreakdown(pnlData, periodKeys);
  const opexBreakPrev = buildOpexBreakdown(pnlData, prevPeriodKeys);
  const totalOpex = opexBreak.categories.reduce((s, c) => s + c.value, 0);
  const comm = (opexBreak.categories.find(c => c.label === 'Коммерческие')?.value) || 0;
  const admin = (opexBreak.categories.find(c => c.label === 'Административные')?.value) || 0;
  const it = (opexBreak.categories.find(c => c.label === 'ИТ и связь')?.value) || 0;
  const prevComm = (opexBreakPrev.categories.find(c => c.label === 'Коммерческие')?.value) || 0;
  const prevAdmin = (opexBreakPrev.categories.find(c => c.label === 'Административные')?.value) || 0;
  const prevIt = (opexBreakPrev.categories.find(c => c.label === 'ИТ и связь')?.value) || 0;
  const sga = comm + admin;

  // Прочие опер./проценты/налог
  const otherOp = sumWhere(pnlData, periodKeys, (r) => {
    const L = norm(r[LABEL_FIELD]);
    return (eq(L, EXACT.otherOperating) || eq(L, EXACT.otherOperating2) || eq(L, EXACT.assetOps));
  });
  const prevOtherOp = sumWhere(pnlData, prevPeriodKeys, (r) => {
    const L = norm(r[LABEL_FIELD]);
    return (eq(L, EXACT.otherOperating) || eq(L, EXACT.otherOperating2) || eq(L, EXACT.assetOps));
  });
  const netInterest = sumRowPeriods(rowNetInterest, periodKeys);
  const prevNetInterest = sumRowPeriods(rowNetInterest, prevPeriodKeys);
  const incomeTax = sumRowPeriods(rowIncomeTax, periodKeys);
  const prevIncomeTax = sumRowPeriods(rowIncomeTax, prevPeriodKeys);

  // KPI (млн ₽) и маржа
  const revM = revenue / UNIT_DIVISOR;
  const netM = netProfit / UNIT_DIVISOR;
  const ebitdaM = ebitda / UNIT_DIVISOR;
  const prevRevM = prevRevenue / UNIT_DIVISOR;
  const prevNetM = prevNetProfit / UNIT_DIVISOR;
  const prevEbitdaM = prevEbitda / UNIT_DIVISOR;
  const netMargin = revenue ? (netProfit / revenue) * 100 : 0;
  const prevNetMargin = prevRevenue ? (prevNetProfit / prevRevenue) * 100 : 0;

  const trend = (cur, prev) => {
    const tAbs = cur - prev;
    const t = prev ? (tAbs / Math.abs(prev)) * 100 : (cur ? 100 : 0);
    return { trend: t, trendAbs: tAbs };
  };

  // Серии для графиков маржинальности и MoM
  const monthlyRevenue = monthlySeries(rowRevenue);
  const monthlyNet = monthlySeries(rowNet);
  const monthlyOp = monthlySeries(rowOp);
  const monthlyGross = monthlySeries(rowGross);
  const monthlyGrossMargin = monthlyRevenue.map((r, i) => (r ? (monthlyGross[i] / r) * 100 : 0));
  const monthlyOpMargin = monthlyRevenue.map((r, i) => (r ? (monthlyOp[i] / r) * 100 : 0));
  const monthlyNetMargin = monthlyRevenue.map((r, i) => (r ? (monthlyNet[i] / r) * 100 : 0));
  const monthlyOpex = monthlyOpexSeries(pnlData);
  const revenueMoM = seriesMoMPercent(monthlyRevenue);
  const opexMoM = seriesMoMPercent(monthlyOpex);

  // Водопад: укрупнённые факторы к Net Profit (млн ₽) + баланс
  const startM = prevNetProfit / UNIT_DIVISOR;
  const endM = netProfit / UNIT_DIVISOR;

  const dGrossM = (gross - (sumRowPeriods(findRowExact(pnlData, EXACT.grossProfit), prevPeriodKeys))) / UNIT_DIVISOR;
  const dCommM = -((comm - prevComm) / UNIT_DIVISOR);
  const dAdminM = -((admin - prevAdmin) / UNIT_DIVISOR);
  const dItM = -((it - prevIt) / UNIT_DIVISOR);
  const dOtherOpM = (otherOp - prevOtherOp) / UNIT_DIVISOR;
  const dInterestM = -((netInterest - prevNetInterest) / UNIT_DIVISOR);
  const dTaxM = -((incomeTax - prevIncomeTax) / UNIT_DIVISOR);

  const rawBars = [
    { key: 'gross', label: 'Δ Валовая прибыль', value: dGrossM, color: '#60A5FA' },     // blue
    { key: 'comm',  label: 'Δ Коммерческие',     value: dCommM,  color: '#F59E0B' },     // orange
    { key: 'admin', label: 'Δ Административные', value: dAdminM, color: '#A78BFA' },     // purple
    { key: 'it',    label: 'Δ ИТ и связь',       value: dItM,    color: '#10B981' },     // green
    { key: 'other', label: 'Δ Прочие опер. дох/расх', value: dOtherOpM, color: '#94A3B8' }, // gray
    { key: 'int',   label: 'Δ Проценты (net)',   value: dInterestM, color: '#F87171' },  // red
    { key: 'tax',   label: 'Δ Налог на прибыль', value: dTaxM,   color: '#EF4444' }      // dark red
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

  // --- Доп. метрики для трёх новых блоков ---
  const cmr = revenue ? (gross / revenue) : 0;                  // Gross/Revenue
  const fixedApprox = admin;                                     // упрощённо как в текущей версии
  const beRevenue = cmr > 0 ? (fixedApprox / cmr) : 0;
  const safetyPct = revenue ? ((revenue - beRevenue) / revenue) * 100 : 0;
  const safetyM = (revenue - beRevenue) / UNIT_DIVISOR;

  const revDeltaPct = prevRevenue ? ((revenue - prevRevenue) / Math.abs(prevRevenue)) * 100 : 0;
  const opDeltaPct  = prevOperatingProfit ? ((operatingProfit - prevOperatingProfit) / Math.abs(prevOperatingProfit)) * 100 : 0;
  const dol = (revDeltaPct && Math.abs(revDeltaPct) > 1e-6) ? (opDeltaPct / revDeltaPct) : 0;

  const sgaPct = revenue ? (sga / revenue) * 100 : 0;
  const commPctOfRev = revenue ? (comm / revenue) * 100 : 0;
  const adminPctOfRev = revenue ? (admin / revenue) * 100 : 0;

  return {
    kpi: {
      revenue:   { value: revM,     unit: 'млн ₽', ...trend(revM, prevRevM),       vsText: 'vs ПП' },
      ebitda:    { value: ebitdaM,  unit: 'млн ₽', ...trend(ebitdaM, prevEbitdaM), vsText: 'vs ПП' },
      netProfit: { value: netM,     unit: 'млн ₽', ...trend(netM, prevNetM),       vsText: 'vs ПП' },
      netMargin: { value: netMargin,unit: '%',     ...trend(netMargin, prevNetMargin), vsText: 'vs ПП' },
    },
    charts: {
      profitabilityTrend: {
        labels: RU_MONTHS,
        datasets: [
          { label: 'Валовая',      data: monthlyGrossMargin, tension: 0.35, borderWidth: 2.5 },
          { label: 'Операционная', data: monthlyOpMargin,    tension: 0.35, borderWidth: 2.5 },
          { label: 'Чистая',       data: monthlyNetMargin,   tension: 0.35, borderWidth: 2.5 },
        ],
        info: 'Показывает, как меняется доля прибыли на разных уровнях (валовая, операционная, чистая) относительно выручки.',
      },
      costGrowth: {
        labels: RU_MONTHS,
        datasets: [
          { label: 'Revenue MoM', data: revenueMoM, backgroundColor: '#60A5FA' },
          { label: 'OPEX MoM',    data: opexMoM,    backgroundColor: '#F87171' },
        ],
        info: 'Отражает, с какой скоростью растут доходы и операционные расходы по месяцам.',
      },
      opexStructure: {
        labels: opexBreak.categories.map((c) => c.label),
        datasets: [{ data: opexBreak.categories.map((c) => c.value / UNIT_DIVISOR) }],
        info: 'Это все затраты, связанные с основной деятельностью компании, кроме затрат на производство товаров.',
      },
      waterfall: {
        labels: wfLabels,
        pairs: wfPairs,
        tooltip: wfTooltip,
        colors: wfBarColors,
        info: 'Показывает, какие причины и показатели повлияли на изменение прибыли относительно плана.',
      },
      safetyMargin: {
        revenueM: revM,
        beRevenueM: beRevenue / UNIT_DIVISOR,
        safetyPct,
        safetyM,
        info: 'Показывает, на сколько процентов может упасть выручка, прежде чем компания начнёт работать в убыток.\nCMR ≈ Валовая/Выручка; BE Rev = Фикс. затраты / CMR.',
      },
      operatingLeverage: {
        revChangePct: revDeltaPct,
        opChangePct: opDeltaPct,
        dol,
        info: `Показывает, насколько изменение выручки влияет на изменение операционной прибыли.\nDOL ≈ ΔOpProfit% / ΔRevenue% = ${fmt(dol, 2)}`,
      },
      sgaRatio: {
        commPctOfRev,
        adminPctOfRev,
        sgaPct,
        info: 'Доля затрат на продажи (Коммерческие) и административные расходы в общей выручке.\nSG&A = Коммерческие + Административные.',
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

// KPI карточки и графики с info-tip
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

// ===== Графики (Chart.js) =====
let charts = {};
function destroyCharts() { Object.values(charts).forEach((ch) => ch?.destroy?.()); charts = {}; }
function initCharts(chartData) {
  if (!window.Chart) return;
  destroyCharts();

  // Компактные легенды
  const compactLegend = { position: 'bottom', labels: { padding: 6, boxWidth: 10, boxHeight: 10 } };

  // 1) Динамика рентабельности
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

  // 2) Темпы роста (Revenue vs OPEX MoM)
  const el2 = document.getElementById('costGrowthChart');
  if (el2) {
    charts.costGrowth = new Chart(el2.getContext('2d'), {
      type: 'bar',
      data: { labels: chartData.costGrowth.labels, datasets: chartData.costGrowth.datasets },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: compactLegend },
        scales: { y: { ticks: { callback: (v) => `${v}%` } } },
      },
    });
  }

  // 3) Факторы изменения (водопад) — плавающие столбики + читабельные тултипы + фикс‑цвета + баланс
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
                if (meta.type === 'start')  return `Старт: ${fmt(meta.value, 2)} млн ₽`;
                if (meta.type === 'finish') return `Финиш: ${fmt(meta.value, 2)} млн ₽`;
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

  // 4) Операционные расходы (уменьшен диаметр)
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
        responsive: true, maintainAspectRatio: false, cutout: '66%',
        plugins: { legend: compactLegend, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)} млн ₽` } } },
      },
    });
  }

  // 5) Запас фин. прочности — Факт vs BE
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

  // 6) Операционный рычаг — Δ Revenue % vs Δ Op. Profit %
  const elDOL = document.getElementById('operatingLeverageChart');
  if (elDOL) {
    charts.dol = new Chart(elDOL.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['Текущий vs Предыдущий период'],
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

  // 7) SG&A к выручке — Коммерческие% + Административные% (stacked %)
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
    if (state.periodType === 'year') return { periodKeys: MONTH_KEYS.slice(1), prevPeriodKeys: [] };
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
    // Числовые метрики для футеров (2 знака после запятой)
    const safetyStr = `${fmt2(metrics.charts.safetyMargin.safetyPct)}%`;
    const dolStr = `${fmtSigned(metrics.charts.operatingLeverage.dol, 2)}x`;
    const sgaStr = `${fmt2(metrics.charts.sgaRatio.sgaPct)}%`;

    const safetyFooter = `
      <div class="metric-footer">
        <div class="metric-chip"><span class="label">Safety</span><span class="value">${safetyStr}</span></div>
      </div>`;
    const dolFooter = `
      <div class="metric-footer">
        <div class="metric-chip"><span class="label">DOL</span><span class="value">${dolStr}</span></div>
      </div>`;
    const sgaFooter = `
      <div class="metric-footer">
        <div class="metric-chip"><span class="label">SG&A / Rev</span><span class="value">${sgaStr}</span></div>
      </div>`;

    container.innerHTML = `
      <div class="analytics-page">
        ${createHeaderHTML(state)}
        <div class="analytics-grid analytics-grid--kpi">
          ${createTopKpiCardHTML('Чистая прибыль', 'Net Profit.', 'gem', metrics.kpi.netProfit, 'Прибыль компании после вычета всех расходов, включая налоги и проценты по кредитам.')}
          ${createTopKpiCardHTML('Чистая рентабельность', 'Net Profit Margin.', 'percent', metrics.kpi.netMargin, 'Доля чистой прибыли в выручке, показывает, сколько компания зарабатывает с каждого рубля продаж.')}
          ${createTopKpiCardHTML('Выручка', 'Revenue', 'dollar-sign', metrics.kpi.revenue, 'Общая сумма денег, полученных от продажи товаров или услуг за период.')}
          ${createTopKpiCardHTML('EBITDA', 'Operating Proxy', 'shield', metrics.kpi.ebitda, 'Показатель прибыли до вычета процентов, налогов и амортизации — отражает операционную прибыль без учета не денежных расходов.')}
        </div>

        <div class="analytics-grid analytics-grid--2-col">
          ${createChartCardHTML('profitabilityTrendChart', 'Динамика рентабельности', 'Profitability Margins Dynamics', 'activity', 'Показывает, как меняется доля прибыли на разных уровнях (валовая, операционная, чистая) относительно выручки.')}
          ${createChartCardHTML('costGrowthChart', 'Темпы роста', 'Growth Rates (Revenue vs OPEX Month-over-Month)', 'trending-up', 'Отражает, с какой скоростью растут доходы и операционные расходы по месяцам.')}
        </div>

        <div class="analytics-grid analytics-grid--3-col">
          ${createChartCardHTML('safetyMarginChart', 'Запас финансовой прочности', 'Financial Safety Margin', 'lifebuoy', 'Показывает, на сколько процентов может упасть выручка, прежде чем компания начнёт работать в убыток.\nCMR ≈ Валовая/Выручка; Точка = Фикс. затраты/CMR.', safetyFooter)}
          ${createChartCardHTML('operatingLeverageChart', 'Операционный рычаг', 'Operating Leverage', 'gauge', metrics.charts.operatingLeverage.info, dolFooter)}
          ${createChartCardHTML('sgaToRevenueChart', 'SG&A к выручке', 'SG&A to Revenue', 'percent', 'Доля затрат на продажи, общее управление и административные расходы в общей выручке.', sgaFooter)}
        </div>

        <div class="analytics-grid analytics-grid--1-1">
          ${createChartCardHTML('waterfallChart', 'Факторы изменения', 'Profit Change Factors (Profit Bridge vs Plan)', 'align-end-vertical', 'Показывает, какие причины и показатели повлияли на изменение прибыли относительно плана.')}
          ${createChartCardHTML('opexStructureChart', 'Операционные расходы', 'OPEX (Operating Expenses)', 'pie-chart', 'Это все затраты, связанные с основной деятельностью компании, кроме затрат на производство товаров.')}
        </div>
      </div>
    `;

    // Иконки → тултипы
    if (typeof refreshIcons === 'function') { try { refreshIcons(); } catch (e) {} }
    else if (window.lucide?.createIcons) { try { window.lucide.createIcons(); } catch (e) {} }
    setupInfoTooltips();

    // Диаграммы
    initCharts(metrics.charts);

    // Фильтры
    bindFilters();
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
    const metrics = calculateMetrics(state.pnlData, periodKeys, prevPeriodKeys);
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