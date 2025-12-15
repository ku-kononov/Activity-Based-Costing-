// js/pages/abc/process.js

import { refreshIcons } from '../../utils.js';
import { getProcessesForHML, getProcessDetails } from '../../services/abc-data.js';

// ============================================================================
// УТИЛИТЫ ФОРМАТИРОВАНИЯ
// ============================================================================

const fmt = (val, digits = 1) =>
  new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number.isFinite(val) ? val : 0);

const fmtCost = (val, digits = 0) => {
  const thousands = (val || 0) / 1000;
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(thousands);
};

const fmtCurrency = (val) => {
  if (val >= 1e6) return `${fmt(val / 1e6, 1)} млн ₽`;
  if (val >= 1e3) return `${fmt(val / 1e3, 0)} тыс ₽`;
  return `${fmt(val, 0)} ₽`;
};

// ============================================================================
// HML КЛАССИФИКАЦИЯ
// ============================================================================

function calculateHMLClassification(processes) {
  if (!processes.length) return { processes: [], stats: {} };

  const costs = processes.map(p => p.total_cost);
  const n = costs.length;
  
  const sum = costs.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const variance = costs.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  
  const sorted = [...costs].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(n * 0.50)];
  
  const highThreshold = mean + stdDev;
  const lowThreshold = Math.max(0, mean - stdDev);
  
  const classifiedProcesses = processes.map(p => ({
    ...p,
    hml_class: p.total_cost > highThreshold ? 'H' : 
               p.total_cost < lowThreshold ? 'L' : 'M',
    deviation_from_mean: ((p.total_cost - mean) / mean * 100),
    z_score: stdDev > 0 ? (p.total_cost - mean) / stdDev : 0,
  }));

  const byClass = { H: [], M: [], L: [] };
  classifiedProcesses.forEach(p => byClass[p.hml_class].push(p));

  const stats = {
    total: n,
    totalCost: sum,
    mean,
    median: p50,
    stdDev,
    highThreshold,
    lowThreshold,
    distribution: {
      H: { count: byClass.H.length, total: byClass.H.reduce((s, p) => s + p.total_cost, 0) },
      M: { count: byClass.M.length, total: byClass.M.reduce((s, p) => s + p.total_cost, 0) },
      L: { count: byClass.L.length, total: byClass.L.reduce((s, p) => s + p.total_cost, 0) },
    }
  };

  return { processes: classifiedProcesses, stats };
}

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ РЕНДЕРИНГА
// ============================================================================

export async function renderHmlAnalysisPage(container) {
  container.innerHTML = `
    <style>
      /* HML-специфичные стили (минимум, остальное из общих стилей) */
      .hml-class-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }
      
      .hml-class-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 20px;
        border-left: 4px solid var(--border);
      }
      
      .hml-class-card.high { border-left-color: #ef4444; }
      .hml-class-card.medium { border-left-color: #f59e0b; }
      .hml-class-card.low { border-left-color: #22c55e; }
      
      .hml-class-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      
      .hml-class-card-title {
        font-weight: 600;
        color: var(--text);
      }
      
      .hml-class-card-stats {
        display: flex;
        gap: 24px;
        margin-bottom: 12px;
      }
      
      .hml-class-stat {
        text-align: center;
      }
      
      .hml-class-stat-value {
        font-size: 24px;
        font-weight: 700;
        color: var(--text);
      }
      
      .hml-class-stat-label {
        font-size: 12px;
        color: var(--muted);
      }
      
      .hml-class-bar {
        height: 6px;
        background: var(--border);
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 8px;
      }
      
      .hml-class-bar-fill {
        height: 100%;
        border-radius: 3px;
      }
      
      .hml-class-card.high .hml-class-bar-fill { background: #ef4444; }
      .hml-class-card.medium .hml-class-bar-fill { background: #f59e0b; }
      .hml-class-card.low .hml-class-bar-fill { background: #22c55e; }
      
      .hml-class-card-desc {
        font-size: 13px;
        color: var(--muted);
      }
      
      .hml-thresholds {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 24px;
      }
      
      .hml-thresholds h4 {
        margin: 0 0 16px;
        font-size: 14px;
        font-weight: 600;
        color: var(--text);
      }
      
      .hml-threshold-scale {
        position: relative;
        height: 40px;
        margin: 30px 0 50px;
      }
      
      .hml-threshold-track {
        display: flex;
        height: 10px;
        border-radius: 5px;
        overflow: hidden;
      }
      
      .hml-threshold-zone {
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      
      .hml-threshold-zone.low { background: #22c55e; }
      .hml-threshold-zone.medium { background: #f59e0b; }
      .hml-threshold-zone.high { background: #ef4444; }
      
      .hml-threshold-labels {
        display: flex;
        justify-content: space-between;
        margin-top: 12px;
        font-size: 12px;
        color: var(--muted);
      }
      
      .hml-threshold-label {
        text-align: center;
      }
      
      .hml-threshold-label strong {
        display: block;
        color: var(--text);
        font-size: 13px;
      }
      
      .hml-insights-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 16px;
        margin-top: 24px;
      }
      
      .hml-insight-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 20px;
        border-left: 4px solid var(--border);
      }
      
      .hml-insight-card.warning { border-left-color: #f59e0b; }
      .hml-insight-card.info { border-left-color: #3b82f6; }
      .hml-insight-card.success { border-left-color: #22c55e; }
      
      .hml-insight-card h5 {
        margin: 0 0 8px;
        font-size: 15px;
        font-weight: 600;
        color: var(--text);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .hml-insight-card p {
        margin: 0;
        font-size: 13px;
        color: var(--muted);
        line-height: 1.5;
      }
      
      .hml-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
      }
      
      .hml-badge.h { background: rgba(239, 68, 68, 0.15); color: #dc2626; }
      .hml-badge.m { background: rgba(245, 158, 11, 0.15); color: #d97706; }
      .hml-badge.l { background: rgba(34, 197, 94, 0.15); color: #16a34a; }
      
      .hml-zscore {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 4px 10px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 600;
        min-width: 50px;
      }
      
      .hml-zscore.extreme { background: #fef2f2; color: #dc2626; }
      .hml-zscore.high { background: #fffbeb; color: #d97706; }
      .hml-zscore.normal { background: #f0fdf4; color: #16a34a; }
      .hml-zscore.low { background: #f8fafc; color: #64748b; }
      
      .hml-filter-row {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      
      .hml-search {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 8px 12px;
        flex: 1;
        min-width: 200px;
        max-width: 300px;
      }
      
      .hml-search input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 14px;
        color: var(--text);
        outline: none;
      }
      
      .hml-search i {
        color: var(--muted);
        width: 16px;
        height: 16px;
      }
      
      .hml-filter-chips {
        display: flex;
        gap: 8px;
      }
      
      .hml-chip {
        padding: 6px 14px;
        border: 1px solid var(--border);
        background: var(--surface);
        border-radius: 16px;
        font-size: 13px;
        font-weight: 500;
        color: var(--muted);
        cursor: pointer;
        transition: all 0.15s;
      }
      
      .hml-chip:hover {
        border-color: var(--blue);
        color: var(--blue);
      }
      
      .hml-chip.active {
        background: var(--blue);
        border-color: var(--blue);
        color: white;
      }
      
      .hml-chip.high { color: #ef4444; border-color: rgba(239,68,68,0.3); }
      .hml-chip.high.active { background: #ef4444; color: white; }
      
      .hml-chip.medium { color: #f59e0b; border-color: rgba(245,158,11,0.3); }
      .hml-chip.medium.active { background: #f59e0b; color: white; }
      
      .hml-chip.low { color: #22c55e; border-color: rgba(34,197,94,0.3); }
      .hml-chip.low.active { background: #22c55e; color: white; }
      
      .deviation-positive { color: #16a34a; }
      .deviation-negative { color: #dc2626; }
      
      .hml-pagination {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        margin-top: 12px;
        border-top: 1px solid var(--border);
      }
      
      .hml-pagination-info {
        font-size: 13px;
        color: var(--muted);
      }
      
      .hml-pagination-controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .hml-pagination-controls button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: 1px solid var(--border);
        background: var(--surface);
        border-radius: 6px;
        cursor: pointer;
        color: var(--text);
      }
      
      .hml-pagination-controls button:hover:not(:disabled) {
        background: var(--blue);
        border-color: var(--blue);
        color: white;
      }
      
      .hml-pagination-controls button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      
      .hml-pagination-current {
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
        min-width: 60px;
        text-align: center;
      }
      
      .section-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 24px;
      }
      
      .section-card h3 {
        margin: 0 0 16px;
        font-size: 16px;
        font-weight: 600;
        color: var(--text);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .section-card h3 i {
        color: var(--blue);
        width: 20px;
        height: 20px;
      }
      
      .chart-container {
        height: 350px;
        margin-top: 16px;
      }
      
      .btn-view {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        border-radius: 6px;
      }
      
      .btn-view:hover {
        background: var(--bg);
        color: var(--blue);
      }
      
      /* Modal */
      .hml-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
        padding: 20px;
      }
      
      .hml-modal-overlay.open {
        opacity: 1;
        pointer-events: auto;
      }
      
      .hml-modal {
        background: var(--surface);
        border-radius: 16px;
        max-width: 800px;
        width: 100%;
        max-height: 90vh;
        overflow: hidden;
        transform: scale(0.95);
        transition: transform 0.2s;
      }
      
      .hml-modal-overlay.open .hml-modal {
        transform: scale(1);
      }
      
      .hml-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border);
        background: var(--bg);
      }
      
      .hml-modal-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .hml-modal-close {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        color: var(--muted);
        cursor: pointer;
        border-radius: 6px;
      }
      
      .hml-modal-close:hover {
        background: var(--surface);
        color: var(--text);
      }
      
      .hml-modal-body {
        padding: 20px;
        max-height: calc(90vh - 60px);
        overflow-y: auto;
      }
      
      .hml-detail-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
        margin-bottom: 20px;
      }
      
      .hml-detail-stat {
        background: var(--bg);
        border-radius: 10px;
        padding: 14px;
        text-align: center;
      }
      
      .hml-detail-stat-value {
        font-size: 20px;
        font-weight: 700;
        color: var(--text);
      }
      
      .hml-detail-stat-label {
        font-size: 12px;
        color: var(--muted);
        margin-top: 4px;
      }
      
      .hml-detail-stat-pct {
        font-size: 11px;
        color: var(--blue);
      }
    </style>

    <div class="analytics-page">
      <!-- Header -->
      <div class="abc-page-header">
        <div class="abc-page-title-block">
          <i data-lucide="bar-chart-2" class="main-icon"></i>
          <div class="title-content">
            <h2 class="abc-title">HML-анализ затрат</h2>
            <p class="abc-subtitle">Сегментация процессов по уровню затрат</p>
          </div>
        </div>
        <div class="abc-header-controls">
          <div class="abc-header-actions">
            <button class="btn-export btn-excel" id="hmlExportExcel">
              <i data-lucide="download"></i>
              <span>Excel</span>
            </button>
            <button class="btn-export btn-pdf" id="hmlExportPdf">
              <i data-lucide="file-text"></i>
              <span>PDF</span>
            </button>
            <button class="btn-back-to-costs" onclick="navigate('costs')">
              <i data-lucide="arrow-left"></i>
              <span>Назад к затратам</span>
            </button>
          </div>
          <div class="abc-period-selector">
            <label>Период:</label>
            <select id="hmlPeriodSelect">
              <option value="H1_2025">H1 2025</option>
            </select>
          </div>
        </div>
      </div>

      <!-- KPI Cards -->
      <div class="pareto-kpis" id="hmlKpis">
        <div class="card">Загрузка...</div>
      </div>

      <!-- Distribution Cards -->
      <div class="hml-class-cards" id="hmlClassCards"></div>

      <!-- Thresholds -->
      <div class="hml-thresholds" id="hmlThresholds"></div>

      <!-- Chart Section -->
      <div class="section-card">
        <h3><i data-lucide="bar-chart-3"></i> Распределение затрат по процессам</h3>
        <div class="hml-filter-row">
          <div class="hml-filter-chips" id="chartViewChips">
            <button class="hml-chip active" data-view="bar">Столбцы</button>
            <button class="hml-chip" data-view="scatter">Точки</button>
          </div>
        </div>
        <div class="chart-container">
          <canvas id="hmlCostChart"></canvas>
        </div>
      </div>

      <!-- Table Section -->
      <div class="section-card">
        <h3><i data-lucide="list"></i> Список процессов</h3>
        <div class="hml-filter-row">
          <div class="hml-search">
            <i data-lucide="search"></i>
            <input type="text" id="hmlSearchInput" placeholder="Поиск процесса...">
          </div>
          <div class="hml-filter-chips" id="hmlClassFilter">
            <button class="hml-chip active" data-class="">Все</button>
            <button class="hml-chip high" data-class="H">High</button>
            <button class="hml-chip medium" data-class="M">Medium</button>
            <button class="hml-chip low" data-class="L">Low</button>
          </div>
        </div>
        <div id="hmlTableContainer"></div>
        <div class="hml-pagination" id="hmlPagination"></div>
      </div>

      <!-- Insights -->
      <div class="section-card">
        <h3><i data-lucide="lightbulb"></i> Рекомендации</h3>
        <div class="hml-insights-grid" id="hmlInsights"></div>
      </div>
    </div>
  `;

  refreshIcons();
  await initializePage();
}

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================================

let currentData = { processes: [], stats: {} };
let chartInstances = {};
let currentFilters = { search: '', hmlClass: '', page: 1, pageSize: 15 };

async function initializePage() {
  try {
    const rawProcesses = await getProcessesForHML();
    currentData = calculateHMLClassification(rawProcesses);
    
    renderKpis(currentData.stats);
    renderClassCards(currentData.stats);
    renderThresholds(currentData.stats);
    renderChart(currentData.processes, 'bar');
    renderTable(currentData.processes);
    renderInsights(currentData);
    
    setupEventHandlers();
    refreshIcons();
    
  } catch (error) {
    console.error('Error initializing HML page:', error);
    document.getElementById('hmlKpis').innerHTML = '<div class="card error">Ошибка загрузки данных</div>';
  }
}

// ============================================================================
// РЕНДЕРИНГ KPI
// ============================================================================

function renderKpis(stats) {
  const cv = stats.stdDev / stats.mean * 100;
  
  document.getElementById('hmlKpis').innerHTML = `
    <div class="pareto-kpi-card">
      <div class="kpi-value">${stats.total}</div>
      <div class="kpi-label">Всего процессов</div>
      <div class="kpi-subtext">в анализе</div>
    </div>
    <div class="pareto-kpi-card">
      <div class="kpi-value">${fmtCurrency(stats.totalCost)}</div>
      <div class="kpi-label">Общие затраты</div>
      <div class="kpi-subtext">за период</div>
    </div>
    <div class="pareto-kpi-card">
      <div class="kpi-value">${fmtCurrency(stats.mean)}</div>
      <div class="kpi-label">Средние затраты</div>
      <div class="kpi-subtext">на процесс</div>
    </div>
    <div class="pareto-kpi-card">
      <div class="kpi-value">${fmtCurrency(stats.median)}</div>
      <div class="kpi-label">Медиана</div>
      <div class="kpi-subtext">50-й процентиль</div>
    </div>
    <div class="pareto-kpi-card">
      <div class="kpi-value">${fmtCurrency(stats.stdDev)}</div>
      <div class="kpi-label">Ст. отклонение</div>
      <div class="kpi-subtext">σ</div>
    </div>
    <div class="pareto-kpi-card">
      <div class="kpi-value">${fmt(cv, 0)}%</div>
      <div class="kpi-label">Коэфф. вариации</div>
      <div class="kpi-subtext">CV = σ/μ</div>
    </div>
  `;
}

// ============================================================================
// РЕНДЕРИНГ CLASS CARDS
// ============================================================================

function renderClassCards(stats) {
  const { distribution, totalCost, total } = stats;
  
  const classes = [
    { key: 'H', name: 'High', label: 'Высокозатратные', css: 'high', desc: 'Требуют детального анализа' },
    { key: 'M', name: 'Medium', label: 'Среднезатратные', css: 'medium', desc: 'Мониторинг и контроль' },
    { key: 'L', name: 'Low', label: 'Низкозатратные', css: 'low', desc: 'Стандартизация процессов' },
  ];
  
  document.getElementById('hmlClassCards').innerHTML = classes.map(cls => {
    const data = distribution[cls.key];
    const pctCount = (data.count / total * 100);
    const pctCost = (data.total / totalCost * 100);
    
    return `
      <div class="hml-class-card ${cls.css}">
        <div class="hml-class-card-header">
          <span class="hml-class-card-title">${cls.label}</span>
          <span class="hml-badge ${cls.key.toLowerCase()}">${cls.name}</span>
        </div>
        <div class="hml-class-card-stats">
          <div class="hml-class-stat">
            <div class="hml-class-stat-value">${data.count}</div>
            <div class="hml-class-stat-label">процессов (${fmt(pctCount, 0)}%)</div>
          </div>
          <div class="hml-class-stat">
            <div class="hml-class-stat-value">${fmtCurrency(data.total)}</div>
            <div class="hml-class-stat-label">затраты (${fmt(pctCost, 1)}%)</div>
          </div>
        </div>
        <div class="hml-class-bar">
          <div class="hml-class-bar-fill" style="width: ${pctCost}%"></div>
        </div>
        <div class="hml-class-card-desc">${cls.desc}</div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// РЕНДЕРИНГ THRESHOLDS
// ============================================================================

function renderThresholds(stats) {
  const { mean, lowThreshold, highThreshold } = stats;
  const max = highThreshold * 1.3;
  
  const lowPct = (lowThreshold / max * 100);
  const midPct = ((highThreshold - lowThreshold) / max * 100);
  const highPct = (100 - lowPct - midPct);
  
  document.getElementById('hmlThresholds').innerHTML = `
    <h4>Пороги классификации (метод σ)</h4>
    <div class="hml-threshold-scale">
      <div class="hml-threshold-track">
        <div class="hml-threshold-zone low" style="width: ${lowPct}%"></div>
        <div class="hml-threshold-zone medium" style="width: ${midPct}%"></div>
        <div class="hml-threshold-zone high" style="width: ${highPct}%"></div>
      </div>
      <div class="hml-threshold-labels">
        <div class="hml-threshold-label">
          <span>Low</span>
          <strong>&lt; ${fmtCurrency(lowThreshold)}</strong>
        </div>
        <div class="hml-threshold-label">
          <span>Medium (μ = ${fmtCurrency(mean)})</span>
          <strong>${fmtCurrency(lowThreshold)} — ${fmtCurrency(highThreshold)}</strong>
        </div>
        <div class="hml-threshold-label">
          <span>High</span>
          <strong>&gt; ${fmtCurrency(highThreshold)}</strong>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// РЕНДЕРИНГ ГРАФИКА
// ============================================================================

function renderChart(processes, viewType = 'bar') {
  const canvas = document.getElementById('hmlCostChart');
  if (!canvas || !window.Chart) return;

  const ctx = canvas.getContext('2d');
  
  if (chartInstances.cost) {
    chartInstances.cost.destroy();
  }

  const sorted = [...processes].sort((a, b) => b.total_cost - a.total_cost).slice(0, 30);
  
  const colors = { H: '#ef4444', M: '#f59e0b', L: '#22c55e' };

  if (viewType === 'bar') {
    chartInstances.cost = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map((_, i) => `#${i + 1}`),
        datasets: [{
          label: 'Затраты',
          data: sorted.map(p => p.total_cost / 1000),
          backgroundColor: sorted.map(p => colors[p.hml_class] + 'cc'),
          borderColor: sorted.map(p => colors[p.hml_class]),
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => sorted[items[0].dataIndex].process_name,
              label: (ctx) => {
                const p = sorted[ctx.dataIndex];
                return [
                  `Затраты: ${fmtCurrency(p.total_cost)}`,
                  `Класс: ${p.hml_class}`,
                  `Отклонение: ${p.deviation_from_mean > 0 ? '+' : ''}${fmt(p.deviation_from_mean, 1)}%`
                ];
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'тыс. ₽' },
            ticks: { callback: v => fmt(v, 0) }
          },
          x: { title: { display: true, text: 'Ранг' } }
        }
      }
    });
  } else {
    const data = processes.map((p, i) => ({ x: i + 1, y: p.total_cost / 1000, process: p }));
    
    chartInstances.cost = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: ['H', 'M', 'L'].map(cls => ({
          label: cls === 'H' ? 'High' : cls === 'M' ? 'Medium' : 'Low',
          data: data.filter(d => d.process.hml_class === cls),
          backgroundColor: colors[cls] + 'cc',
          borderColor: colors[cls],
          pointRadius: 6,
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.raw.process.process_name}: ${fmtCurrency(ctx.raw.process.total_cost)}`
            }
          }
        },
        scales: {
          y: { title: { display: true, text: 'тыс. ₽' }, ticks: { callback: v => fmt(v, 0) } },
          x: { title: { display: true, text: 'Процессы' } }
        }
      }
    });
  }
}

// ============================================================================
// РЕНДЕРИНГ ТАБЛИЦЫ
// ============================================================================

function renderTable(processes, filters = currentFilters) {
  let filtered = processes;
  
  if (filters.search) {
    const s = filters.search.toLowerCase();
    filtered = filtered.filter(p => p.process_name.toLowerCase().includes(s) || (p.pcf_code || '').toLowerCase().includes(s));
  }
  
  if (filters.hmlClass) {
    filtered = filtered.filter(p => p.hml_class === filters.hmlClass);
  }
  
  const totalPages = Math.ceil(filtered.length / filters.pageSize);
  const start = (filters.page - 1) * filters.pageSize;
  const pageData = filtered.slice(start, start + filters.pageSize);
  
  document.getElementById('hmlTableContainer').innerHTML = `
    <table class="metric-table">
      <thead>
        <tr>
          <th>Процесс</th>
          <th>PCF</th>
          <th>Класс</th>
          <th>Затраты</th>
          <th>Отклонение</th>
          <th>Z-Score</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${pageData.map(p => `
          <tr>
            <td>
              <div style="font-weight: 500">${p.process_name}</div>
              ${p.process_group ? `<div style="font-size: 12px; color: var(--muted)">${p.process_group}</div>` : ''}
            </td>
            <td class="mono">${p.pcf_code || '—'}</td>
            <td><span class="hml-badge ${p.hml_class.toLowerCase()}">${p.hml_class === 'H' ? 'High' : p.hml_class === 'M' ? 'Medium' : 'Low'}</span></td>
            <td class="mono">${fmtCurrency(p.total_cost)}</td>
            <td class="mono ${p.deviation_from_mean > 0 ? 'deviation-positive' : 'deviation-negative'}">${p.deviation_from_mean > 0 ? '+' : ''}${fmt(p.deviation_from_mean, 1)}%</td>
            <td><span class="hml-zscore ${getZScoreClass(p.z_score)}">${fmt(p.z_score, 2)}</span></td>
            <td><button class="btn-view" onclick="showProcessDetails('${p.process_id}')"><i data-lucide="eye"></i></button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  document.getElementById('hmlPagination').innerHTML = `
    <span class="hml-pagination-info">Показано ${start + 1}–${Math.min(start + filters.pageSize, filtered.length)} из ${filtered.length}</span>
    <div class="hml-pagination-controls">
      <button ${filters.page <= 1 ? 'disabled' : ''} onclick="changePage(${filters.page - 1})"><i data-lucide="chevron-left"></i></button>
      <span class="hml-pagination-current">${filters.page} / ${totalPages || 1}</span>
      <button ${filters.page >= totalPages ? 'disabled' : ''} onclick="changePage(${filters.page + 1})"><i data-lucide="chevron-right"></i></button>
    </div>
  `;
  
  refreshIcons();
}

function getZScoreClass(z) {
  if (z > 2) return 'extreme';
  if (z > 1) return 'high';
  if (z < -1) return 'low';
  return 'normal';
}

// ============================================================================
// РЕНДЕРИНГ INSIGHTS
// ============================================================================

function renderInsights(data) {
  const { processes, stats } = data;
  const highProcesses = processes.filter(p => p.hml_class === 'H');
  const highCostShare = stats.distribution.H.total / stats.totalCost * 100;
  const topProcess = [...processes].sort((a, b) => b.total_cost - a.total_cost)[0];
  const cv = stats.stdDev / stats.mean * 100;
  
  document.getElementById('hmlInsights').innerHTML = `
    <div class="hml-insight-card warning">
      <h5><i data-lucide="alert-triangle"></i> Концентрация затрат</h5>
      <p>${highProcesses.length} высокозатратных процессов формируют ${fmt(highCostShare, 1)}% затрат. Рекомендуется детальный аудит.</p>
    </div>
    <div class="hml-insight-card info">
      <h5><i data-lucide="bar-chart-2"></i> Волатильность</h5>
      <p>${cv > 100 ? 'Высокий' : 'Умеренный'} коэффициент вариации (${fmt(cv, 0)}%) ${cv > 100 ? 'указывает на неоднородность процессов' : 'свидетельствует об однородной структуре'}.</p>
    </div>
    <div class="hml-insight-card success">
      <h5><i data-lucide="check-circle"></i> Потенциал оптимизации</h5>
      <p>Стандартизация ${stats.distribution.L.count} низкозатратных процессов высвободит ресурсы для оптимизации High-категории.</p>
    </div>
  `;
  
  refreshIcons();
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function setupEventHandlers() {
  // Search
  document.getElementById('hmlSearchInput')?.addEventListener('input', debounce(e => {
    currentFilters.search = e.target.value;
    currentFilters.page = 1;
    renderTable(currentData.processes, currentFilters);
  }, 300));
  
  // Class filter
  document.querySelectorAll('#hmlClassFilter .hml-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#hmlClassFilter .hml-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilters.hmlClass = chip.dataset.class;
      currentFilters.page = 1;
      renderTable(currentData.processes, currentFilters);
    });
  });
  
  // Chart view
  document.querySelectorAll('#chartViewChips .hml-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#chartViewChips .hml-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderChart(currentData.processes, chip.dataset.view);
    });
  });
  
  // Export
  document.getElementById('hmlExportExcel')?.addEventListener('click', exportToExcel);
  document.getElementById('hmlExportPdf')?.addEventListener('click', exportToPdf);
}

window.changePage = function(page) {
  currentFilters.page = page;
  renderTable(currentData.processes, currentFilters);
};

function debounce(fn, wait) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

// ============================================================================
// EXPORT
// ============================================================================

async function exportToExcel() {
  try {
    const data = currentData.processes.map(p => ({
      'Процесс': p.process_name,
      'PCF Код': p.pcf_code || '',
      'Класс HML': p.hml_class,
      'Затраты (руб)': p.total_cost,
      'Отклонение (%)': p.deviation_from_mean,
      'Z-Score': p.z_score
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'HML Analysis');
    XLSX.writeFile(wb, `hml_analysis_${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (e) {
    console.error('Export to Excel failed:', e);
    alert('Ошибка экспорта');
  }
}

async function exportToPdf() {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('HML-анализ затрат', 20, 20);
    doc.setFontSize(10);
    doc.text(`Дата: ${new Date().toLocaleDateString('ru-RU')}`, 20, 30);
    
    const tableData = currentData.processes.slice(0, 40).map(p => [
      p.process_name.substring(0, 30),
      p.hml_class,
      fmtCost(p.total_cost) + ' тыс.',
      fmt(p.deviation_from_mean, 1) + '%',
      fmt(p.z_score, 2)
    ]);
    
    doc.autoTable({
      head: [['Процесс', 'Класс', 'Затраты', 'Откл.', 'Z']],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });
    
    doc.save(`hml_analysis_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (e) {
    console.error('Export to PDF failed:', e);
    alert('Ошибка экспорта');
  }
}

// ============================================================================
// PROCESS DETAILS MODAL
// ============================================================================

window.showProcessDetails = async function(processId) {
  try {
    const details = await getProcessDetails(processId);
    const process = currentData.processes.find(p => p.process_id === processId);
    
    const totalCost = details.reduce((s, d) => s + (d.out_allocated_total || 0), 0);
    const totalPayroll = details.reduce((s, d) => s + (d.out_allocated_payroll || 0), 0);
    const totalWorkspace = details.reduce((s, d) => s + (d.out_allocated_workspace || 0), 0);
    const totalOther = details.reduce((s, d) => s + (d.out_allocated_other || 0), 0);
    
    const modal = document.createElement('div');
    modal.className = 'hml-modal-overlay';
    modal.id = 'processModal';
    modal.innerHTML = `
      <div class="hml-modal">
        <div class="hml-modal-header">
          <h3>
            <span class="hml-badge ${process?.hml_class?.toLowerCase() || 'm'}">${process?.hml_class || 'M'}</span>
            ${process?.process_name || 'Процесс'}
          </h3>
          <button class="hml-modal-close" id="closeModal"><i data-lucide="x"></i></button>
        </div>
        <div class="hml-modal-body">
          <div class="hml-detail-summary">
            <div class="hml-detail-stat">
              <div class="hml-detail-stat-value">${fmtCurrency(totalCost)}</div>
              <div class="hml-detail-stat-label">Общие затраты</div>
            </div>
            <div class="hml-detail-stat">
              <div class="hml-detail-stat-value">${fmtCurrency(totalPayroll)}</div>
              <div class="hml-detail-stat-label">Зарплаты</div>
              <div class="hml-detail-stat-pct">${fmt(totalPayroll / totalCost * 100, 1)}%</div>
            </div>
            <div class="hml-detail-stat">
              <div class="hml-detail-stat-value">${fmtCurrency(totalWorkspace)}</div>
              <div class="hml-detail-stat-label">Помещения</div>
              <div class="hml-detail-stat-pct">${fmt(totalWorkspace / totalCost * 100, 1)}%</div>
            </div>
            <div class="hml-detail-stat">
              <div class="hml-detail-stat-value">${fmtCurrency(totalOther)}</div>
              <div class="hml-detail-stat-label">Прочие</div>
              <div class="hml-detail-stat-pct">${fmt(totalOther / totalCost * 100, 1)}%</div>
            </div>
          </div>
          
          ${process ? `
            <div style="display: flex; gap: 16px; margin-bottom: 20px;">
              <div class="hml-detail-stat" style="flex: 1">
                <div class="hml-detail-stat-value ${process.deviation_from_mean > 0 ? 'deviation-positive' : 'deviation-negative'}">
                  ${process.deviation_from_mean > 0 ? '+' : ''}${fmt(process.deviation_from_mean, 1)}%
                </div>
                <div class="hml-detail-stat-label">Отклонение от среднего</div>
              </div>
              <div class="hml-detail-stat" style="flex: 1">
                <div class="hml-detail-stat-value">${fmt(process.z_score, 2)}</div>
                <div class="hml-detail-stat-label">Z-Score</div>
              </div>
            </div>
          ` : ''}
          
          <h4 style="margin: 0 0 12px; font-size: 14px; font-weight: 600;">Распределение по подразделениям</h4>
          <table class="metric-table">
            <thead>
              <tr>
                <th>Подразделение</th>
                <th>Сотр.</th>
                <th>Ставка</th>
                <th>Затраты</th>
                <th>Доля</th>
              </tr>
            </thead>
            <tbody>
              ${details.map(d => `
                <tr>
                  <td>${d.out_dept_name}</td>
                  <td class="mono">${d.out_dept_employees || '—'}</td>
                  <td class="mono">${fmt((d.out_allocation_rate || 0) * 100, 1)}%</td>
                  <td class="mono">${fmtCurrency(d.out_allocated_total || 0)}</td>
                  <td class="mono">${fmt(d.out_pct_of_process || 0, 1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    refreshIcons();
    
    setTimeout(() => modal.classList.add('open'), 10);
    
    const close = () => {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 200);
    };
    
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    document.getElementById('closeModal').addEventListener('click', close);
    
  } catch (e) {
    console.error('Error loading details:', e);
    alert('Ошибка загрузки');
  }
};

export const renderAbcPage = renderHmlAnalysisPage;