// js/pages/abc/analytics-process-costs.js
import { refreshIcons } from '../../utils.js';

// Функция загрузки HML-анализа
async function loadHMLAnalysis() {
  const contentDiv = document.getElementById('hml-analysis-content');
  if (!contentDiv) return;

  try {
    const { getAbcProcesses } = await import('../../services/abc-data.js');
    const processes = await getAbcProcesses();

    // Расчет стоимости единицы для каждого процесса
    const processesWithUnitCost = processes.map(process => {
      // Стоимость единицы = общая стоимость / количество подразделений (упрощенная логика)
      const unitCost = process.contributing_depts > 0 ?
        process.total_cost / process.contributing_depts : process.total_cost;

      return {
        ...process,
        unit_cost: unitCost
      };
    });

    // Сортировка по стоимости единицы
    processesWithUnitCost.sort((a, b) => b.unit_cost - a.unit_cost);

    // Классификация HML
    const totalProcesses = processesWithUnitCost.length;
    const highThreshold = Math.floor(totalProcesses * 0.2); // Top 20% - High
    const mediumThreshold = Math.floor(totalProcesses * 0.5); // Next 30% - Medium

    const classifiedProcesses = processesWithUnitCost.map((process, index) => {
      let hmlClass;
      if (index < highThreshold) {
        hmlClass = 'High';
      } else if (index < mediumThreshold) {
        hmlClass = 'Medium';
      } else {
        hmlClass = 'Low';
      }

      return {
        ...process,
        hml_class: hmlClass
      };
    });

    // Группировка по классам
    const hmlSummary = classifiedProcesses.reduce((acc, process) => {
      if (!acc[process.hml_class]) {
        acc[process.hml_class] = {
          count: 0,
          totalCost: 0,
          processes: []
        };
      }
      acc[process.hml_class].count++;
      acc[process.hml_class].totalCost += process.total_cost;
      acc[process.hml_class].processes.push(process);
      return acc;
    }, {});

    // Отображение результатов
    renderHMLAnalysis(hmlSummary);

  } catch (error) {
    console.error('Error loading HML analysis:', error);
    contentDiv.innerHTML = '<div class="error">Ошибка загрузки данных HML-анализа</div>';
  }
}

// Функция отображения HML-анализа
function renderHMLAnalysis(hmlSummary) {
  const contentDiv = document.getElementById('hml-analysis-content');
  if (!contentDiv) return;

  const totalProcesses = Object.values(hmlSummary).reduce((sum, cls) => sum + cls.count, 0);
  const totalCost = Object.values(hmlSummary).reduce((sum, cls) => sum + cls.totalCost, 0);

  let html = `
    <div class="hml-summary">
      <div class="hml-stats">
        <div class="stat-card">
          <h4>Всего процессов</h4>
          <div class="stat-value">${totalProcesses}</div>
        </div>
        <div class="stat-card">
          <h4>Общие затраты</h4>
          <div class="stat-value">${totalCost.toLocaleString()} ₽</div>
        </div>
      </div>

      <div class="hml-classes">
  `;

  // Классы в порядке High -> Medium -> Low
  const classOrder = ['High', 'Medium', 'Low'];
  const classLabels = {
    'High': 'High (высокая стоимость единицы)',
    'Medium': 'Medium (средняя стоимость единицы)',
    'Low': 'Low (низкая стоимость единицы)'
  };
  const classColors = {
    'High': '#ff6b6b',
    'Medium': '#ffd93d',
    'Low': '#6bcf7f'
  };

  classOrder.forEach(cls => {
    if (hmlSummary[cls]) {
      const data = hmlSummary[cls];
      const percentage = ((data.count / totalProcesses) * 100).toFixed(1);
      const costPercentage = ((data.totalCost / totalCost) * 100).toFixed(1);

      html += `
        <div class="hml-class-card" style="border-left-color: ${classColors[cls]}">
          <div class="class-header">
            <h4>${classLabels[cls]}</h4>
            <div class="class-stats">
              <span class="count">${data.count} процессов (${percentage}%)</span>
              <span class="cost">${data.totalCost.toLocaleString()} ₽ (${costPercentage}%)</span>
            </div>
          </div>
          <div class="class-description">
            ${getClassDescription(cls)}
          </div>
          <div class="top-processes">
            <h5>Топ-процессы в классе:</h5>
            <ul>
              ${data.processes.slice(0, 5).map(p => `
                <li>
                  <span class="process-name">${p.process_name}</span>
                  <span class="process-cost">${p.total_cost.toLocaleString()} ₽</span>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      `;
    }
  });

  html += `
      </div>
    </div>
  `;

  contentDiv.innerHTML = html;
}

// Функция получения описания класса
function getClassDescription(cls) {
  switch (cls) {
    case 'High':
      return 'Процессы с высокой стоимостью единицы ресурса (например, час квалифицированного специалиста, сложная операция). Требуют особого внимания для оптимизации.';
    case 'Medium':
      return 'Процессы со средней стоимостью единицы, составляющие «нормальный» фон затрат. Стандартные бизнес-процессы.';
    case 'Low':
      return 'Дешевые типовые операции, часто массовые и хорошо поддающиеся стандартизации или автоматизации. Потенциал для оптимизации минимален.';
    default:
      return '';
  }
}

export async function renderAbcPage(container, subpage) {
  if (!subpage.includes('analytics-process-costs')) {
    container.innerHTML = '<div class="card"><p>Страница в разработке</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="analytics-page">
      <div class="abc-page-header">
        <div class="abc-page-title-block">
          <i data-lucide="bar-chart-3" class="main-icon"></i>
          <div class="title-content">
            <h2 class="abc-title">Распределение процессов по классам затрат High/Medium/Low</h2>
            <p class="abc-subtitle">HML-анализ затрат процессов</p>
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

      <div class="card">
        <h3>HML-анализ затрат процессов</h3>
        <p>Классификация процессов по стоимости единицы ресурса: High (высокая стоимость), Medium (средняя стоимость), Low (низкая стоимость).</p>
        <div id="hml-analysis-content">
          <div class="loading">Загрузка данных...</div>
        </div>
      </div>
    </div>
  `;

  refreshIcons();

  // Загрузка HML-анализа
  loadHMLAnalysis();

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
}