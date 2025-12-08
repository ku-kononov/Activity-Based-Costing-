// js/pages/abc/validation.js
import { refreshIcons } from '../../utils.js';
import { getValidationData } from '../../services/abc-data.js';

const fmt = (val, digits = 1) =>
  new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number.isFinite(val) ? val : 0);

export async function renderAbcPage(container, subpage) {
  if (subpage !== 'validation') {
    container.innerHTML = '<div class="card"><p>Страница в разработке</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="analytics-page">
      <div class="abc-page-header">
        <div class="abc-page-title-block">
          <i data-lucide="check-circle" class="main-icon"></i>
          <div class="title-content">
            <h2 class="abc-title">Валидация данных</h2>
            <p class="abc-subtitle">Проверка качества ABC модели</p>
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

      <div class="validation-kpis" id="validationKpis">
        <div class="card">Загрузка...</div>
      </div>

      <div class="validation-details" id="validationDetails">
        <div class="card">Загрузка проверок...</div>
      </div>

      <div class="validation-actions">
        <button id="refreshValidation" class="btn-primary">
          <i data-lucide="refresh-cw"></i>
          Обновить проверки
        </button>
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

  await loadValidationData();

  // Setup refresh button
  document.getElementById('refreshValidation').addEventListener('click', async () => {
    await loadValidationData();
  });
}

async function loadValidationData() {
  try {
    const data = await getValidationData();

    // Calculate KPIs
    const deptTotal = data.find(v => v.check_name === 'Departments Total')?.amount || 0;
    const allocatedTotal = data.find(v => v.check_name === 'Allocated Total')?.amount || 0;
    const difference = data.find(v => v.check_name === 'Allocation Difference')?.amount || 0;
    const completeness = deptTotal > 0 ? ((deptTotal - Math.abs(difference)) / deptTotal * 100) : 0;

    const warnings = data.filter(v => v.amount > 0 && (
      v.check_name.includes('Difference') ||
      v.check_name.includes('Without Group')
    )).length;

    const errors = data.filter(v => v.amount > 0 && v.check_name.includes('Duplicate')).length;

    // Render KPIs
    document.getElementById('validationKpis').innerHTML = `
      <div class="validation-kpi-card ${errors > 0 ? 'error' : warnings > 0 ? 'warning' : 'success'}">
        <div class="kpi-value">${errors > 0 ? 'Ошибка' : warnings > 0 ? 'Предупреждение' : 'OK'}</div>
        <div class="kpi-label">Статус</div>
      </div>
      <div class="validation-kpi-card">
        <div class="kpi-value">${warnings}</div>
        <div class="kpi-label">Предупреждений</div>
      </div>
      <div class="validation-kpi-card">
        <div class="kpi-value">${errors}</div>
        <div class="kpi-label">Ошибок</div>
      </div>
      <div class="validation-kpi-card">
        <div class="kpi-value">${fmt(completeness, 1)}%</div>
        <div class="kpi-label">% распределения</div>
      </div>
    `;

    // Render validation table
    document.getElementById('validationDetails').innerHTML = `
      <table class="metric-table">
        <thead>
          <tr>
            <th>Проверка</th>
            <th>Значение</th>
            <th>Ожидание</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(v => {
            let status = 'OK';
            let statusClass = 'success';
            let expected = '-';

            if (v.check_name === 'Allocation Difference') {
              expected = '< 2%';
              if (Math.abs(v.amount / deptTotal) > 0.02) {
                status = 'WARN';
                statusClass = 'warning';
              }
            } else if (v.check_name === 'Processes Without Group') {
              expected = '0';
              if (v.amount > 0) {
                status = 'WARN';
                statusClass = 'warning';
              }
            } else if (v.check_name === 'Duplicate Process-Dept Pairs') {
              expected = '0';
              if (v.amount > 0) {
                status = 'ERROR';
                statusClass = 'error';
              }
            }

            return `
              <tr class="${statusClass}">
                <td>${v.check_name}</td>
                <td class="mono">${typeof v.amount === 'number' ? fmt(v.amount, 0) : v.amount}</td>
                <td>${expected}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

  } catch (error) {
    console.error('Error loading validation data:', error);
    document.getElementById('validationKpis').innerHTML = '<div class="card error">Ошибка загрузки данных</div>';
    document.getElementById('validationDetails').innerHTML = '<div class="card error">Ошибка загрузки данных</div>';
  }
}