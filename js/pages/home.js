// js/pages/home.js
import { fetchOrgStats } from '../api.js';
import { refreshIcons } from '../utils.js';

// Структура данных для модулей
const modulesData = {
  architecture: [
    {
      title: 'Компания',
      icon: 'building-2',
      color: 'var(--accent)',
      link: () => navigate('org'),
      metrics: [
        { label: 'Подразделения', value: '...' },
        { label: 'Сотрудники', value: '...' }
      ]
    },
    {
      title: 'Процессы',
      icon: 'waypoints',
      color: 'var(--accent)',
      link: () => navigate('pcf'),
      metrics: [
        { label: 'Управление', value: '2', className: 'management' },
        { label: 'Основные', value: '5', className: 'core' },
        { label: 'Обеспечение', value: '6', className: 'enablement' }
      ]
    },
    {
      title: 'Затраты процессов',
      icon: 'chart-pie',
      color: 'var(--accent)',
      link: () => alert('Страница "Затраты процессов" в разработке.'),
      metrics: []
    }
  ],
  analytics: [
    {
      title: 'Данные',
      icon: 'database',
      color: '#6C757D',
      link: () => alert('Раздел "Аналитика" в разработке.'),
      metrics: []
    },
    {
      title: 'Анализ',
      icon: 'search',
      color: '#6C757D',
      link: () => alert('Раздел "Аналитика" в разработке.'),
      metrics: []
    },
    {
      title: 'Прогноз',
      icon: 'trending-up',
      color: '#6C757D',
      link: () => alert('Раздел "Аналитика" в разработке.'),
      metrics: []
    }
  ]
};

// Функция для генерации HTML одного модуля
function createModuleHTML(module) {
  const metricsHTML = module.metrics.length > 0
    ? `<ul class="module-metrics">
        ${module.metrics.map(metric => `
          <li class="${metric.className || ''}">
            <span class="metric-label">${metric.label}</span>
            <span class="metric-value" id="metric-${module.title.toLowerCase().replace(/\s/g, '-')}-${metric.label.toLowerCase().replace(/\s/g, '-')}">${metric.value}</span>
          </li>
        `).join('')}
      </ul>`
    : '<div class="module-placeholder">Скоро здесь появятся данные</div>';

  return `
    <div class="module-card" style="--module-color: ${module.color};" role="button" tabindex="0">
      <div class="module-header">
        <i data-lucide="${module.icon}" class="module-icon"></i>
        <h3 class="module-title">${module.title}</h3>
      </div>
      <div class="module-body">
        ${metricsHTML}
      </div>
    </div>
  `;
}

// Функция для генерации HTML-блока (секции) (ИЗМЕНЕНО)
function createBlockHTML(title, modules, icon) {
  // 4. Добавляем иконку в заголовок блока
  const iconHTML = icon ? `<i data-lucide="${icon}" class="home-block-icon"></i>` : '';
  return `
    <section class="home-block">
      <h2 class="home-block-title">
        ${iconHTML}
        <span>${title}</span>
      </h2>
      <div class="home-grid">
        ${modules.map(createModuleHTML).join('')}
      </div>
    </section>
  `;
}

// Главная функция рендеринга
export async function renderHomePage(container) {
  // 1. Рендерим структуру с новыми заголовками и иконками
  container.innerHTML = `
    <div class="home-page">
      ${createBlockHTML('Архитектура', modulesData.architecture, 'target')}
      ${createBlockHTML('Аналитика', modulesData.analytics, 'line-chart')}
    </div>
  `;

  // 2. Навешиваем обработчики кликов
  container.querySelectorAll('.module-card').forEach((card, index) => {
    const isArch = index < modulesData.architecture.length;
    const moduleIndex = isArch ? index : index - modulesData.architecture.length;
    const module = isArch ? modulesData.architecture[moduleIndex] : modulesData.analytics[moduleIndex];
    
    if (module.link) {
      card.addEventListener('click', module.link);
      card.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && module.link());
    }
  });

  // 3. Асинхронно загружаем динамические данные
  try {
    const stats = await fetchOrgStats();
    const departmentsValueEl = container.querySelector('#metric-компания-подразделения');
    const employeesValueEl = container.querySelector('#metric-компания-сотрудники');

    if (departmentsValueEl) {
      departmentsValueEl.textContent = stats.total_departments > 0 ? new Intl.NumberFormat('ru-RU').format(stats.total_departments) : '0';
    }
    if (employeesValueEl) {
      employeesValueEl.textContent = stats.total_employees > 0 ? new Intl.NumberFormat('ru-RU').format(stats.total_employees) : '0';
    }
  } catch (error) {
    console.error("Не удалось загрузить статистику для главной страницы:", error);
    const companyModuleBody = container.querySelector('#metric-компания-подразделения')?.closest('.module-body');
    if(companyModuleBody) {
      companyModuleBody.innerHTML = '<div class="module-placeholder error">Ошибка загрузки данных</div>';
    }
  }

  // 4. Отрисовываем иконки
  refreshIcons();
}