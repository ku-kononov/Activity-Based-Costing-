// js/pages/home.js
import { refreshIcons } from '../utils.js';

const kpiData = [
  { title: 'Выручка', subtitle: 'Revenue', value: '12,4 млн ₽' },
  { title: 'Прямые затраты', subtitle: 'Direct Costs', value: '7,9 млн ₽' },
  { title: 'Косвенные затраты (ABC)', subtitle: 'Indirect Costs (ABC)', value: '2,2 млн ₽' },
  { title: 'Чистая прибыль', subtitle: 'Net Profit', value: '2,3 млн ₽', isPositive: true }
];

const charts = [
  { id:'donutChart', title:'Жизненный цикл приложений', subtitle:'Application Lifecycle', type:'doughnut', 
    labels:['В эксплуатации','Внедрение','Вывод из эксплуатации'], data:[58,27,15] },
  { id:'barChart', title:'Затраты по подразделениям', subtitle:'Costs by Departments', type:'bar', 
    labels:['Продажи','IT','Логистика','Финансы'], data:[1800,2400,2100,1600] },
  { id:'lineChart', title:'Динамика PnL', subtitle:'PnL Trend', type:'line', 
    labels:['Янв','Фев','Мар','Апр','Май','Июн'], data:[200,350,300,420,380,460] }
];

function kpiHTML({ title, subtitle, value, isPositive }) {
  return `
    <a class="card kpi-card" href="#">
      <div class="card-header">
        <h3 class="card-title">${title}</h3>
        <p class="card-subtitle">${subtitle}</p>
      </div>
      <div class="kpi-value ${isPositive ? 'positive' : ''}">${value}</div>
      <div class="card-actions"><button class="btn btn-link">Подробнее / View report</button></div>
    </a>`;
}

function chartHTML({ id, title, subtitle }) {
  const icon = id.includes('donut') ? 'search' : (id.includes('bar') ? 'bar-chart-3' : 'line-chart');
  return `
    <a class="card" href="#">
      <div class="card-header">
        <h3 class="card-title">${title}</h3>
        <p class="card-subtitle">${subtitle}</p>
      </div>
      <div class="card-chart"><canvas id="${id}" aria-label="${title}"></canvas></div>
      <div class="card-actions"><button class="btn btn-primary"><i data-lucide="${icon}"></i> <span>Исследовать</span></button></div>
    </a>`;
}

function initCharts(container) {
  if (!window.Chart) return;
  charts.forEach(c => {
    const ctx = container.querySelector(`#${c.id}`); if (!ctx) return;
    const cfg = c.type === 'doughnut' ? {
      type:'doughnut', data:{ labels:c.labels, datasets:[{ data:c.data, backgroundColor:['#4A89F3','#00B39E','#FF6B6B'], borderWidth:0 }]},
      options:{ plugins:{ legend:{ position:'bottom' }}, cutout:'60%', maintainAspectRatio:false }
    } : c.type === 'bar' ? {
      type:'bar', data:{ labels:c.labels, datasets:[{ label:'Затраты (₽)', data:c.data, backgroundColor:'#007BFF' }]},
      options:{ plugins:{ legend:{ display:false } }, scales:{ x:{ grid:{ display:false } }, y:{ grid:{ color:'#E9ECEF' } } }, maintainAspectRatio:false }
    } : {
      type:'line', data:{ labels:c.labels, datasets:[{ label:'PnL (₽)', data:c.data, borderColor:'#28A745', backgroundColor:'rgba(40,167,69,0.1)', tension:0.3, fill:true }]},
      options:{ plugins:{ legend:{ display:false } }, scales:{ x:{ grid:{ display:false } }, y:{ grid:{ color:'#E9ECEF' } } }, maintainAspectRatio:false }
    };
    // предотвращаем повторную инициализацию
    if (Chart.getChart(ctx)) Chart.getChart(ctx).destroy();
    new Chart(ctx, cfg);
  });
}

export function renderHomePage(container) {
  const kpis = kpiData.map(kpiHTML).join('');
  const chartBlocks = charts.map(chartHTML).join('');
  container.innerHTML = `
    <section class="widgets-grid kpi-row">${kpis}</section>
    <section class="widgets-grid">${chartBlocks}</section>`;
  initCharts(container);
  refreshIcons();
}