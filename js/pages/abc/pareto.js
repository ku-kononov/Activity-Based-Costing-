// js/pages/abc/pareto.js
import { refreshIcons } from '../../utils.js';
import { getParetoData } from '../../services/abc-data.js';

const fmt = (val, digits = 1) =>
  new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number.isFinite(val) ? val : 0);

export async function renderAbcPage(container, subpage) {
  if (subpage !== 'pareto') {
    container.innerHTML = '<div class="card"><p>Страница в разработке</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="analytics-page">
      <div class="abc-page-header">
        <div class="abc-page-title-block">
          <i data-lucide="trending-up" class="main-icon"></i>
          <div class="title-content">
            <h2 class="abc-title">Топ-процессы (Парето)</h2>
            <p class="abc-subtitle">80/20 правило для оптимизации затрат</p>
          </div>
        </div>
        <div class="abc-header-controls">
          <div class="abc-header-actions">
            <button class="btn-export btn-excel" onclick="exportParetoToExcel()">
              <i data-lucide="download"></i>
              <span>Excel</span>
            </button>
            <button class="btn-export btn-pdf" onclick="exportParetoToPdf()">
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

      <div class="pareto-kpis" id="paretoKpis">
        <div class="card">Загрузка...</div>
      </div>

      <div class="pareto-chart-section">
        <h3>Диаграмма Парето</h3>
        <div class="pareto-chart-container">
          <canvas id="paretoChart" width="600" height="300"></canvas>
        </div>
      </div>

      <div class="pareto-controls">
        <label>Показать топ:</label>
        <select id="topCountSelect">
          <option value="10">10</option>
          <option value="20" selected>20</option>
          <option value="50">50</option>
        </select>
      </div>

      <div class="pareto-table" id="paretoTable">
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

  await loadParetoData();
}

async function loadParetoData(count = 20) {
  try {
    const data = await getParetoData(count);

    // Calculate KPIs
    const top10 = data.slice(0, 10);
    const top10Pct = top10.reduce((sum, p) => sum + p.out_pct_of_total, 0);

    const top20 = data.slice(0, 20);
    const top20Pct = top20.reduce((sum, p) => sum + p.out_pct_of_total, 0);

    // Find 80% point
    let cumulative = 0;
    let eightyPoint = 0;
    for (let i = 0; i < data.length; i++) {
      cumulative += data[i].out_pct_of_total;
      if (cumulative >= 80 && eightyPoint === 0) {
        eightyPoint = i + 1;
      }
    }

    // Render KPIs
    document.getElementById('paretoKpis').innerHTML = `
      <div class="pareto-kpi-card">
        <div class="kpi-value">${fmt(top10Pct, 1)}%</div>
        <div class="kpi-label">Top-10 процессов</div>
        <div class="kpi-subtext">${fmt(top10Pct / 100 * data.reduce((sum, p) => sum + p.out_total_cost, 0) / 1000000, 1)}M ₽</div>
      </div>
      <div class="pareto-kpi-card">
        <div class="kpi-value">${fmt(top20Pct, 1)}%</div>
        <div class="kpi-label">Top-20 процессов</div>
        <div class="kpi-subtext">${fmt(top20Pct / 100 * data.reduce((sum, p) => sum + p.out_total_cost, 0) / 1000000, 1)}M ₽</div>
      </div>
      <div class="pareto-kpi-card">
        <div class="kpi-value">${eightyPoint}</div>
        <div class="kpi-label">Процессов для 80%</div>
        <div class="kpi-subtext">затрат</div>
      </div>
    `;

    // Render Pareto chart
    renderParetoChart(data);

    // Render table
    renderParetoTable(data);

    // Setup controls
    setupParetoControls(count);

  } catch (error) {
    console.error('Error loading Pareto data:', error);
    document.getElementById('paretoKpis').innerHTML = '<div class="card error">Ошибка загрузки данных</div>';
    document.getElementById('paretoTable').innerHTML = '<div class="card error">Ошибка загрузки данных</div>';
  }
}

// Export functions
window.exportParetoToExcel = async function() {
  try {
    const count = parseInt(document.getElementById('topCountSelect').value) || 20;
    const data = await getParetoData(count);

    const exportData = data.map(p => ({
      'Ранг': p.out_cost_rank,
      'Процесс': p.out_process_name,
      'Затраты (руб)': p.out_total_cost,
      '% от общего': p.out_pct_of_total,
      'Накопительный %': p.out_cumulative_pct,
      'Класс ABC': p.out_abc_class
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pareto Analysis');
    XLSX.writeFile(wb, `pareto_analysis_${new Date().toISOString().slice(0, 10)}.xlsx`);

  } catch (error) {
    console.error('Export to Excel failed:', error);
    alert('Ошибка экспорта в Excel');
  }
};

window.exportParetoToPdf = async function() {
  try {
    const count = parseInt(document.getElementById('topCountSelect').value) || 20;
    const data = await getParetoData(count);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('Анализ Парето (Top-' + count + ' процессов)', 20, 20);
    doc.setFontSize(10);
    doc.text(`Дата: ${new Date().toLocaleDateString('ru-RU')}`, 20, 30);

    const tableData = data.map(p => [
      p.out_cost_rank,
      p.out_process_name.substring(0, 25),
      fmt(p.out_total_cost / 1000000, 1) + 'M',
      fmt(p.out_pct_of_total, 1) + '%',
      fmt(p.out_cumulative_pct, 1) + '%',
      p.out_abc_class
    ]);

    doc.autoTable({
      head: [['Ранг', 'Процесс', 'Затраты', '%', 'Накоп.', 'Класс']],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [239, 68, 68] }
    });

    doc.save(`pareto_analysis_${new Date().toISOString().slice(0, 10)}.pdf`);

  } catch (error) {
    console.error('Export to PDF failed:', error);
    alert('Ошибка экспорта в PDF');
  }
};

// Render Pareto chart with bars and cumulative line
function renderParetoChart(data) {
  const canvas = document.getElementById('paretoChart');
  if (!canvas || !window.Chart) return;

  const ctx = canvas.getContext('2d');

  // Destroy existing chart
  if (window.paretoChartInstance) {
    window.paretoChartInstance.destroy();
  }

  const labels = data.map((_, i) => `Top ${i + 1}`);
  const barData = data.map(p => p.out_total_cost / 1000000); // in millions
  const lineData = data.map(p => p.out_cumulative_pct);

  window.paretoChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        type: 'bar',
        label: 'Затраты (M ₽)',
        data: barData,
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        yAxisID: 'y',
      }, {
        type: 'line',
        label: 'Накопительный %',
        data: lineData,
        borderColor: 'rgba(239, 68, 68, 1)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 3,
        pointBackgroundColor: 'rgba(239, 68, 68, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        fill: false,
        yAxisID: 'y1',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              if (context.datasetIndex === 0) {
                return `Затраты: ${fmt(context.raw, 1)}M ₽`;
              } else {
                return `Накопительный: ${fmt(context.raw, 1)}%`;
              }
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Топ-процессы' }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: 'Затраты (M ₽)' },
          ticks: { callback: (value) => fmt(value, 1) }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: { display: true, text: 'Накопительный %' },
          ticks: { callback: (value) => `${value}%` },
          grid: { drawOnChartArea: false },
        }
      }
    }
  });
}

// Render Pareto table
function renderParetoTable(data) {
  document.getElementById('paretoTable').innerHTML = `
    <table class="metric-table">
      <thead>
        <tr>
          <th>Ранг</th>
          <th>Процесс</th>
          <th>Затраты</th>
          <th>% от общего</th>
          <th>Накопительно</th>
          <th>Класс</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(p => `
          <tr>
            <td>${p.out_cost_rank}</td>
            <td>${p.out_process_name}</td>
            <td class="mono">${fmt(p.out_total_cost / 1000000, 1)}M</td>
            <td class="mono">${fmt(p.out_pct_of_total, 1)}%</td>
            <td class="mono">${fmt(p.out_cumulative_pct, 1)}%</td>
            <td><span class="abc-badge abc-class-${p.out_abc_class.toLowerCase()}">${p.out_abc_class}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Setup Pareto controls
function setupParetoControls(currentCount) {
  const select = document.getElementById('topCountSelect');
  if (select) {
    select.value = currentCount.toString();
    select.addEventListener('change', async (e) => {
      const count = parseInt(e.target.value);
      await loadParetoData(count);
    });
  }
}