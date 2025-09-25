// js/pages/home.js
import { refreshIcons } from '../utils.js';

// --- ДАННЫЕ ДЛЯ ГЛАВНОЙ СТРАНИЦЫ ---

/**
 * Данные для KPI-виджетов.
 * Чтобы добавить/удалить виджет, просто измените этот массив.
 */
const kpiData = [
  { title: 'Выручка', subtitle: 'Revenue', value: '12,4 млн ₽' },
  { title: 'Прямые затраты', subtitle: 'Direct Costs', value: '7,9 млн ₽' },
  { title: 'Косвенные затраты (ABC)', subtitle: 'Indirect Costs (ABC)', value: '2,2 млн ₽' },
  { title: 'Чистая прибыль', subtitle: 'Net Profit', value: '2,3 млн ₽', isPositive: true },
];

/**
 * Данные и конфигурация для графиков.
 */
const chartData = [
  {
    id: 'donutChart',
    title: 'Жизненный цикл приложений',
    subtitle: 'Application Lifecycle',
    config: {
      type: 'doughnut',
      data: {
        labels: ['В эксплуатации', 'Внедрение', 'Вывод из эксплуатации'],
        datasets: [{ data: [58, 27, 15], backgroundColor: ['#4A89F3', '#00B39E', '#FF6B6B'], borderWidth: 0 }]
      },
      options: { plugins: { legend: { position: 'bottom' } }, cutout: '60%', maintainAspectRatio: false }
    }
  },
  {
    id: 'barChart',
    title: 'Затраты по подразделениям',
    subtitle: 'Costs by Departments',
    config: {
      type: 'bar',
      data: {
        labels: ['Продажи', 'IT', 'Логистика', 'Финансы'],
        datasets: [{ label: 'Затраты (₽)', data: [1800, 2400, 2100, 1600], backgroundColor: '#007BFF' }]
      },
      options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#E9ECEF' } } }, maintainAspectRatio: false }
    }
  },
  {
    id: 'lineChart',
    title: 'Динамика PnL',
    subtitle: 'PnL Trend',
    config: {
      type: 'line',
      data: {
        labels: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн'],
        datasets: [{ label: 'PnL (₽)', data: [200, 350, 300, 420, 380, 460], borderColor: '#28A745', backgroundColor: 'rgba(40,167,69,0.1)', tension: 0.3, fill: true }]
      },
      options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#E9ECEF' } } }, maintainAspectRatio: false }
    }
  }
];

// --- ЛОГИКА РЕНДЕРИНГА ---

/**
 * Создает HTML-разметку для одного KPI-виджета.
 * @param {object} data - Данные виджета.
 * @returns {string} - HTML-строка.
 */
function createKPIWidgetHTML({ title, subtitle, value, isPositive = false }) {
  return `
    <a class="card kpi-card" href="#">
      <div class="card-header">
        <h3 class="card-title">${title}</h3>
        <p class="card-subtitle">${subtitle}</p>
      </div>
      <div class="kpi-value ${isPositive ? 'positive' : ''}">${value}</div>
      <div class="card-actions">
        <button class="btn btn-link">Подробнее / View report</button>
      </div>
    </a>
  `;
}

/**
 * Создает HTML-разметку для одного виджета с графиком.
 * @param {object} data - Данные виджета.
 * @returns {string} - HTML-строка.
 */
function createChartWidgetHTML({ id, title, subtitle }) {
  // Иконки для кнопок можно вынести в данные, если нужно
  const icon = id.includes('donut') ? 'search' : (id.includes('bar') ? 'bar-chart-3' : 'line-chart');
  return `
    <a class="card" href="#">
      <div class="card-header">
        <h3 class="card-title">${title}</h3>
        <p class="card-subtitle">${subtitle}</p>
      </div>
      <div class="card-chart">
        <canvas id="${id}" aria-label="${title}"></canvas>
      </div>
      <div class="card-actions">
        <button class="btn btn-primary">
          <i data-lucide="${icon}"></i> <span>Исследовать</span>
        </button>
      </div>
    </a>
  `;
}

/**
 * Инициализирует все графики на странице.
 * @param {HTMLElement} container - Родительский элемент, в котором искать canvas.
 */
function initCharts(container) {
  if (!window.Chart || !container) return;

  chartData.forEach(chart => {
    const ctx = container.querySelector(`#${chart.id}`);
    if (ctx) {
      // Предотвращаем повторную инициализацию на одном и том же canvas
      if (Chart.getChart(ctx)) {
        Chart.getChart(ctx).destroy();
      }
      new Chart(ctx, chart.config);
    }
  });
}

/**
 * Главная функция рендеринга для главной страницы.
 * @param {HTMLElement} container - DOM-элемент для вставки контента.
 */
export function renderHomePage(container) {
  // 1. Генерируем HTML на основе данных
  const kpiHTML = kpiData.map(createKPIWidgetHTML).join('');
  const chartsHTML = chartData.map(createChartWidgetHTML).join('');

  const pageHTML = `
    <section class="widgets-grid kpi-row">
      ${kpiHTML}
    </section>
    <section class="widgets-grid">
      ${chartsHTML}
    </section>
  `;

  // 2. Вставляем HTML в контейнер
  container.innerHTML = pageHTML;

  // 3. Инициализируем динамические элементы
  initCharts(container);
  refreshIcons();
}