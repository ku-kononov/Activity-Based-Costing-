// js/pages/ibp.js
import { supabase } from '../api.js';

// ==============================
// Вспомогательные утилиты/константы
// ==============================
const RU_MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
const RU_MONTHS_NORM = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

const nf = (v, d = 1) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number.isFinite(v) ? v : 0);
const nf0 = (v) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Number.isFinite(v) ? v : 0);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const cssVar = (name, fallback = '#1f2937') => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
};

const color = {
  text: () => cssVar('--text', '#1f2937'),
  muted: () => cssVar('--muted', '#6B7280'),
  grid: () => {
    const base = cssVar('--divider', '#E5E7EB');
    // чуть «мягче» сетка
    return base.includes('rgb') || base.includes('#') ? base : 'rgba(148,163,184,.25)';
  },
  blue: '#4A89F3',
  blueFill: 'rgba(74,137,243,0.85)',
  green: '#10B981',
  greenFill: 'rgba(16,185,129,0.85)',
  orange: '#F59E0B'
};

const unitsFor = (maxAbs) => {
  if (maxAbs >= 1e9) return { k: 1e9, label: 'млрд ₽' };
  if (maxAbs >= 1e6) return { k: 1e6, label: 'млн ₽' };
  if (maxAbs >= 1e3) return { k: 1e3, label: 'тыс ₽' };
  return { k: 1, label: '₽' };
};

const normKey = (s) => String(s ?? '')
  .toLowerCase()
  .replace(/\u00A0/g,' ')
  .replace(/[«»"'.,/\\:\-\u2013\u2014\s]/g, ''); // удаляем пробелы/знаки

// Нормализованный поиск колонок «янв .24» → «янв24»
function extractMonthly(row, year) {
  const keys = Object.keys(row || {});
  const y2 = String(year).slice(-2);
  const values = new Array(12).fill(0);
  for (let i = 0; i < 12; i++) {
    const target = `${RU_MONTHS_NORM[i]}${y2}`; // напр. янв24
    const key = keys.find(k => normKey(k) === target);
    const v = key ? Number(row[key] ?? 0) : 0;
    values[i] = Number.isFinite(v) ? v : 0;
  }
  return values;
}

function toQuarters(arr) {
  return [
    (arr[0] ?? 0) + (arr[1] ?? 0) + (arr[2] ?? 0),
    (arr[3] ?? 0) + (arr[4] ?? 0) + (arr[5] ?? 0),
    (arr[6] ?? 0) + (arr[7] ?? 0) + (arr[8] ?? 0),
    (arr[9] ?? 0) + (arr[10] ?? 0) + (arr[11] ?? 0),
  ];
}

function findTotalKey(row, year) {
  const y = String(year);
  const keys = Object.keys(row || {});
  const candidates = keys.filter(k => {
    const n = normKey(k);
    return n === `итого${y}` || n === `итого${y.slice(-2)}` || n.startsWith('итого') || n.startsWith('total');
  });
  return candidates[0] || null;
}

// «красивые» тики для оси Y (валюта)
function niceScale(maxValue, ticks = 5) {
  const clean = Math.abs(maxValue || 1);
  const roughStep = clean / Math.max(1, ticks);
  const pow10 = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const steps = [1, 2, 2.5, 5, 10].map(m => m * pow10);
  const step = steps.find(s => s >= roughStep) || steps[steps.length - 1];
  const niceMax = Math.ceil(clean / step) * step;
  return { niceMax, step };
}

// ==============================
// Стили и подсказка (инфо-иконка)
// ==============================
function injectEbitdaStyles() {
  if (document.getElementById('ebitda-modern-styles')) return;
  const style = document.createElement('style');
  style.id = 'ebitda-modern-styles';
  style.textContent = `
    .ebitda-chart-modern {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      box-shadow: var(--shadow);
      overflow: hidden;
      position: relative;
    }
    .ebitda-chart-header {
      display:flex; align-items:center; justify-content:space-between; gap:12px;
      padding: 18px 20px; border-bottom:1px solid var(--border);
      background: linear-gradient(135deg, var(--surface) 0%, rgba(0,179,158,0.05) 100%);
    }
    .ebitda-left { display:flex; align-items:center; gap:12px; min-width:0; }
    .ebitda-chart-icon { width:26px; height:26px; color: var(--blue); flex:0 0 auto; }
    .ebitda-titles { display:flex; flex-direction:column; gap:2px; min-width:0; }
    .ebitda-title { margin:0; font-size:16px; font-weight:700; color: var(--text); line-height:1.2; }
    .ebitda-subtitle { margin:0; font-size:12px; color: var(--muted); text-transform:uppercase; }

    .ebitda-controls { display:flex; align-items:center; gap:12px; margin-left:auto; }
    .ebitda-filter { display:flex; align-items:center; gap:8px; }
    .ebitda-filter label { font-size:12px; font-weight:600; color: var(--muted); }
    .ebitda-select {
      padding:6px 10px; border:1px solid var(--border); border-radius:10px;
      background: var(--surface); color: var(--text); font-size:13px; font-weight:600;
    }
    .ebitda-select:focus { outline:none; border-color: var(--accent); box-shadow: 0 0 0 2px rgba(0,179,158,0.15); }

    .ebitda-view { display:flex; border:1px solid var(--border); border-radius:10px; overflow:hidden; }
    .ebitda-view button {
      padding:6px 12px; border:none; background:transparent; color: var(--muted);
      font-weight:700; font-size:12px; cursor:pointer; transition:all .15s;
    }
    .ebitda-view button.active { background: var(--surface); color: var(--text); box-shadow: var(--shadow); }

    .ebitda-metric {
      display:flex; align-items:center; gap:8px; padding:6px 10px; border:1px solid var(--border);
      border-radius:999px; background: var(--surface); font-weight:800; color: var(--text); font-variant-numeric: tabular-nums;
    }
    .ebitda-metric .lbl { font-size:11px; color: var(--muted); text-transform:uppercase; }
    .ebitda-metric .val { font-size:14px; color: var(--accent); }

    .info-tip {
      width:32px; height:32px; display:grid; place-items:center; border-radius:10px;
      border:1px solid var(--border); color: var(--muted); cursor:pointer; background: var(--surface);
    }
    .info-tip:hover { color: var(--text); border-color: var(--accent); }
    .info-tip i { width:18px; height:18px; color: currentColor; }

    .ebitda-chart-body { position:relative; padding: 14px 16px 18px; min-height: 300px; }

    /* HTML tooltip для Chart.js */
    .chartjs-ext-tooltip {
      position:absolute; pointer-events:none; opacity:0; transform: translateY(-4px);
      background: rgba(23,26,31,.98); color:#fff; padding:10px 12px; border-radius:10px;
      border:1px solid rgba(255,255,255,.08); box-shadow: 0 10px 24px rgba(0,0,0,.25);
      transition: opacity .12s ease, transform .12s ease;
      max-width: min(420px, calc(100% - 24px)); z-index: 5; font-size:13px; line-height:1.5;
      white-space: normal; word-break: break-word;
    }
    .chartjs-ext-tooltip .title { font-weight:800; margin:0 0 6px; opacity:.9; }
    .chartjs-ext-tooltip .row { display:flex; align-items:center; gap:8px; margin: 2px 0; }
    .chartjs-ext-tooltip .marker { width:8px; height:8px; border-radius:2px; display:inline-block; }
    .chartjs-ext-tooltip .val { font-weight:700; }
    .chartjs-ext-tooltip .percent { color:#F59E0B; font-weight:800; }

    /* Подсказка в хедере (по клику) */
    .ebitda-tip-bubble {
      position: absolute; right: 12px; top: 56px; z-index: 6;
      max-width: min(560px, calc(100% - 24px));
      background: rgba(17,24,39,.98); color:#fff; border:1px solid rgba(255,255,255,.08);
      border-radius: 12px; padding: 12px 14px; line-height:1.6; box-shadow: 0 12px 28px rgba(0,0,0,.32);
      font-size: 14px; display: none;
    }
    .ebitda-tip-bubble.is-open { display:block; }

    /* Dark compat (используем те же переменные) */
    :root[data-theme="dark"] .chartjs-ext-tooltip { background: rgba(17,20,24,.98); border-color: var(--border); }
  `;
  document.head.appendChild(style);
}

// Подсказка в заголовке по клику (не «ездит» за курсором, не вылезает за экран)
function bindInfoTip(card) {
  const tipBtn = card.querySelector('#ebitda-tip');
  if (!tipBtn) return;
  const bubble = document.createElement('div');
  bubble.className = 'ebitda-tip-bubble';
  bubble.innerHTML = `
    Отношение EBITDA к выручке. Этот показатель показывает, какую часть от выручки компания сохраняет
    в виде операционной прибыли до учета процентов, налогов, износа и амортизации. Чем выше EBITDA Margin,
    тем эффективнее работает бизнес.
  `;
  card.appendChild(bubble);

  function toggle(open) {
    bubble.classList.toggle('is-open', open);
    if (open) {
      const rect = bubble.getBoundingClientRect();
      // гарантируем, что не выйдет за экран
      const maxLeft = window.innerWidth - rect.width - 12;
      bubble.style.right = '12px';
      if (rect.left < 12) bubble.style.left = '12px';
      if (rect.right > window.innerWidth - 12) bubble.style.left = `${Math.max(12, window.innerWidth - rect.width - 12)}px`;
    }
  }

  tipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle(!bubble.classList.contains('is-open'));
  });
  document.addEventListener('click', () => toggle(false));
  window.addEventListener('resize', () => toggle(false));
}

// ==============================
// Загрузка данных и построение графика
// ==============================
async function fetchBoltPnlEBITDA(year = 2024) {
  if (!supabase) throw new Error('Supabase не инициализирован.');
  const table = `BOLT_PnL_${year}`;
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .in('ID', ['f1.', 'f12.']); // Выручка и EBITDA
  if (error) throw new Error(`Не удалось прочитать "${table}": ${error.message}`);
  const revenueRow = (data || []).find(r => r?.ID === 'f1.') || null;
  const ebitdaRow  = (data || []).find(r => r?.ID === 'f12.') || null;
  if (!revenueRow || !ebitdaRow) {
    throw new Error('Не найдены строки с ID=f1. (Выручка) и/или ID=f12. (EBITDA).');
  }
  return { revenueRow, ebitdaRow };
}

function buildChartData(view, revenueMonthly, ebitdaMonthly) {
  const labels = view === 'quarter' ? ['Q1','Q2','Q3','Q4'] : RU_MONTHS;
  const rev = view === 'quarter' ? toQuarters(revenueMonthly) : revenueMonthly.slice();
  const ebd = view === 'quarter' ? toQuarters(ebitdaMonthly)  : ebitdaMonthly.slice();

  // Юниты
  const maxAbs = Math.max(...rev.map(Math.abs), ...ebd.map(Math.abs), 1);
  const units = unitsFor(maxAbs);
  const revScaled = rev.map(v => v / units.k);
  const ebdScaled = ebd.map(v => v / units.k);

  // Маржинальность по точкам
  const margin = rev.map((r, i) => (r ? (ebd[i] / r) * 100 : 0));
  const minM = Math.min(...margin);
  const maxM = Math.max(...margin);

  // Настройка осей
  const desiredTicks = 5;
  const { niceMax, step } = niceScale(Math.max(...revScaled, ...ebdScaled), desiredTicks);
  const yMax = niceMax;
  const yStep = step;

  const y1Min = Math.floor(Math.min(0, minM) / 10) * 10;
  const y1Max = Math.ceil(Math.max(20, maxM) / 10) * 10;

  return {
    labels, revScaled, ebdScaled, margin,
    unitsLabel: units.label,
    yMax, yStep, y1Min, y1Max
  };
}

// Внешний HTML‑tooltip для Chart.js (контролируем доступность и позицию)
function externalTooltipHandler(context) {
  const { chart, tooltip } = context;
  const body = chart.canvas.parentNode;

  let el = body.querySelector('.chartjs-ext-tooltip');
  if (!el) {
    el = document.createElement('div');
    el.className = 'chartjs-ext-tooltip';
    body.appendChild(el);
  }

  if (tooltip.opacity === 0) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-4px)';
    return;
  }

  const title = (tooltip.title || [])[0] || '';
  const items = tooltip.dataPoints || [];

  let html = '';
  if (title) html += `<div class="title">${title}</div>`;
  for (const it of items) {
    const markerColor = it.dataset.borderColor || it.dataset.backgroundColor || '#888';
    const label = it.dataset.label || '';
    const raw = it.raw;
    const isPct = String(label).toLowerCase().includes('margin') || it.dataset.yAxisID === 'y1';
    const valStr = isPct ? `${nf(raw, 2)}%` : `${nf(raw, 1)} ${chart.config._unitsLabel || ''}`;
    html += `<div class="row"><span class="marker" style="background:${markerColor}"></span><span>${label}</span><span class="val">${valStr}</span></div>`;
  }
  el.innerHTML = html;

  const canvasRect = chart.canvas.getBoundingClientRect();
  const parentRect = body.getBoundingClientRect();
  const padding = 8;

  // позиция внутри родителя (card body)
  const x = canvasRect.left + tooltip.caretX - parentRect.left + 12;
  const y = canvasRect.top + tooltip.caretY - parentRect.top - el.offsetHeight - 12;

  // кламп по ширине
  const safeLeft = clamp(x, padding, body.clientWidth - el.offsetWidth - padding);
  const safeTop = y < padding ? (canvasRect.top + tooltip.caretY - parentRect.top + 12) : y;

  el.style.left = `${safeLeft}px`;
  el.style.top = `${safeTop}px`;
  el.style.opacity = '1';
  el.style.transform = 'translateY(0)';
}

function renderEbitdaChart(canvas, cfg, view) {
  if (!window.Chart || !canvas) return null;
  const ctx = canvas.getContext('2d');

  // бар‑ширина под представление
  const maxBar = view === 'quarter' ? 36 : 22;
  const catPct = view === 'quarter' ? 0.6 : 0.7;
  const barPct = view === 'quarter' ? 0.9 : 0.9;

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: cfg.labels,
      datasets: [
        {
          type: 'bar',
          label: 'Выручка',
          data: cfg.revScaled,
          backgroundColor: color.blueFill,
          borderColor: color.blue,
          borderWidth: 1,
          borderRadius: 8,
          maxBarThickness: maxBar,
          categoryPercentage: catPct,
          barPercentage: barPct,
          yAxisID: 'y',
          order: 2
        },
        {
          type: 'bar',
          label: 'EBITDA',
          data: cfg.ebdScaled,
          backgroundColor: color.greenFill,
          borderColor: color.green,
          borderWidth: 1,
          borderRadius: 8,
          maxBarThickness: maxBar,
          categoryPercentage: catPct,
          barPercentage: barPct,
          yAxisID: 'y',
          order: 2
        },
        {
          type: 'line',
          label: 'EBITDA Margin',
          data: cfg.margin,
          borderColor: color.orange,
          backgroundColor: 'transparent',
          pointRadius: 2.5,
          pointHoverRadius: 4,
          borderWidth: 2.5,
          tension: 0.35,
          yAxisID: 'y1',
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: color.text(),
            boxWidth: 12, boxHeight: 12, padding: 10,
            font: { size: 12, weight: '700', family: 'Inter, system-ui, sans-serif' }
          }
        },
        tooltip: {
          enabled: false,
          external: (ctx) => externalTooltipHandler(ctx)
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: color.text(),
            font: { size: 11, weight: '700' },
            maxRotation: 0, minRotation: 0
          },
          border: { display: false }
        },
        y: {
          position: 'left',
          beginAtZero: true,
          suggestedMax: cfg.yMax,
          ticks: {
            color: color.text(),
            font: { size: 11, weight: '600' },
            stepSize: cfg.yStep,
            callback: (v) => nf0(v)
          },
          title: {
            display: true,
            text: cfg.unitsLabel,
            color: color.muted(),
            font: { size: 12, weight: '700' }
          },
          grid: {
            color: 'rgba(148,163,184,.25)',
            drawBorder: false,
            tickLength: 0
          }
        },
        y1: {
          position: 'right',
          min: cfg.y1Min,
          max: cfg.y1Max,
          ticks: {
            color: color.text(),
            font: { size: 11, weight: '600' },
            stepSize: 10,
            callback: (v) => `${nf0(v)}%`
          },
          title: {
            display: true,
            text: 'EBITDA Margin (%)',
            color: color.muted(),
            font: { size: 12, weight: '700' }
          },
          grid: { drawOnChartArea: false, drawBorder: false }
        }
      },
      layout: { padding: { top: 8, right: 8, bottom: 8, left: 8 } },
      animation: {
        duration: 800,
        easing: 'easeOutQuart'
      }
    }
  });

  // передаем юниты в tooltip (чтобы рисовать в HTML‑блоке)
  chart.config._unitsLabel = cfg.unitsLabel;
  return chart;
}

// ==============================
// Монтаж блока на страницу
// ==============================
async function mountEbitdaBlock(container) {
  injectEbitdaStyles();

  const card = container.querySelector('#ebitda-margin-card');
  const canvas = container.querySelector('#ebitdaMarginChart');
  const yearSelect = container.querySelector('#ebitda-year-select');
  const viewControl = container.querySelector('#ebitda-view-control');
  const kpiChip = container.querySelector('#ebitda-annual-chip');

  if (!card || !canvas) return;

  bindInfoTip(card);

  const state = { year: 2024, view: 'month', rows: null, chart: null };

  async function load() {
    try {
      const body = card.querySelector('.ebitda-chart-body');
      if (body) body.classList.add('is-loading');
      const { revenueRow, ebitdaRow } = await fetchBoltPnlEBITDA(state.year);
      state.rows = { revenueRow, ebitdaRow };
      update();
    } catch (e) {
      const body = card.querySelector('.ebitda-chart-body');
      if (body) body.innerHTML = `<div class="module-placeholder error">Ошибка загрузки: ${e?.message || e}</div>`;
    } finally {
      const body = card.querySelector('.ebitda-chart-body');
      if (body) body.classList.remove('is-loading');
    }
  }

  function updateKPI() {
    const { revenueRow, ebitdaRow } = state.rows || {};
    if (!revenueRow || !ebitdaRow || !kpiChip) return;

    const totalKeyRev = findTotalKey(revenueRow, state.year);
    const totalKeyEbd = findTotalKey(ebitdaRow, state.year);

    let revTotal = 0, ebdTotal = 0;
    if (totalKeyRev && totalKeyEbd) {
      revTotal = Number(revenueRow[totalKeyRev] || 0);
      ebdTotal = Number(ebitdaRow[totalKeyEbd] || 0);
    } else {
      // fallback: суммируем месяцы
      const revM = extractMonthly(revenueRow, state.year);
      const ebdM = extractMonthly(ebitdaRow, state.year);
      revTotal = revM.reduce((s,v)=>s+v,0);
      ebdTotal = ebdM.reduce((s,v)=>s+v,0);
    }
    const marginYear = revTotal ? (ebdTotal / revTotal) * 100 : 0;
    kpiChip.querySelector('.val').textContent = `${nf(marginYear, 2)}%`;
  }

  function update() {
    if (!state.rows) return;
    const rev = extractMonthly(state.rows.revenueRow, state.year);
    const ebd = extractMonthly(state.rows.ebitdaRow, state.year);

    const cfg = buildChartData(state.view, rev, ebd);

    // перерисовка холста (чистим старый отдельный tooltip, чтобы не копился)
    const body = card.querySelector('.ebitda-chart-body');
    body.querySelector('.chartjs-ext-tooltip')?.remove();

    if (state.chart) { try { state.chart.destroy(); } catch(e){} }
    state.chart = renderEbitdaChart(canvas, cfg, state.view);

    updateKPI();
  }

  yearSelect?.addEventListener('change', async (e) => {
    state.year = parseInt(e.target.value, 10) || 2024;
    await load();
  });

  viewControl?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-view]');
    if (!btn) return;
    viewControl.querySelectorAll('button[data-view]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.view = btn.getAttribute('data-view') || 'month';
    update();
  });

  await load();
}

// ==============================
// Остальная страница (как было), плюс новый блок снизу
// ==============================
function pageMeta(sub = 'financial') {
  const map = {
    financial: {
      title: 'Управление финансовыми операциями',
      subtitle: 'FP&A (Financial Planning & Analysis)',
      icon: 'calculator',
    },
    operational: {
      title: 'Продажи и операционное планирование',
      subtitle: 'S&OP (Sales & Operations Planning)',
      icon: 'trending-up-down',
    },
    'plan-vs-fact': {
      title: 'Анализ плана и факта',
      subtitle: 'Integrated Reconciliation',
      icon: 'chart-column-stacked',
    },
    'management-data': {
      title: 'Данные для управленческих решений',
      subtitle: 'Management Business Review',
      icon: 'briefcase-business',
    },
  };
  return map[sub] || map['financial'];
}

export async function renderIBPPage(container, subpage = 'financial') {
  const meta = pageMeta(subpage);

  const headerHTML = `
    <div class="analytics-header">
      <div class="analytics-header__title-block">
        <i data-lucide="${meta.icon}" class="analytics-header__icon" aria-hidden="true"></i>
        <div>
          <h2 class="analytics-header__title">${meta.title}</h2>
          <p class="analytics-header__subtitle">${meta.subtitle}</p>
        </div>
      </div>
    </div>
  `;

  if (subpage === 'financial') {
    container.innerHTML = `
      <div class="analytics-page">
        <div class="analytics-header">
          <div class="analytics-header__title-block">
            <i data-lucide="${meta.icon}" class="analytics-header__icon" aria-hidden="true"></i>
            <div>
              <h2 class="analytics-header__title">${meta.title}</h2>
              <p class="analytics-header__subtitle">${meta.subtitle}</p>
            </div>
          </div>
        </div>

        <div class="fp-grid">
          <a href="#!/analytics" onclick="navigate('analytics'); return false;"
             class="module-card fp-card fp-card--analytics" style="--module-color: var(--success);" aria-label="Финансовая аналитика">
            <div class="module-header">
              <i class="module-icon" data-lucide="line-chart"></i>
              <h3 class="module-title">Финансовая аналитика</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Данные PnL. Показатели и метрики для поддержки принятия управленческих решений</p>
            </div>
          </a>

          <a href="#!/ibp/financial" onclick="navigate('ibp/financial'); return false;"
             class="module-card fp-card" style="--module-color: var(--blue);" aria-label="Бюджетирование">
            <div class="module-header">
              <i class="module-icon" data-lucide="file-chart-column"></i>
              <h3 class="module-title">Бюджетирование</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Управление бюджетами компании по различным направлениям деятельности</p>
            </div>
          </a>

          <a href="#!/ibp/financial" onclick="navigate('ibp/financial'); return false;"
             class="module-card fp-card" style="--module-color: var(--warning);" aria-label="Финансовое планирование">
            <div class="module-header">
              <i class="module-icon" data-lucide="calendar-clock"></i>
              <h3 class="module-title">Финансовое планирование</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Управление, распределение и контроль денежных средств компании</p>
            </div>
          </a>
        </div>

        <!-- Новый блок: Операционная маржинальность EBITDA -->
        <div class="analytics-chart card ebitda-chart-modern" id="ebitda-margin-card">
          <div class="ebitda-chart-header">
            <div class="ebitda-left">
              <i data-lucide="chart-column-stacked" class="ebitda-chart-icon"></i>
              <div class="ebitda-titles">
                <h3 class="ebitda-title">Операционная маржинальность EBITDA</h3>
                <p class="ebitda-subtitle">Operating Profit Margin</p>
              </div>
            </div>

            <div class="ebitda-controls">
              <div class="ebitda-metric" id="ebitda-annual-chip">
                <span class="lbl">EBITDA Margin, год</span>
                <span class="val">—</span>
              </div>

              <div class="ebitda-filter">
                <label for="ebitda-year-select">Год</label>
                <select id="ebitda-year-select" class="ebitda-select">
                  <option value="2024" selected>2024</option>
                </select>
              </div>

              <div class="ebitda-view" id="ebitda-view-control" role="tablist" aria-label="Представление">
                <button class="active" data-view="month" role="tab" aria-selected="true">Месяцы</button>
                <button data-view="quarter" role="tab" aria-selected="false">Кварталы</button>
              </div>

              <span class="info-tip" id="ebitda-tip" title="">
                <i data-lucide="info"></i>
              </span>
            </div>
          </div>

          <div class="ebitda-chart-body">
            <canvas id="ebitdaMarginChart"></canvas>
          </div>
        </div>
      </div>
    `;

    if (window.lucide?.createIcons) { try { window.lucide.createIcons(); } catch(e){} }
    await mountEbitdaBlock(container);
    return;
  }

  if (subpage === 'operational') {
    container.innerHTML = `
      <div class="analytics-page">
        ${headerHTML}
        <div class="fp-grid">
          <a href="#!/ibp/operational" onclick="navigate('ibp/operational'); return false;"
             class="module-card" style="--module-color: var(--blue);" aria-label="Планирование продаж">
            <div class="module-header">
              <i class="module-icon" data-lucide="target"></i>
              <h3 class="module-title">Планирование продаж</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Системное и оперативное планирование объемов продаж</p>
            </div>
          </a>

          <a href="#!/ibp/operational" onclick="navigate('ibp/operational'); return false;"
             class="module-card" style="--module-color: var(--accent);" aria-label="Операционные планы">
            <div class="module-header">
              <i class="module-icon" data-lucide="compass"></i>
              <h3 class="module-title">Операционные планы</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Планирование логистических процессов и использования ресурсов</p>
            </div>
          </a>

          <a href="#!/ibp/operational" onclick="navigate('ibp/operational'); return false;"
             class="module-card" style="--module-color: var(--success);" aria-label="Юнит-экономика">
            <div class="module-header">
              <i class="module-icon" data-lucide="calculator"></i>
              <h3 class="module-title">Юнит-экономика</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Анализ прибыли и расходов на один юнит</p>
            </div>
          </a>
        </div>
      </div>
    `;
    if (window.lucide?.createIcons) { try { window.lucide.createIcons(); } catch(e){} }
    return;
  }

  if (subpage === 'plan-vs-fact') {
    container.innerHTML = `
      <div class="analytics-page">
        ${headerHTML}
        <div class="fp-grid">
          <a href="#!/ibp/plan-vs-fact" onclick="navigate('ibp/plan-vs-fact'); return false;"
             class="module-card" style="--module-color: var(--blue);" aria-label="Сопоставление данных">
            <div class="module-header">
              <i class="module-icon" data-lucide="table"></i>
              <h3 class="module-title">Сопоставление данных</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Сравнение плановых и фактических показателей</p>
            </div>
          </a>

          <a href="#!/ibp/plan-vs-fact" onclick="navigate('ibp/plan-vs-fact'); return false;"
             class="module-card" style="--module-color: var(--warning);" aria-label="Анализ отклонений">
            <div class="module-header">
              <i class="module-icon" data-lucide="activity"></i>
              <h3 class="module-title">Анализ отклонений</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Аналитика отклонений и причины</p>
            </div>
          </a>

          <a href="#!/ibp/plan-vs-fact" onclick="navigate('ibp/plan-vs-fact'); return false;"
             class="module-card" style="--module-color: var(--success);" aria-label="Корректировка планов">
            <div class="module-header">
              <i class="module-icon" data-lucide="sliders"></i>
              <h3 class="module-title">Корректировка планов</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Сценарии коррекции планов на основе факта</p>
            </div>
          </a>
        </div>
      </div>
    `;
    if (window.lucide?.createIcons) { try { window.lucide.createIcons(); } catch(e){} }
    return;
  }

  if (subpage === 'management-data') {
    container.innerHTML = `
      <div class="analytics-page">
        ${headerHTML}
        <div class="fp-grid">
          <a href="#!/ibp/management-data" onclick="navigate('ibp/management-data'); return false;"
             class="module-card" style="--module-color: var(--blue);" aria-label="Отчеты для АВ">
            <div class="module-header">
              <i class="module-icon" data-lucide="file-text"></i>
              <h3 class="module-title">Отчеты для АВ</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Комплексные управленческие отчеты</p>
            </div>
          </a>

          <a href="#!/ibp/management-data" onclick="navigate('ibp/management-data'); return false;"
             class="module-card" style="--module-color: var(--accent);" aria-label="Управленческие отчеты">
            <div class="module-header">
              <i class="module-icon" data-lucide="bar-chart-3"></i>
              <h3 class="module-title">Управленческие отчеты</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Затраты в разрезе процессов и сегментов</p>
            </div>
          </a>

          <a href="#!/ibp/management-data" onclick="navigate('ibp/management-data'); return false;"
             class="module-card" style="--module-color: var(--success);" aria-label="Финансовая устойчивость">
            <div class="module-header">
              <i class="module-icon" data-lucide="shield-check"></i>
              <h3 class="module-title">Финансовая устойчивость</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Активы, обязательства и капитал</p>
            </div>
          </a>
        </div>
      </div>
    `;
    if (window.lucide?.createIcons) { try { window.lucide.createIcons(); } catch(e){} }
    return;
  }

  // Плейсхолдер по умолчанию
  container.innerHTML = `
    <div class="analytics-page">
      ${headerHTML}
      <div class="analytics-grid analytics-grid--2-col">
        <div class="analytics-chart is-placeholder">
          <div class="analytics-chart__header">
            <i data-lucide="${meta.icon}"></i>
            <div class="analytics-chart__title-block">
              <h3 class="analytics-chart__title">${meta.title}</h3>
              <div class="analytics-chart__subtitle">Раздел в разработке</div>
            </div>
          </div>
        </div>
        <div class="analytics-chart is-placeholder">
          <div class="analytics-chart__header">
            <i data-lucide="loader"></i>
            <div class="analytics-chart__title-block">
              <h3 class="analytics-chart__title">Плейсхолдер контента</h3>
              <div class="analytics-chart__subtitle">Схемы данных и графики появятся позже</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  if (window.lucide?.createIcons) { try { window.lucide.createIcons(); } catch(e){} }
}