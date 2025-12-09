// js/pages/abc/processes.js
import { refreshIcons } from '../../utils.js';
import { getAbcProcesses, getProcessDetails } from '../../services/abc-data.js';

// Utility functions - ОБНОВЛЕНО для отображения в тысячах рублей
const fmt = (val, digits = 1) =>
  new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number.isFinite(val) ? val : 0);

// Форматирование затрат в миллионах с правильным масштабированием
const fmtCost = (val, digits = 0) => {
  // val в рублях, показываем в тысячах
  const thousands = (val || 0) / 1000;
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(thousands);
};

// Render ABC classification page
export async function renderAbcPage(container, subpage) {
  if (subpage !== 'processes') {
    container.innerHTML = '<div class="card"><p>Страница в разработке</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="analytics-page">
      <div class="abc-page-header">
        <div class="abc-page-title-block">
          <i data-lucide="target" class="main-icon"></i>
          <div class="title-content">
            <h2 class="abc-title">ABC-классификация процессов</h2>
            <p class="abc-subtitle">Activity Based Costing</p>
          </div>
        </div>
        <div class="abc-header-controls">
          <div class="abc-header-actions">
            <button class="btn-export btn-excel" onclick="exportAbcProcessesToExcel()">
              <i data-lucide="download"></i>
              <span>Excel</span>
            </button>
            <button class="btn-export btn-pdf" onclick="exportAbcProcessesToPdf()">
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
            <select id="abcPagePeriodSelect">
              <option value="H1_2025">H1 2025</option>
            </select>
          </div>
        </div>
      </div>

      <div class="abc-summary-cards" id="abcSummaryCards">
        <div class="card">Загрузка...</div>
      </div>

      <div class="abc-chart-section">
        <h3>Распределение по ABC классам</h3>
        <div class="abc-chart-container">
          <canvas id="abcChart" width="400" height="200"></canvas>
        </div>
      </div>

      <div class="abc-filters" id="abcFilters">
        <input type="text" placeholder="Поиск по имени или коду..." id="searchInput">
        <select id="abcClassFilter">
          <option value="">Все классы</option>
          <option value="A">Класс A</option>
          <option value="B">Класс B</option>
          <option value="C">Класс C</option>
        </select>
        <select id="sortBy">
          <option value="total_cost DESC">По затратам ↓</option>
          <option value="total_cost ASC">По затратам ↑</option>
          <option value="cost_rank ASC">По рангу ↑</option>
          <option value="process_name ASC">По имени ↑</option>
        </select>
      </div>

      <div class="abc-process-table" id="abcProcessTable">
        <div class="card">Загрузка данных...</div>
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

  await loadAbcData();
}

// Load ABC classification data
async function loadAbcData() {
  try {
    const filters = getCurrentFilters();
    const processes = await getAbcProcesses(filters);

    // Group by ABC class for summary cards
    const summary = processes.reduce((acc, p) => {
      const cls = p.abc_class;
      if (!acc[cls]) acc[cls] = { count: 0, total: 0 };
      acc[cls].count++;
      acc[cls].total += p.total_cost;
      return acc;
    }, {});

    const totalCost = Object.values(summary).reduce((sum, s) => sum + s.total, 0);

    // Render summary cards
    const summaryHtml = Object.entries(summary).map(([cls, data]) => `
      <div class="abc-summary-card abc-class-${cls.toLowerCase()}">
        <div class="abc-summary-title">Класс ${cls}</div>
        <div class="abc-summary-count">${data.count} процессов</div>
        <div class="abc-summary-cost">${fmtCost(data.total)} тыс. ₽</div>
        <div class="abc-summary-pct">${fmt(data.total / totalCost * 100, 1)}%</div>
      </div>
    `).join('');

    document.getElementById('abcSummaryCards').innerHTML = summaryHtml;

    // Render chart
    renderAbcChart(summary, totalCost);

    // Render table
    renderProcessTable(processes);

    // Setup filters
    setupFilters(processes);

  } catch (error) {
    console.error('Error loading ABC data:', error);
    document.getElementById('abcSummaryCards').innerHTML = '<div class="card error">Ошибка загрузки данных</div>';
    document.getElementById('abcProcessTable').innerHTML = '<div class="card error">Ошибка загрузки данных</div>';
  }
}

// Render ABC distribution chart
function renderAbcChart(summary, totalCost) {
  const canvas = document.getElementById('abcChart');
  if (!canvas || !window.Chart) return;

  const ctx = canvas.getContext('2d');

  // Destroy existing chart
  if (window.abcChartInstance) {
    window.abcChartInstance.destroy();
  }

  const labels = Object.keys(summary).sort();
  const data = labels.map(cls => summary[cls].total / 1000); // in thousands
  const colors = {
    A: '#10b981',
    B: '#f59e0b',
    C: '#ef4444'
  };

  window.abcChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.map(cls => `Класс ${cls}`),
      datasets: [{
        label: 'Затраты (тыс. ₽)',
        data: data,
        backgroundColor: labels.map(cls => colors[cls] || '#6b7280'),
        borderColor: labels.map(cls => colors[cls] || '#6b7280'),
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => {
              const cls = labels[context.dataIndex];
              const count = summary[cls].count;
              const pct = fmt(summary[cls].total / totalCost * 100, 1);
              return [
                `Затраты: ${fmt(context.raw, 0)} тыс. ₽`,
                `Процессов: ${count}`,
                `Доля: ${pct}%`
              ];
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Затраты (тыс. ₽)' },
          ticks: { callback: (value) => fmt(value, 1) }
        },
        x: {
          title: { display: true, text: 'ABC классы' }
        }
      }
    }
  });
}

// Export functions
window.exportAbcProcessesToExcel = async function() {
  try {
    const data = await getAbcProcesses();

    const exportData = data.map(p => ({
      'Ранг': p.cost_rank,
      'Код процесса': p.pcf_code || '',
      'Название процесса': p.process_name,
      'Затраты (руб)': p.total_cost,
      '% от общего': p.pct_of_total,
      'Класс ABC': p.abc_class,
      'Группа': p.group_name || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ABC Processes');
    XLSX.writeFile(wb, `abc_processes_${new Date().toISOString().slice(0, 10)}.xlsx`);

  } catch (error) {
    console.error('Export to Excel failed:', error);
    alert('Ошибка экспорта в Excel');
  }
};

window.exportAbcProcessesToPdf = async function() {
  try {
    const data = await getAbcProcesses();

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('ABC-классификация процессов', 20, 20);
    doc.setFontSize(10);
    doc.text(`Дата: ${new Date().toLocaleDateString('ru-RU')}`, 20, 30);

    const tableData = data.slice(0, 50).map(p => [
      p.cost_rank,
      p.pcf_code || '',
      p.process_name.substring(0, 30),
      fmtCost(p.total_cost) + ' тыс.',
      fmt(p.pct_of_total, 1) + '%',
      p.abc_class
    ]);

    doc.autoTable({
      head: [['Ранг', 'Код', 'Процесс', 'Затраты', '%', 'Класс']],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    doc.save(`abc_processes_${new Date().toISOString().slice(0, 10)}.pdf`);

  } catch (error) {
    console.error('Export to PDF failed:', error);
    alert('Ошибка экспорта в PDF');
  }
};

// Render process table
function renderProcessTable(processes) {
  const tableHtml = `
    <table class="metric-table sortable-table">
      <thead>
        <tr>
          <th data-sort="cost_rank">Ранг</th>
          <th data-sort="pcf_code">PCF Код</th>
          <th data-sort="process_name">Процесс</th>
          <th data-sort="total_cost">Затраты</th>
          <th data-sort="pct_of_total">% от общего</th>
          <th data-sort="abc_class">Класс</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${processes.slice(0, 50).map(p => `
          <tr onclick="showProcessDetails('${p.process_id}')">
            <td>${p.cost_rank}</td>
            <td>${p.pcf_code || '-'}</td>
            <td>${p.process_name}</td>
            <td class="mono">${fmtCost(p.total_cost)} тыс.</td>
            <td class="mono">${fmt(p.pct_of_total, 1)}%</td>
            <td><span class="abc-badge abc-class-${p.abc_class.toLowerCase()}">${p.abc_class}</span></td>
            <td><button class="btn-sm" onclick="event.stopPropagation(); showProcessDetails('${p.process_id}')">Детали</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  document.getElementById('abcProcessTable').innerHTML = tableHtml;

  // Add table sorting
  setupTableSorting();
}

// Get current filter values
function getCurrentFilters() {
  const searchInput = document.getElementById('searchInput');
  const classFilter = document.getElementById('abcClassFilter');
  const sortSelect = document.getElementById('sortBy');

  return {
    search: searchInput?.value || '',
    abcClass: classFilter?.value || '',
    sortBy: sortSelect?.value || 'total_cost DESC'
  };
}

// Setup filters
function setupFilters(allProcesses) {
  const searchInput = document.getElementById('searchInput');
  const classFilter = document.getElementById('abcClassFilter');
  const sortSelect = document.getElementById('sortBy');

  function applyFilters() {
    loadAbcData(); // Reload with new filters
  }

  searchInput?.addEventListener('input', debounce(applyFilters, 300));
  classFilter?.addEventListener('change', applyFilters);
  sortSelect?.addEventListener('change', applyFilters);
}

// Setup table column sorting
function setupTableSorting() {
  const table = document.querySelector('.sortable-table');
  if (!table) return;

  const headers = table.querySelectorAll('th[data-sort]');
  headers.forEach(header => {
    header.style.cursor = 'pointer';
    header.addEventListener('click', () => {
      const sortBy = header.dataset.sort;
      const currentSort = document.getElementById('sortBy').value;
      const [field, direction] = currentSort.split(' ');

      let newDirection = 'DESC';
      if (field === sortBy && direction === 'DESC') {
        newDirection = 'ASC';
      }

      document.getElementById('sortBy').value = `${sortBy} ${newDirection}`;
      loadAbcData();
    });
  });
}

// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}


// Show process details modal
window.showProcessDetails = async function(processId) {
  try {
    const details = await getProcessDetails(processId);

    // Calculate totals
    const totalPayroll = details.reduce((sum, d) => sum + d.out_allocated_payroll, 0);
    const totalWorkspace = details.reduce((sum, d) => sum + d.out_allocated_workspace, 0);
    const totalOther = details.reduce((sum, d) => sum + d.out_allocated_other, 0);
    const totalCost = details.reduce((sum, d) => sum + d.out_allocated_total, 0);

    const processName = details[0]?.out_process_name || 'Неизвестный процесс';

    const modalHtml = `
      <div class="metric-modal-overlay" id="process-detail-modal">
        <div class="metric-modal" style="width: min(96vw, 1000px);">
          <div class="metric-modal__header">
            <i data-lucide="file-text"></i>
            <div class="metric-modal__title">Детали процесса</div>
            <div class="metric-modal__subtitle">${processName}</div>
            <div class="metric-modal__actions">
              <button class="metric-close" id="closeProcessDetail">×</button>
            </div>
          </div>
          <div class="metric-modal__body">
            <div class="process-summary-grid">
              <div class="process-summary-card">
                <div class="summary-label">Общие затраты</div>
                <div class="summary-value">${fmtCost(totalCost)} тыс. ₽</div>
              </div>
              <div class="process-summary-card">
                <div class="summary-label">Зарплаты</div>
                <div class="summary-value">${fmtCost(totalPayroll)} тыс. ₽</div>
                <div class="summary-pct">${fmt(totalPayroll / totalCost * 100, 1)}%</div>
              </div>
              <div class="process-summary-card">
                <div class="summary-label">Помещения</div>
                <div class="summary-value">${fmtCost(totalWorkspace)} тыс. ₽</div>
                <div class="summary-pct">${fmt(totalWorkspace / totalCost * 100, 1)}%</div>
              </div>
              <div class="process-summary-card">
                <div class="summary-label">Прочие</div>
                <div class="summary-value">${fmtCost(totalOther)} тыс. ₽</div>
                <div class="summary-pct">${fmt(totalOther / totalCost * 100, 1)}%</div>
              </div>
            </div>

            <h4>Распределение по подразделениям</h4>
            <table class="metric-table">
              <thead>
                <tr>
                  <th>Подразделение</th>
                  <th>Сотрудники</th>
                  <th>Распределение</th>
                  <th>Затраты</th>
                  <th>% от процесса</th>
                </tr>
              </thead>
              <tbody>
                ${details.map(d => `
                  <tr>
                    <td>${d.out_dept_name}</td>
                    <td class="mono">${d.out_dept_employees || '-'}</td>
                    <td class="mono">${fmt(d.out_allocation_rate * 100, 1)}%</td>
                    <td class="mono">${fmtCost(d.out_allocated_total)} тыс.</td>
                    <td class="mono">${fmt(d.out_pct_of_process, 1)}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    refreshIcons();

    const modal = document.getElementById('process-detail-modal');
    const closeBtn = document.getElementById('closeProcessDetail');

    function close() {
      modal.classList.remove('is-open');
      setTimeout(() => modal.remove(), 180);
    }

    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
    closeBtn.addEventListener('click', close);

    setTimeout(() => modal.classList.add('is-open'), 10);

  } catch (error) {
    console.error('Error loading process details:', error);
  }
};