import { refreshIcons } from '../utils.js';
import { fetchPnlData } from '../api.js';

/*
  Исправления:
  - Вернул нативные тултипы через title (без кастомного JS), чтобы они точно показывались.
  - Починил отрисовку графиков (водопад теперь использует формат [min,max], без parsing:false).
  - Добавил защиту от падений при отрисовке иконок.
  - Сохранил корректные расчёты KPI и структуру OPEX.
  - Уменьшил визуальный диаметр круговой диаграммы (cutout + высота canvas).
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
// Данные в v_pnl_2024 — в тыс. руб. → на дашборде показываем в млн ₽
const UNIT_DIVISOR = 1000;

// Точные наименования (нормализованные) для ключевых строк
const EXACT = {
  revenue: 'выручка от реализации продукции работ услуг',
  grossProfit: 'валовая прибыль',
  operatingProfit: 'операционная прибыль old',
  netProfit: 'чистая прибыль',
  ebitda: 'ebitda', // «EBITDA.» → «ebitda» после нормализации
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

const toNum = (v) => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
};

// Нормализация: NBSP → пробел, нижний регистр, убираем пунктуацию, сжимаем пробелы
const norm = (s) =>
  String(s ?? '')
    .replace(/\u00A0/g, ' ')
    .toLowerCase()
    .replace(/[«»"'.(),/\\:\-\u2013\u2014]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const eq = (a, b) => norm(a) === norm(b);

// Поиск строки по точному совпадению (по нормализованному названию)
function findRowExact(pnlData, exactNormalized) {
  return pnlData.find((r) => norm(r[LABEL_FIELD]) === exactNormalized) || null;
}

// Сумма по периодам для строки
function sumRowPeriods(row, periodKeys) {
  if (!row || !Array.isArray(periodKeys)) return 0;
  return periodKeys.reduce((acc, p) => acc + toNum(row[p]), 0);
}

// Сумма по множеству строк, отобранных по предикату
function sumWhere(pnlData, periodKeys, predicate) {
  return pnlData.reduce((acc, r) => (predicate(r) ? acc + sumRowPeriods(r, periodKeys) : acc), 0);
}

// Получить помесячный ряд по строке
function monthlySeries(row) {
  return MONTH_KEYS.slice(1).map((p) => (row ? toNum(row[p]) : 0));
}

// MoM в процентах
function seriesMoMPercent(arr) {
  return arr.map((v, i) => {
    if (i === 0) return 0;
    const prev = arr[i - 1];
    return prev ? ((v - prev) / Math.abs(prev)) * 100 : 0;
  });
}

// ===== OPEX классификация (исключаем производственные/логистические) =====
function isProductionOrLogistics(labelN) {
  return (
    labelN.includes('производ') || labelN.includes('произв') ||
    labelN.includes('логистик') || labelN.includes('доставка') ||
    labelN.includes('перевозк') || labelN.includes('таможенн') ||
    labelN.includes('входящая логистика') || labelN.includes('исходящая логистика')
  );
}

function classifyOpexLabel(L, hasCommAgg, hasAdminAgg) {
  if (isProductionOrLogistics(L)) return null;

  // Коммерческие
  if (hasCommAgg && eq(L, 'расходы по продаже продукции')) return 'commercial';
  if (!hasCommAgg && (
    L.startsWith('реклама') ||
    L.startsWith('выставоч') ||
    L.includes('маркетинг') ||
    L.includes('маркетингов') ||
    L.includes('акции') ||
    L.includes('федеральная рекламная') ||
    L.includes('прочие маркетинговые') ||
    L.startsWith('активация продаж')
  )) return 'commercial';

  // Административные (агрегат + HR КУ)
  if (hasAdminAgg && eq(L, 'расходы на оплату труда и затраты на коммерческий и административный персонал')) return 'admin';
  if (!hasAdminAgg && (
    L.startsWith('фот коммерческий и управленческий персонал') ||
    L.startsWith('прочие выплаты и расходы на ку персонал') ||
    L.startsWith('питание ку персонал') ||
    L.startsWith('доставка ку персонала') ||
    L.startsWith('расходы по охране труда ку персонал') ||
    L.startsWith('прочие расходы на организацию труда ку персонал') ||
    L.startsWith('начисления на заработную плату коммерческого и административного персонала') ||
    L === 'прочие административные расходы'
  )) return 'admin';

  // Аренда и коммунальные (офис)
  if (
    (L.includes('аренд') && (L.includes('офис') || L.includes('инфраструктура') || L.includes('основных средств'))) ||
    L.startsWith('аренда тс') ||
    L.startsWith('энергетика офисн инфраструктура') ||
    L.startsWith('электроэнергия офисн инфраструктура') ||
    L.startsWith('вода холодная офисн инфраструктура') ||
    L.startsWith('отопление офисн инфраструктура')
  ) return 'rent_utils';

  // Обслуживание и ремонт
  if (
    L.startsWith('ремонт и техническое обслуживание офисных зданий и сооружений') ||
    L.startsWith('текущий ремонт офисных зданий и сооружений') ||
    L === 'ремонт оргтехники' ||
    L.includes('прочие расходы на содержание служебного транспорта')
  ) return 'repairs';

  // ИТ и связь
  if (
    L.startsWith('программное обеспечение и сопровождение программ') ||
    L.startsWith('лицензии за использование по') ||
    L.startsWith('техническая поддержка по и систем') ||
    L.startsWith('услуги по развитию по') ||
    L.startsWith('услуги связи') ||
    L.includes('интернет') ||
    L.includes('эл почта') ||
    L.startsWith('услуги доступа к информационным продуктам') ||
    L === 'почтовые услуги' ||
    L === 'прочие услуги связи'
  ) return 'it';

  // Транспорт (адм.)
  if (
    L.startsWith('расходы на содержание служебного транспорта') ||
    L.startsWith('топливо cлужебный') ||
    L.startsWith('ремонт и то а м') ||
    L.startsWith('медосмотр водителей') ||
    L.startsWith('расходные материалы для а м') ||
    L.startsWith('аренда тс')
  ) return 'transport';

  // Прочие офисные/адм. услуги и налоги
  if (
    L.startsWith('услуги управления и прочие услуги') ||
    L === 'юридические услуги' ||
    L.startsWith('экономические бухгалтерские услуги') ||
    L === 'содержание франчайзинговой сети' ||
    (L.startsWith('прочие услуги') && !L.endsWith('связи')) ||
    L === 'представительские расходы' ||
    L === 'командировочные расходы' ||
    L === 'налог на имущество' ||
    L === 'транспортный налог' ||
    L === 'госпошлина' ||
    L.startsWith('обеспечение офисных мест мебелью') ||
    L.startsWith('обеспечение рабочих мест оргтехникой') ||
    L.startsWith('расходы на оргтехнику до') ||
    L === 'расходные материалы' ||
    L === 'офисное обеспечение' ||
    L === 'бумага' ||
    L.includes('канцелярские') ||
    L === 'печатная продукция' ||
    L === 'вода питьевая' ||
    L === 'прочие офисные расходы' ||
    L === 'экологический налог' ||
    L === 'земельный налог' ||
    L === 'списание рбп и нма'
  ) return 'other';

  return null;
}

function buildOpexBreakdown(pnlData, periodKeys) {
  const hasCommAgg = pnlData.some((r) => eq(r[LABEL_FIELD], 'расходы по продаже продукции'));
  const hasAdminAgg = pnlData.some((r) =>
    eq(r[LABEL_FIELD], 'расходы на оплату труда и затраты на коммерческий и административный персонал')
  );

  const buckets = {
    commercial: 0, admin: 0, rent_utils: 0, repairs: 0, it: 0, transport: 0, other: 0,
  };

  for (const r of pnlData) {
    const L = norm(r[LABEL_FIELD]);
    const cat = classifyOpexLabel(L, hasCommAgg, hasAdminAgg);
    if (!cat) continue;
    buckets[cat] += sumRowPeriods(r, periodKeys);
  }

  return {
    categories: [
      { key: 'commercial', label: 'Коммерческие', value: buckets.commercial },
      { key: 'admin', label: 'Административные', value: buckets.admin },
      { key: 'rent_utils', label: 'Аренда и коммунальные', value: buckets.rent_utils },
      { key: 'repairs', label: 'Обслуживание и ремонт', value: buckets.repairs },
      { key: 'it', label: 'ИТ и связь', value: buckets.it },
      { key: 'transport', label: 'Транспорт (адм.)', value: buckets.transport },
      { key: 'other', label: 'Прочие', value: buckets.other },
    ],
  };
}

// Месячный OPEX (для графика «Темпы роста»: Revenue vs OPEX MoM)
function monthlyOpexSeries(pnlData) {
  const hasCommAgg = pnlData.some((r) => eq(r[LABEL_FIELD], 'расходы по продаже продукции'));
  const hasAdminAgg = pnlData.some((r) =>
    eq(r[LABEL_FIELD], 'расходы на оплату труда и затраты на коммерческий и административный персонал')
  );
  const arr = new Array(12).fill(0);
  for (const r of pnlData) {
    const L = norm(r[LABEL_FIELD]);
    const cat = classifyOpexLabel(L, hasCommAgg, hasAdminAgg);
    if (!cat) continue;
    MONTH_KEYS.slice(1).forEach((p, i) => {
      arr[i] += toNum(r[p]);
    });
  }
  return arr;
}

// ===== Основной расчёт =====
function calculateMetrics(pnlData, periodKeys, prevPeriodKeys = []) {
  // Точные строки
  const rowRevenue = findRowExact(pnlData, EXACT.revenue);
  const rowGross = findRowExact(pnlData, EXACT.grossProfit);
  const rowOp = findRowExact(pnlData, EXACT.operatingProfit);
  const rowNet = findRowExact(pnlData, EXACT.netProfit);
  const rowEbitda = findRowExact(pnlData, EXACT.ebitda);
  const rowDeprTotal = findRowExact(pnlData, EXACT.depreciationTotal);
  const rowNetInterest = findRowExact(pnlData, EXACT.netInterest);
  const rowIncomeTax = findRowExact(pnlData, EXACT.incomeTax);

  // Текущий период
  const revenue = sumRowPeriods(rowRevenue, periodKeys);
  const gross = sumRowPeriods(rowGross, periodKeys);
  const operatingProfit = sumRowPeriods(rowOp, periodKeys);
  const netProfit = sumRowPeriods(rowNet, periodKeys);

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

  // Предыдущий период
  const prevRevenue = sumRowPeriods(rowRevenue, prevPeriodKeys);
  const prevGross = sumRowPeriods(rowGross, prevPeriodKeys);
  const prevOperatingProfit = sumRowPeriods(rowOp, prevPeriodKeys);
  const prevNetProfit = sumRowPeriods(rowNet, prevPeriodKeys);
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

  // OPEX структура для текущего/предыдущего периода
  const opexBreak = buildOpexBreakdown(pnlData, periodKeys);
  const opexBreakPrev = buildOpexBreakdown(pnlData, prevPeriodKeys);

  // Прочие опер. дох/расх
  const otherOp = sumWhere(pnlData, periodKeys, (r) => {
    const L = norm(r[LABEL_FIELD]);
    return (
      eq(L, EXACT.otherOperating) ||
      eq(L, EXACT.otherOperating2) ||
      eq(L, EXACT.assetOps)
    );
  });
  const prevOtherOp = sumWhere(pnlData, prevPeriodKeys, (r) => {
    const L = norm(r[LABEL_FIELD]);
    return (
      eq(L, EXACT.otherOperating) ||
      eq(L, EXACT.otherOperating2) ||
      eq(L, EXACT.assetOps)
    );
  });

  const netInterest = sumRowPeriods(rowNetInterest, periodKeys);
  const prevNetInterest = sumRowPeriods(rowNetInterest, prevPeriodKeys);
  const incomeTax = sumRowPeriods(rowIncomeTax, periodKeys);
  const prevIncomeTax = sumRowPeriods(rowIncomeTax, prevPeriodKeys);

  // KPI (млн ₽)
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

  // Серии для графиков
  const monthlyRevenue = monthlySeries(rowRevenue);
  const monthlyNet = monthlySeries(rowNet);
  const monthlyOp = monthlySeries(rowOp);

  // Амортизация для помесячного EBITDA (если нет прямой строки)
  const monthlyDepr = rowDeprTotal ? monthlySeries(rowDeprTotal) : MONTH_KEYS.slice(1).map(() => 0);
  const monthlyEbitda = rowEbitda ? monthlySeries(rowEbitda) : monthlyOp.map((v, i) => v + (monthlyDepr[i] || 0));

  const monthlyGross = monthlySeries(rowGross);
  const monthlyGrossMargin = monthlyRevenue.map((r, i) => (r ? (monthlyGross[i] / r) * 100 : 0));
  const monthlyOpMargin = monthlyRevenue.map((r, i) => (r ? (monthlyOp[i] / r) * 100 : 0));
  const monthlyNetMargin = monthlyRevenue.map((r, i) => (r ? (monthlyNet[i] / r) * 100 : 0));

  // «Темпы роста»: Revenue vs OPEX MoM
  const monthlyOpex = monthlyOpexSeries(pnlData);
  const revenueMoM = seriesMoMPercent(monthlyRevenue);
  const opexMoM = seriesMoMPercent(monthlyOpex);

  // Водопад: от Net(prev) к Net(cur)
  const dGross = (sumRowPeriods(rowGross, periodKeys) - sumRowPeriods(rowGross, prevPeriodKeys)) / UNIT_DIVISOR;
  const dCategories = opexBreak.categories.map((c, idx) => {
    const prev = opexBreakPrev.categories[idx]?.value || 0;
    return { label: `Δ ${c.label}`, value: -((c.value - prev) / UNIT_DIVISOR) };
  });
  const dOtherOp = (otherOp - prevOtherOp) / UNIT_DIVISOR;
  const dInterest = -((netInterest - prevNetInterest) / UNIT_DIVISOR);
  const dTax = -((incomeTax - prevIncomeTax) / UNIT_DIVISOR);

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
        title: 'Динамика рентабельности',
        subtitle: 'Profitability Margins Dynamics',
        info: 'Показывает, как меняется доля прибыли на разных уровнях (валовая, операционная, чистая) относительно выручки.',
      },
      costGrowth: {
        labels: RU_MONTHS,
        datasets: [
          { label: 'Revenue MoM', data: revenueMoM, backgroundColor: '#60A5FA' },
          { label: 'OPEX MoM',    data: opexMoM,    backgroundColor: '#F87171' },
        ],
        title: 'Темпы роста',
        subtitle: 'Growth Rates (Revenue vs OPEX Month-over-Month)',
        info: 'Отражает, с какой скоростью растут доходы и операционные расходы по месяцам.',
      },
      opexStructure: {
        labels: opexBreak.categories.map((c) => c.label),
        datasets: [{ data: opexBreak.categories.map((c) => c.value / UNIT_DIVISOR) }],
        title: 'Операционные расходы',
        subtitle: 'OPEX (Operating Expenses)',
        info: 'Это все затраты, связанные с основной деятельностью компании, кроме затрат на производство товаров.',
      },
      waterfall: {
        start: (prevNetProfit / UNIT_DIVISOR),
        bars: [
          { label: 'Δ Валовая прибыль', value: dGross },
          ...dCategories,
          { label: 'Δ Прочие опер. дох/расх', value: dOtherOp },
          { label: 'Δ Проценты (net)',        value: dInterest },
          { label: 'Δ Налог на прибыль',     value: dTax },
        ],
        end: (netProfit / UNIT_DIVISOR),
        title: 'Факторы изменения',
        subtitle: 'Profit Change Factors (Profit Bridge vs Plan)',
        info: 'Показывает, какие причины и показатели повлияли на изменение прибыли относительно плана.',
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
        <i data-lucide="info" class="info-icon" title="${info ? String(info).replace(/"/g,'&quot;') : ''}"></i>
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

function createChartCardHTML(id, title, subtitle, icon, info) {
  return `
    <div class="analytics-chart card">
      <div class="analytics-chart__header">
        <i data-lucide="${icon}"></i>
        <div class="analytics-chart__title-block">
          <h3 class="analytics-chart__title">${title}</h3>
          <div class="analytics-chart__subtitle">${subtitle}</div>
        </div>
        <i data-lucide="info" class="info-icon" title="${info ? String(info).replace(/"/g,'&quot;') : ''}"></i>
      </div>
      <div class="analytics-chart__body">
        <canvas id="${id}"></canvas>
      </div>
    </div>
  `;
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

  // 1) Динамика рентабельности
  try {
    const el = document.getElementById('profitabilityTrendChart');
    if (el) {
      charts.profitabilityTrend = new Chart(el.getContext('2d'), {
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
          plugins: { legend: { position: 'bottom' } },
          scales: { y: { ticks: { callback: (v) => `${v}%` } } },
        },
      });
    }
  } catch (e) { console.error('Chart error: profitabilityTrend', e); }

  // 2) Темпы роста (Revenue vs OPEX MoM)
  try {
    const el = document.getElementById('costGrowthChart');
    if (el) {
      charts.costGrowth = new Chart(el.getContext('2d'), {
        type: 'bar',
        data: {
          labels: chartData.costGrowth.labels,
          datasets: chartData.costGrowth.datasets,
        },
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { position: 'bottom' } },
          scales: { y: { ticks: { callback: (v) => `${v}%` } } },
        },
      });
    }
  } catch (e) { console.error('Chart error: costGrowth', e); }

  // 3) Факторы изменения (водопад) — используем «floating bars» через массивы [low, high]
  try {
    const el = document.getElementById('waterfallChart');
    if (el) {
      const start = chartData.waterfall.start || 0;
      const deltas = chartData.waterfall.bars || [];
      const end = chartData.waterfall.end || 0;

      const labels = ['Старт', ...deltas.map((b) => b.label), 'Финиш'];
      const pairs = [];
      let cursor = start;
      pairs.push([start, start]); // старт
      deltas.forEach((b) => {
        const next = cursor + b.value;
        pairs.push([Math.min(cursor, next), Math.max(cursor, next)]);
        cursor = next;
      });
      pairs.push([end, end]); // финиш

      charts.waterfall = new Chart(el.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Переход',
              data: pairs, // массивы [low, high] — встроенная поддержка Chart.js для плавающих столбиков
              backgroundColor: pairs.map((p, i) => {
                if (i === 0 || i === pairs.length - 1) return '#9CA3AF';
                const delta = p[1] - p[0];
                return delta >= 0 ? '#34D399' : '#F87171';
              }),
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { y: { title: { display: true, text: 'млн ₽' } } },
        },
      });
    }
  } catch (e) { console.error('Chart error: waterfall', e); }

  // 4) Операционные расходы (уменьшен диаметр)
  try {
    const el = document.getElementById('opexStructureChart');
    if (el) {
      const parent = el.parentElement;
      if (parent) parent.style.minHeight = '240px';
      el.style.height = '200px';

      charts.opex = new Chart(el.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: chartData.opexStructure.labels,
          datasets: [{
            data: chartData.opexStructure.datasets[0].data,
            backgroundColor: ['#60A5FA', '#F59E0B', '#A78BFA', '#34D399', '#F87171', '#10B981', '#9CA3AF'],
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '66%',
          plugins: {
            legend: { position: 'bottom' },
            tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.raw)} млн ₽` } },
          },
        },
      });
    }
  } catch (e) { console.error('Chart error: opex', e); }
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
          ${createTopKpiCardHTML(
            'Чистая прибыль', 'Net Profit.', 'gem', metrics.kpi.netProfit,
            'Прибыль компании после вычета всех расходов, включая налоги и проценты по кредитам.'
          )}
          ${createTopKpiCardHTML(
            'Чистая рентабельность', 'Net Profit Margin.', 'percent', metrics.kpi.netMargin,
            'Доля чистой прибыли в выручке: сколько компания зарабатывает с каждого рубля продаж.'
          )}
          ${createTopKpiCardHTML(
            'Выручка', 'Revenue', 'dollar-sign', metrics.kpi.revenue,
            'Общая сумма денег, полученных от продажи товаров или услуг за период.'
          )}
          ${createTopKpiCardHTML(
            'EBITDA', 'Operating Proxy', 'shield', metrics.kpi.ebitda,
            'Показатель прибыли до вычета процентов, налогов и амортизации — отражает операционную прибыль без учёта неденежных расходов.'
          )}
        </div>

        <div class="analytics-grid analytics-grid--2-col">
          ${createChartCardHTML(
            'profitabilityTrendChart', 'Динамика рентабельности', 'Profitability Margins Dynamics', 'activity',
            'Показывает, как меняется доля прибыли на разных уровнях (валовая, операционная, чистая) относительно выручки.'
          )}
          ${createChartCardHTML(
            'costGrowthChart', 'Темпы роста', 'Growth Rates (Revenue vs OPEX Month-over-Month)', 'trending-up',
            'Отражает, с какой скоростью растут доходы и операционные расходы по месяцам.'
          )}
        </div>

        <div class="analytics-grid analytics-grid--3-col">
          ${createChartCardHTML(
            'safetyMarginChart', 'Запас финансовой прочности', 'Financial Safety Margin', 'lifebuoy',
            'Показывает, на сколько процентов может упасть выручка, прежде чем компания начнёт работать в убыток.'
          )}
          ${createChartCardHTML(
            'operatingLeverageChart', 'Операционный рычаг', 'Operating Leverage', 'gauge',
            'Показывает, насколько изменение выручки влияет на изменение операционной прибыли.'
          )}
          ${createChartCardHTML(
            'sgaToRevenueChart', 'SG&A к выручке', 'SG&A to Revenue', 'percent',
            'Доля затрат на продажи, общее управление и административные расходы в выручке.'
          )}
        </div>

        <div class="analytics-grid analytics-grid--1-1">
          ${createChartCardHTML(
            'waterfallChart', 'Факторы изменения', 'Profit Change Factors (Profit Bridge vs Plan)', 'align-end-vertical',
            'Показывает, какие причины и показатели повлияли на изменение прибыли относительно плана.'
          )}
          ${createChartCardHTML(
            'opexStructureChart', 'Операционные расходы', 'OPEX (Operating Expenses)', 'pie-chart',
            'Это все затраты, связанные с основной деятельностью компании, кроме затрат на производство товаров.'
          )}
        </div>
      </div>
    `;

    // Иконки
    try {
      if (typeof refreshIcons === 'function') refreshIcons();
      else if (window.lucide?.createIcons) window.lucide.createIcons();
    } catch (e) {
      console.warn('Icons render warning:', e);
    }

    initCharts(metrics.charts);
    bindFilters();
  }

  function updateDashboard() {
    if (!state.pnlData?.length) {
      container.innerHTML = `
        <div class="card module-placeholder error">
          Нет данных PnL за ${state.year}. Проверьте доступ к view v_pnl_${state.year}.
        </div>
      `;
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
        </div>
      `;
    }
  }

  await loadDataAndRender();
}