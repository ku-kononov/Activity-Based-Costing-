// js/pages/abc/matrix.js
import { refreshIcons } from '../../utils.js';
import { getMatrixData } from '../../services/abc-data.js';

const fmt = (val, digits = 1) =>
  new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number.isFinite(val) ? val : 0);

export async function renderAbcPage(container, subpage) {
  if (subpage !== 'matrix') {
    container.innerHTML = '<div class="card"><p>Страница в разработке</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="analytics-page">
      <div class="abc-page-header">
        <div class="abc-page-title-block">
          <i data-lucide="grid-3x3" class="main-icon"></i>
          <div class="title-content">
            <h2 class="abc-title">Матрица распределения</h2>
            <p class="abc-subtitle">Затраты процессов по подразделениям</p>
          </div>
        </div>
        <div class="abc-header-controls">
          <div class="abc-header-actions">
            <button class="btn-back-to-costs" onclick="navigate('costs')">
              <i data-lucide="arrow-left"></i>
              <span>Назад к затратам</span>
            </button>
          </div>
          <div class="abc-period-selector">
            <label>Период:</label>
            <select id="abcPagePeriodSelect">
              <option value="H1_2025">H1 2025</option>
            </select>
          </div>
        </div>
      </div>

      <div class="matrix-controls">
        <div class="matrix-filters">
          <label>Показать топ:</label>
          <select id="matrixDeptCount">
            <option value="10">10 подразделений</option>
            <option value="20" selected>20 подразделений</option>
            <option value="50">50 подразделений</option>
          </select>
          <select id="matrixProcessCount">
            <option value="10">10 процессов</option>
            <option value="20" selected>20 процессов</option>
            <option value="50">50 процессов</option>
          </select>
        </div>
        <div class="matrix-legend">
          <div class="legend-item">
            <div class="legend-color low"></div>
            <span>Низкие затраты</span>
          </div>
          <div class="legend-item">
            <div class="legend-color medium"></div>
            <span>Средние затраты</span>
          </div>
          <div class="legend-item">
            <div class="legend-color high"></div>
            <span>Высокие затраты</span>
          </div>
        </div>
      </div>

      <div class="matrix-heatmap-container" id="matrixHeatmap">
        <div class="card">Загрузка матрицы...</div>
      </div>

      <div class="matrix-summary" id="matrixSummary">
        <div class="card">Загрузка сводки...</div>
      </div>
    </div>
  `;

  refreshIcons();

  // Загрузка периодов в селектор
  const periodSelect = document.getElementById('abcPagePeriodSelect');
  if (periodSelect) {
    import('../../services/abc-data.js').then(async ({ getAvailablePeriods }) => {
      try {
        const periods = await getAvailablePeriods();
        periodSelect.innerHTML = periods.map(p =>
          `<option value="${p.code}">${p.name}</option>`
        ).join('');
      } catch (error) {
        console.warn('Failed to load ABC periods:', error);
      }
    });
  }

  await loadMatrixData();
}

async function loadMatrixData() {
  try {
    const deptCount = parseInt(document.getElementById('matrixDeptCount').value) || 20;
    const processCount = parseInt(document.getElementById('matrixProcessCount').value) || 20;

    const data = await getMatrixData(deptCount, processCount);

    renderMatrixHeatmap(data);
    renderMatrixSummary(data);

    setupMatrixControls();

  } catch (error) {
    console.error('Error loading matrix data:', error);
    document.getElementById('matrixHeatmap').innerHTML = '<div class="card error">Ошибка загрузки данных</div>';
    document.getElementById('matrixSummary').innerHTML = '<div class="card error">Ошибка загрузки данных</div>';
  }
}

function renderMatrixHeatmap(data) {
  if (!data.departments || !data.processes || !data.matrix) {
    document.getElementById('matrixHeatmap').innerHTML = '<div class="card">Нет данных для отображения</div>';
    return;
  }

  const { departments, processes, matrix, maxValue } = data;

  const tableHtml = `
    <div class="matrix-wrapper">
      <table class="matrix-table">
        <thead>
          <tr>
            <th class="matrix-corner">Подразделение \\ Процесс</th>
            ${processes.map(p => `<th class="matrix-header" title="${p.process_name}">${p.pcf_code || p.process_name.slice(0, 8)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${departments.map((dept, deptIndex) => `
            <tr>
              <th class="matrix-row-header" title="${dept.dept_name}">${dept.dept_name.length > 15 ? dept.dept_name.slice(0, 12) + '...' : dept.dept_name}</th>
              ${processes.map((_, procIndex) => {
                const value = matrix[deptIndex]?.[procIndex] || 0;
                const intensity = maxValue > 0 ? (value / maxValue) : 0;
                let cellClass = 'matrix-cell';
                if (intensity < 0.33) cellClass += ' low';
                else if (intensity < 0.66) cellClass += ' medium';
                else cellClass += ' high';

                return `<td class="${cellClass}" title="${fmt(value / 1000000, 1)}M ₽">${value > 0 ? fmt(value / 1000000, 1) : ''}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('matrixHeatmap').innerHTML = tableHtml;
}

function renderMatrixSummary(data) {
  if (!data.summary) {
    document.getElementById('matrixSummary').innerHTML = '<div class="card">Нет данных для сводки</div>';
    return;
  }

  const { totalCells, filledCells, totalValue, avgValue } = data.summary;

  const summaryHtml = `
    <div class="matrix-summary-grid">
      <div class="summary-card">
        <div class="summary-value">${filledCells}</div>
        <div class="summary-label">Заполненных ячеек</div>
        <div class="summary-pct">${fmt((filledCells / totalCells) * 100, 1)}% от общего</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${fmt(totalValue / 1000000, 1)}M ₽</div>
        <div class="summary-label">Общие затраты</div>
        <div class="summary-pct">в матрице</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${fmt(avgValue / 1000000, 2)}M ₽</div>
        <div class="summary-label">Средние затраты</div>
        <div class="summary-pct">на ячейку</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${totalCells - filledCells}</div>
        <div class="summary-label">Пустых ячеек</div>
        <div class="summary-pct">${fmt(((totalCells - filledCells) / totalCells) * 100, 1)}% от общего</div>
      </div>
    </div>
  `;

  document.getElementById('matrixSummary').innerHTML = summaryHtml;
}

function setupMatrixControls() {
  const deptSelect = document.getElementById('matrixDeptCount');
  const processSelect = document.getElementById('matrixProcessCount');

  function updateMatrix() {
    loadMatrixData();
  }

  deptSelect?.addEventListener('change', updateMatrix);
  processSelect?.addEventListener('change', updateMatrix);
}