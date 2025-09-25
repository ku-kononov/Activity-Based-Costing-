// js/pages/pcf-catalog.js
import { fetchPCFRows } from '../api.js';
import { refreshIcons } from '../utils.js';
// import { navigate } from '../router.js'; // Пока не используется, если нет детальных страниц

/**
 * Группирует процессы верхнего уровня (X.0) по категориям.
 * @param {Array<object>} rows - Массив строк из Supabase.
 * @returns {object} - Объект с тремя группами процессов.
 */
function groupTopLevelProcesses(rows) {
  const mapped = rows.map(r => ({
    // Используем безопасный getProp для совместимости с разными названиями полей
    code: String(r['Process Code'] || r.code || ''),
    name: String(r['Process Name'] || r.name || ''),
  })).filter(x => /^\d+\.0$/.test(x.code)); // Только верхний уровень, например "2.0"

  const getMajorVersion = (code) => Number(code.split('.')[0]);
  const sortByCode = (a, b) => getMajorVersion(a.code) - getMajorVersion(b.code);

  const groups = {
    core: mapped.filter(p => [2, 3, 4, 5, 6].includes(getMajorVersion(p.code))).sort(sortByCode),
    enablement: mapped.filter(p => [7, 8, 9, 10, 11, 12].includes(getMajorVersion(p.code))).sort(sortByCode),
    management: mapped.filter(p => [1, 13].includes(getMajorVersion(p.code))).sort(sortByCode),
  };
  
  return groups;
}

/**
 * Создает HTML для одного блока (колонки) с процессами.
 * @param {string} title - Заголовок блока.
 * @param {string} color - Цвет акцента для блока.
 * @param {Array<object>} items - Массив процессов для отображения.
 * @returns {string} - HTML-строка для блока.
 */
function createProcessBlockHTML(title, color, items) {
  const itemsHTML = items.length > 0
    ? items.map(it => `
        <button class="pcf-item" data-code="${it.code}">
          <span class="pcf-code">${it.code}</span>
          <span class="pcf-name">${it.name}</span>
        </button>
      `).join('')
    : '<div class="pcf-empty">Нет данных для этой группы</div>';
    
  return `
    <div class="card pcf-group-card" style="--group-color: ${color};">
      <div class="card-header">
        <h3 class="card-title">${title}</h3>
      </div>
      <div class="pcf-items-container">
        ${itemsHTML}
      </div>
    </div>
  `;
}

/**
 * Главная функция рендеринга для страницы PCF.
 * @param {HTMLElement} container - DOM-элемент для вставки контента.
 */
export async function renderPCFPage(container) {
  // 1. Создаем базовую разметку страницы с новым заголовком
  container.innerHTML = `
    <section class="data-card pcf-page">
      <div class="card-header">
        <div class="title-container" style="gap: 12px; align-items: center;">
          <i data-lucide="waypoints" class="main-icon" style="color: var(--blue);"></i>
          <div>
            <h3 class="card-title" style="color: var(--blue);">Каталог бизнес-функций</h3>
            <p class="card-subtitle">PCF-классификация (Process Classification Framework)</p>
          </div>
        </div>
      </div>
      <div id="pcf-grid-container" class="widgets-grid" style="margin-top: 16px;">
        <p>Загрузка процессов...</p>
      </div>
    </section>
  `;
  refreshIcons(); // Отрисовываем иконку waypoints

  const pcfGrid = container.querySelector('#pcf-grid-container');

  // 2. Загружаем и обрабатываем данные
  try {
    const rows = await fetchPCFRows();
    const groups = groupTopLevelProcesses(rows);
    
    // 3. Генерируем HTML для каждого блока
    const coreHTML = createProcessBlockHTML('Основные', 'var(--blue)', groups.core);
    const enablementHTML = createProcessBlockHTML('Обеспечение', 'var(--success)', groups.enablement);
    const managementHTML = createProcessBlockHTML('Управление', 'var(--warning)', groups.management);

    // 4. Вставляем готовые блоки в контейнер
    pcfGrid.innerHTML = coreHTML + enablementHTML + managementHTML;
    
    // 5. Навешиваем обработчики кликов на кликабельные процессы
    pcfGrid.querySelectorAll('.pcf-item').forEach(button => {
      button.addEventListener('click', () => {
        const processCode = button.dataset.code;
        console.log(`Клик по процессу PCF: ${processCode}`);
        // Сюда можно будет добавить логику перехода на детальную страницу, например:
        // navigate(`pcf/${processCode}`);
      });
    });

  } catch (error) {
    console.error("Ошибка при рендеринге страницы PCF:", error);
    pcfGrid.innerHTML = `
      <div class="card" style="border-color: var(--danger); grid-column: 1 / -1;">
        <div class="card-header"><h3 class="card-title">Ошибка загрузки данных</h3></div>
        <div style="padding: 8px;">${error.message || String(error)}</div>
      </div>
    `;
  }
}