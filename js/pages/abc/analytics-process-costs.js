// js/pages/abc/analytics-process-costs.js
import { refreshIcons } from '../../utils.js';
import { getProcessCostsAnalytics, getDepartmentsForFilter, formatCurrency, formatNumber } from '../../services/abc-data.js';

// Глобальные переменные для состояния страницы
let currentData = [];
let currentFilter = 'all';
let isLoading = false;

// Загрузка данных аналитики затрат процессов
async function loadProcessCostsData() {
  const tableContainer = document.getElementById('process-costs-table-container');
  const loadingIndicator = document.getElementById('process-costs-loading');
  
  if (!tableContainer || !loadingIndicator) return;

  try {
    isLoading = true;
    showLoading(true);
    
    // Получаем данные
    const data = await getProcessCostsAnalytics(currentFilter);
    currentData = data;
    
    // Рендерим таблицу
    renderProcessCostsTable(data);
    
  } catch (error) {
    console.error('Error loading process costs data:', error);
    showError('Ошибка загрузки данных аналитики затрат процессов');
  } finally {
    isLoading = false;
    showLoading(false);
  }
}

// Отображение индикатора загрузки
function showLoading(show) {
  const loadingIndicator = document.getElementById('process-costs-loading');
  const tableContainer = document.getElementById('process-costs-table-container');
  
  if (loadingIndicator) {
    loadingIndicator.style.display = show ? 'block' : 'none';
  }
  
  if (tableContainer) {
    tableContainer.style.opacity = show ? '0.5' : '1';
  }
}

// Отображение ошибки
function showError(message) {
  const tableContainer = document.getElementById('process-costs-table-container');
  if (tableContainer) {
    tableContainer.innerHTML = `
      <div class="error-message">
        <div class="error-icon">
          <i data-lucide="alert-circle"></i>
        </div>
        <div class="error-text">${message}</div>
        <button class="btn-retry" onclick="location.reload()">
          <i data-lucide="refresh-cw"></i>
          <span>Повторить</span>
        </button>
      </div>
    `;
    refreshIcons();
  }
}

// Рендеринг таблицы аналитики затрат процессов
function renderProcessCostsTable(data) {
  const tableContainer = document.getElementById('process-costs-table-container');
  if (!tableContainer) return;

  if (!data || data.length === 0) {
    tableContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <i data-lucide="database"></i>
        </div>
        <div class="empty-title">Данные не найдены</div>
        <div class="empty-description">
          ${currentFilter === 'all' 
            ? 'В системе отсутствуют данные для аналитики затрат процессов' 
            : `Нет данных для подразделения "${currentFilter}"`}
        </div>
      </div>
    `;
    refreshIcons();
    return;
  }

  // Подсчет статистики
  const totalCosts = data.reduce((sum, item) => sum + item.totalCosts, 0);
  const totalFTE = data.reduce((sum, item) => sum + item.fte, 0);
  const avgCostPerFTE = totalFTE > 0 ? totalCosts / totalFTE : 0;

  // Создание HTML таблицы
  const tableHTML = `
    <div class="process-costs-header">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">
            <i data-lucide="hash"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value">${data.length}</div>
            <div class="stat-label">Процессов</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <i data-lucide="dollar-sign"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value">${formatCurrency(totalCosts)}</div>
            <div class="stat-label">Общие затраты</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <i data-lucide="users"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value">${formatNumber(totalFTE)}</div>
            <div class="stat-label">Общий FTE</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">
            <i data-lucide="trending-up"></i>
          </div>
          <div class="stat-content">
            <div class="stat-value">${formatCurrency(avgCostPerFTE)}</div>
            <div class="stat-label">Средняя ставка/FTE</div>
          </div>
        </div>
      </div>
    </div>

    <div class="table-container">
      <table class="process-costs-table">
        <thead>
          <tr>
            <th class="sortable" data-column="code">
              <span>Код</span>
              <i data-lucide="chevron-up-down" class="sort-icon"></i>
            </th>
            <th class="sortable" data-column="process">
              <span>Процесс</span>
              <i data-lucide="chevron-up-down" class="sort-icon"></i>
            </th>
            <th class="sortable" data-column="distributionRate">
              <span>Ставка распределения</span>
              <i data-lucide="chevron-up-down" class="sort-icon"></i>
            </th>
            <th class="sortable" data-column="totalCosts">
              <span>Сумма затрат</span>
              <i data-lucide="chevron-up-down" class="sort-icon"></i>
            </th>
            <th class="sortable" data-column="fte">
              <span>FTE</span>
              <i data-lucide="chevron-up-down" class="sort-icon"></i>
            </th>
          </tr>
        </thead>
        <tbody>
          ${data.map((item, index) => `
            <tr class="table-row" data-index="${index}">
              <td class="code-cell">
                <span class="process-code">${item.code}</span>
              </td>
              <td class="process-cell">
                <div class="process-name" title="${item.process}">${item.process}</div>
              </td>
              <td class="rate-cell">
                <span class="distribution-rate">${formatNumber(item.distributionRate)}</span>
              </td>
              <td class="cost-cell">
                <span class="total-costs">${formatCurrency(item.totalCosts)}</span>
              </td>
              <td class="fte-cell">
                <span class="fte-value">${formatNumber(item.fte)}</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  tableContainer.innerHTML = tableHTML;
  refreshIcons();
  
  // Добавляем обработчики сортировки
  addTableSortingHandlers();
  
  // Добавляем обработчики для строк таблицы
  addTableRowHandlers();
}

// Добавление обработчиков сортировки
function addTableSortingHandlers() {
  const sortableHeaders = document.querySelectorAll('.sortable');
  
  sortableHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.dataset.column;
      sortTableData(column);
    });
  });
}

// Сортировка данных таблицы
function sortTableData(column) {
  const isAscending = !currentData._sortDescending || currentData._sortColumn !== column;
  
  currentData.sort((a, b) => {
    let aVal = a[column];
    let bVal = b[column];
    
    // Для числовых значений
    if (column === 'totalCosts' || column === 'fte' || column === 'distributionRate') {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
    }
    
    // Для строковых значений
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (isAscending) {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });
  
  // Сохраняем состояние сортировки
  currentData._sortDescending = !isAscending;
  currentData._sortColumn = column;
  
  // Обновляем иконки сортировки
  updateSortIcons(column, isAscending);
  
  // Перерисовываем таблицу
  renderProcessCostsTable(currentData);
}

// Обновление иконок сортировки
function updateSortIcons(activeColumn, isAscending) {
  const sortIcons = document.querySelectorAll('.sort-icon');
  
  sortIcons.forEach(icon => {
    const header = icon.closest('.sortable');
    const column = header.dataset.column;
    
    if (column === activeColumn) {
      icon.setAttribute('data-lucide', isAscending ? 'chevron-up' : 'chevron-down');
    } else {
      icon.setAttribute('data-lucide', 'chevron-up-down');
    }
  });
  
  refreshIcons();
}

// Добавление обработчиков для строк таблицы
function addTableRowHandlers() {
  const tableRows = document.querySelectorAll('.table-row');
  
  tableRows.forEach(row => {
    row.addEventListener('click', () => {
      const index = row.dataset.index;
      showProcessDetails(currentData[index]);
    });
    
    // Hover эффекты
    row.addEventListener('mouseenter', () => {
      row.classList.add('row-hover');
    });
    
    row.addEventListener('mouseleave', () => {
      row.classList.remove('row-hover');
    });
  });
}

// Показать детали процесса
function showProcessDetails(processData) {
  const modal = document.createElement('div');
  modal.className = 'process-details-modal';
  modal.innerHTML = `
    <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>Детали процесса</h3>
        <button class="modal-close" onclick="this.closest('.process-details-modal').remove()">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="modal-body">
        <div class="detail-grid">
          <div class="detail-item">
            <label>Код процесса:</label>
            <span>${processData.code}</span>
          </div>
          <div class="detail-item">
            <label>Название процесса:</label>
            <span>${processData.process}</span>
          </div>
          <div class="detail-item">
            <label>Ставка распределения:</label>
            <span>${formatNumber(processData.distributionRate)}</span>
          </div>
          <div class="detail-item">
            <label>Сумма затрат:</label>
            <span class="cost-highlight">${formatCurrency(processData.totalCosts)}</span>
          </div>
          <div class="detail-item">
            <label>FTE:</label>
            <span>${formatNumber(processData.fte)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  refreshIcons();
}

// Загрузка списка подразделений для фильтра
async function loadDepartmentsFilter() {
  const filterSelect = document.getElementById('department-filter');
  if (!filterSelect) return;

  try {
    const departments = await getDepartmentsForFilter();
    
    // Создаем опции для селекта
    const optionsHTML = [
      '<option value="all">Все подразделения</option>',
      ...departments.map(dept => `<option value="${dept}">${dept}</option>`)
    ].join('');
    
    filterSelect.innerHTML = optionsHTML;
    
    // Устанавливаем текущее значение
    filterSelect.value = currentFilter;
    
  } catch (error) {
    console.error('Error loading departments for filter:', error);
    filterSelect.innerHTML = '<option value="all">Все подразделения</option>';
  }
}

// Обработчик изменения фильтра
function onFilterChange() {
  const filterSelect = document.getElementById('department-filter');
  if (!filterSelect) return;
  
  currentFilter = filterSelect.value;
  loadProcessCostsData();
}

export async function renderAbcPage(container, subpage) {
  if (!subpage.includes('analytics-process-costs')) {
    container.innerHTML = '<div class="card"><p>Страница в разработке</p></div>';
    return;
  }

  // Очищаем контейнер и устанавливаем базовую структуру
  container.innerHTML = `
    <div class="analytics-page">
      <div class="abc-page-header">
        <div class="abc-page-title-block">
          <i data-lucide="bar-chart-3" class="main-icon"></i>
          <div class="title-content">
            <h2 class="abc-title">Аналитика затрат процессов</h2>
            <p class="abc-subtitle">Подробный анализ и аналитика затрат</p>
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
          <div class="abc-department-filter">
            <label>Подразделение:</label>
            <select id="department-filter">
              <option value="all">Все подразделения</option>
            </select>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">
            <i data-lucide="table"></i>
            <span>Аналитическая таблица затрат процессов</span>
          </h3>
          <div class="card-subtitle">
            Детальная информация о затратах процессов с возможностью фильтрации по подразделениям
          </div>
        </div>
        
        <div id="process-costs-loading" class="loading-indicator">
          <div class="loading-spinner"></div>
          <span>Загрузка данных аналитики...</span>
        </div>
        
        <div id="process-costs-table-container">
          <div class="loading-placeholder">
            <div class="loading-placeholder-content">
              <i data-lucide="loader-2" class="loading-icon"></i>
              <span>Подготовка данных аналитики затрат процессов...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Инициализация иконок
  refreshIcons();

  // Загрузка данных
  await loadDepartmentsFilter();
  await loadProcessCostsData();

  // Загрузка периодов в селектор
  const periodSelect = document.getElementById('abcPagePeriodSelect');
  if (periodSelect) {
    try {
      const { getAvailablePeriods } = await import('../../services/abc-data.js');
      const periods = await getAvailablePeriods();
      periodSelect.innerHTML = periods.map(p =>
        `<option value="${p.code}">${p.name}</option>`
      ).join('');
    } catch (error) {
      console.warn('Failed to load ABC periods:', error);
    }
  }

  // Добавляем обработчик фильтра
  const departmentFilter = document.getElementById('department-filter');
  if (departmentFilter) {
    departmentFilter.addEventListener('change', onFilterChange);
  }
}