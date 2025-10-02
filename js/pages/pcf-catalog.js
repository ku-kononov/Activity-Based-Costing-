// js/pages/pcf-catalog.js
import { fetchPCFRows } from '../api.js';
import { refreshIcons } from '../utils.js';

/* ================== Утилиты ================== */
function normalizeCode(codeRaw) {
  const s = String(codeRaw || '').trim();
  if (!s) return '';
  let t = s.replace(/^PCF[-\s]*/i, '');
  t = t.replace(/[^\d.]/g, '');
  if (!t) return '';
  t = t.replace(/^\.+|\.+$/g, '').replace(/\.+/g, '.');
  if (/^\d+$/.test(t)) return `${parseInt(t, 10)}.0`;
  return t;
}
function getMajorAny(raw) {
  const n = normalizeCode(raw);
  if (!n) return NaN;
  const [major] = n.split('.');
  const m = parseInt(major, 10);
  return Number.isNaN(m) ? NaN : m;
}
function isLevel2(nCode) { return /^\d+\.\d+$/.test(nCode); }
function cmpNormCodes(a, b) {
  const A = a.split('.').map(x => parseInt(x, 10) || 0);
  const B = b.split('.').map(x => parseInt(x, 10) || 0);
  const len = Math.max(A.length, B.length);
  for (let i = 0; i < len; i++) {
    const d = (A[i] || 0) - (B[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

/* ================== Данные ================== */
function normalizeRow(rawRow) {
  return {
    code: normalizeCode(rawRow.code),
    name: String(rawRow.name || '').trim(),
    parent_id: String(rawRow.parent_id || ''),
  };
}
function getTopLevelProcesses(allNormalizedRows) {
  return allNormalizedRows.filter(row => /^\d+\.0$/.test(row.code));
}

/* ================== Рендер ================== */
function blockHTML(title, color, items, iconName, subtitle, groupKey) {
  const itemsHTML = items.length
    ? items.map(it => `
        <button class="pcf-item" data-code="${it.code}" data-name="${it.name}" data-group="${groupKey}">
          <span class="pcf-code">${it.code}</span>
          <span class="pcf-name">${it.name}</span>
        </button>`).join('')
    : '<div class="pcf-empty">Нет данных для этой группы</div>';

  return `
    <div class="card pcf-group-card" style="--group-color:${color};">
      <div class="card-header pcf-group-header">
        <i data-lucide="${iconName}" class="pcf-group-icon"></i>
        <div class="pcf-group-titles">
          <h3 class="card-title pcf-group-title">${title}</h3>
          <p class="pcf-group-subtitle">${subtitle}</p>
        </div>
      </div>
      <div class="pcf-items-container">${itemsHTML}</div>
    </div>`;
}

function setHeaderTitle(container, text) {
  const titleEl = container.querySelector('.pcf-catalog-header .card-title');
  if (titleEl) titleEl.textContent = text;
}

function renderCatalog(container, allNormalizedRows) {
  // Заголовок уровня 1
  setHeaderTitle(container, 'Каталог бизнес-процессов');

  // Убираем кнопку "Назад"
  const actions = container.querySelector('#pcf-header-actions');
  if (actions) actions.innerHTML = '';

  const grid = container.querySelector('#pcf-grid-container');
  const topLevel = getTopLevelProcesses(allNormalizedRows);

  const byMajor = (majors) => topLevel
    .filter(p => majors.includes(getMajorAny(p.code)))
    .sort((a, b) => cmpNormCodes(a.code, b.code));

  const groups = {
    core: byMajor([2,3,4,5,6]),
    enablement: byMajor([7,8,9,10,11,12]),
    management: byMajor([1,13]),
  };

  const managementHTML = blockHTML(
    'Управление', 'var(--warning)', groups.management, 'tower-control',
    'Процессы - разработка стратегических целей компании и управление бизнес-возможностями', 'management'
  );
  const coreHTML = blockHTML(
    'Основные', 'var(--blue)', groups.core, 'gauge',
    'Процессы определяют создание и предоставление товаров или услуг клиентам, генерируют прибыль организации', 'core'
  );
  const enablementHTML = blockHTML(
    'Обеспечение', 'var(--success)', groups.enablement, 'fuel',
    'Процессы поддерживают стабильную работу основных процессов, но сами не генерируют прибыль', 'enablement'
  );

  grid.innerHTML = managementHTML + coreHTML + enablementHTML;
  refreshIcons();

  grid.querySelectorAll('.pcf-item').forEach(btn => {
    btn.addEventListener('click', () => {
      renderLevel2(container, allNormalizedRows, { code: btn.dataset.code, name: btn.dataset.name });
    });
  });
}

function renderLevel2(container, allNormalizedRows, top) {
  window.scrollTo(0, 0);

  const parentMajor = getMajorAny(top.code);
  const groupKey = [2,3,4,5,6].includes(parentMajor) ? 'core'
                 : [7,8,9,10,11,12].includes(parentMajor) ? 'enablement'
                 : 'management';

  const meta = {
    core:       { color: 'var(--blue)' },
    enablement: { color: 'var(--success)' },
    management: { color: 'var(--warning)' },
  }[groupKey];

  // Заголовок уровня 2
  setHeaderTitle(container, 'Каталог бизнес-функций');

  // Кнопка "Назад в каталог" справа (в цвете группы)
  const headerActions = container.querySelector('#pcf-header-actions');
  headerActions.innerHTML = `
    <button class="btn-back-to-catalog" style="--group-color:${meta.color}; background:${meta.color}; border-color:${meta.color};">
      <i data-lucide="arrow-left"></i>
      <span>Назад в каталог</span>
    </button>`;
  headerActions.querySelector('.btn-back-to-catalog').addEventListener('click', () => {
    renderCatalog(container, allNormalizedRows);
  });

  // Вертикальный список L2: только N.M (исключая N.0)
  const grid = container.querySelector('#pcf-grid-container');
  const children = allNormalizedRows
    .filter(row => getMajorAny(row.code) === parentMajor && isLevel2(row.code) && row.code !== top.code)
    .sort((a, b) => cmpNormCodes(a.code, b.code));

  const itemsHTML = children.length
    ? children.map(ch => `
        <div class="pcf-l2-list-item">
          <span class="pcf-l2-item-code">${ch.code}</span>
          <span class="pcf-l2-item-name">${ch.name}</span>
        </div>`).join('')
    : '<div class="pcf-empty">Процессы второго уровня для этой группы отсутствуют.</div>';

  // Блок L2: «код + имя» топ-процесса в одну строку, цвет группы, без иконки
  grid.innerHTML = `
    <div class="card pcf-l2-container" style="--group-color:${meta.color};">
      <div class="pcf-l2-block-header">
        <div class="pcf-l2-topline">
          <span class="pcf-l2-top-code">${top.code}</span>
          <span class="pcf-l2-top-name">${top.name}</span>
        </div>
      </div>
      <div class="pcf-l2-items-list">
        ${itemsHTML}
      </div>
    </div>`;

  refreshIcons();
}

/* ================== Точка входа ================== */
export async function renderPCFPage(container) {
  container.innerHTML = `
    <section class="data-card pcf-page">
      <div class="card-header pcf-catalog-header">
        <div class="title-container pcf-title">
          <i data-lucide="waypoints" class="main-icon pcf-header-icon"></i>
          <div class="pcf-title-texts">
            <h3 class="card-title">Каталог бизнес-процессов</h3>
            <p class="card-subtitle">Группы процессов PCF-классификация (Process Classification Framework)</p>
          </div>
        </div>
        <div id="pcf-header-actions" class="pcf-header-actions"></div>
      </div>
      <div id="pcf-grid-container" class="widgets-grid pcf-grid">
        <p>Загрузка процессов...</p>
      </div>
    </section>`;
  refreshIcons();

  try {
    const rawProcesses = await fetchPCFRows();
    const normalizedProcesses = rawProcesses.map(normalizeRow);
    renderCatalog(container, normalizedProcesses);
  } catch (error) {
    console.error('Ошибка при рендеринге PCF:', error);
    container.querySelector('#pcf-grid-container').innerHTML = `
      <div class="card" style="border-color: var(--danger); grid-column: 1 / -1;">
        <div class="card-header"><h3 class="card-title">Ошибка загрузки данных</h3></div>
        <div style="padding: 8px;">${error.message || String(error)}</div>
      </div>`;
  }
}