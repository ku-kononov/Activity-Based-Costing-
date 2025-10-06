// js/pages/pcf-catalog.js
import { fetchPCFRows } from '../api.js';
import { refreshIcons } from '../utils.js';

/* ========== Встроенные стили для L2 (однократно) ========== */
let __pcfStylesInjected = false;
function ensurePcfStyles() {
  if (__pcfStylesInjected) return;
  const css = `
  /* Заголовок страницы */
  .pcf-page .pcf-catalog-header {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  }
  .pcf-page .pcf-title .card-title { color: var(--blue) !important; margin: 0; line-height: 1.2; }
  .pcf-page .pcf-title .card-subtitle { margin: 4px 0 0; font-size: 13px; color: var(--muted); }

  /* Кнопка назад справа сверху */
  .pcf-header-actions { display: flex; align-items: center; gap: 8px; }
  .btn-back-to-catalog {
    display: inline-flex; align-items: center; gap: 8px;
    height: 36px; padding: 0 14px; border-radius: 10px;
    border: 1px solid var(--group-color); background: var(--group-color); color: #fff;
    font-weight: 700; cursor: pointer; white-space: nowrap;
    transition: filter .15s ease, transform .15s ease;
  }
  .btn-back-to-catalog:hover { filter: brightness(1.06); transform: translateY(-1px); }
  .btn-back-to-catalog i { width: 18px; height: 18px; color: currentColor; }

  /* Контейнер L2 */
  .pcf-l2-container {
    grid-column: 1 / -1;
    border-top: 4px solid var(--group-color);
    background: #fff; border: 1px solid var(--border); border-radius: var(--r-12); box-shadow: var(--shadow);
    overflow: hidden;
  }
  .pcf-l2-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 18px; border-bottom: 1px solid var(--border);
  }
  .pcf-l2-title {
    display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
  }
  .pcf-l2-code {
    font-weight: 900; font-size: 20px; color: var(--group-color);
  }
  .pcf-l2-name {
    font-weight: 800; font-size: 22px; color: var(--group-color);
  }
  .pcf-l2-group-chip {
    margin-left: 8px; padding: 4px 10px; border-radius: 999px; background: var(--group-color); color: #fff;
    font-size: 12px; font-weight: 700;
  }

  /* Таблица L2 */
  .pcf-l2-table-wrap { padding: 6px 8px 12px; }
  .pcf-l2-table {
    width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden;
  }
  .pcf-l2-table thead th {
    position: sticky; top: 0; background: var(--group-color); color: #fff;
    text-align: left; font-weight: 800; font-size: 13px; padding: 10px 12px;
  }
  .pcf-l2-table tbody td {
    padding: 10px 12px; border-bottom: 1px solid var(--divider); font-size: 14px; color: var(--text);
  }
  .pcf-l2-table tbody tr {
    cursor: pointer; transition: background-color .15s ease;
  }
  .pcf-l2-table tbody tr:hover { background: #f8fafc; }
  .pcf-l2-col-code { width: 120px; font-variant-numeric: tabular-nums; font-weight: 800; color: var(--group-color); }
  .pcf-l2-col-name { width: auto; }

  /* Карточки групп на первом экране */
  .pcf-page .pcf-group-card { border-top: 4px solid var(--group-color); }
  .pcf-page .pcf-group-icon { color: var(--group-color); width: 26px; height: 26px; margin-top: 1px; }
  .pcf-page .pcf-group-title { color: var(--group-color) !important; }
  
  /* Стили для топ-процессов уровня 1 */
  .pcf-page .pcf-group-card .pcf-code {
    font-size: 13px;  /* итого -18.75% от исходного 16px */
    font-weight: 400;  /* обычное начертание */
    line-height: 1.3;
    letter-spacing: 0.05px;
    margin: 2px 0 0;
  }
  .pcf-page .pcf-group-card .pcf-name {
    font-size: 14px;  /* итого -22% от исходного 18px */
    font-weight: 300;  /* легкое начертание */
    line-height: 1.4;
    margin: 4px 0 0;
  }
  /* Выравнивание содержимого карточек */
  .pcf-page .pcf-group-card .pcf-item {
    text-align: left;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    padding: 10px 14px;
    min-height: 52px;
  }

  /* Сетка */
  .pcf-page .widgets-grid { grid-template-columns: 1fr; gap: 14px; }
  `;
  const s = document.createElement('style');
  s.setAttribute('data-pcf-l2-styles', '1');
  s.textContent = css;
  document.head.appendChild(s);
  __pcfStylesInjected = true;
}

/* ================== Вспомогалки ================== */
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
function isLevel3plus(nCode) { return /^\d+\.\d+\./.test(nCode); }
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

/* ================== Нормализация ================== */
function normalizeRow(raw) {
  const id = String(raw.id ?? raw['Process ID'] ?? '').trim();
  const code = normalizeCode(raw.code ?? raw['PCF Code'] ?? id);
  const name = String(raw.name ?? raw['Process Name'] ?? '').trim();
  const parentRaw = String(raw.parent_id ?? raw['Parent Process ID'] ?? '').trim();
  const parent_id = normalizeCode(parentRaw);
  const major = getMajorAny(code);
  return { id, code, name, parent_id, major };
}

function getTopLevelProcesses(rows) {
  // 1) классика: строго N.0
  let tops = rows.filter(row => /^\d+\.0$/.test(row.code));
  // 2) fallback: у кого нет parent_id — считаем корнями
  if (!tops.length) {
    tops = rows.filter(r => !r.parent_id && r.code);
  }
  // уникальность по major
  const seen = new Set();
  tops = tops.filter(r => {
    const m = r.major;
    if (!m) return false;
    if (seen.has(m)) return false;
    seen.add(m);
    return true;
  });
  // сортировка по коду
  tops.sort((a, b) => cmpNormCodes(a.code, b.code));
  return tops;
}

/* ================== Рендер ================== */
function blockHTML(title, color, items, iconName, subtitle, groupKey) {
  const itemsHTML = items.length
    ? items.map(it => `
        <button class="pcf-item" data-code="${it.code}" data-id="${it.id || ''}" data-name="${it.name}" data-group="${groupKey}">
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
function setHeaderSubtitle(container, text) {
  const subEl = container.querySelector('.pcf-catalog-header .card-subtitle');
  if (subEl) subEl.textContent = text;
}

function renderCatalog(container, allRows) {
  setHeaderTitle(container, 'Каталог бизнес-процессов');
  setHeaderSubtitle(container, 'Процессы по PCF-классификации (Process Classification Framework)');

  // Кнопка "Назад" скрыта на первом экране
  const actions = container.querySelector('#pcf-header-actions');
  if (actions) actions.innerHTML = '';

  const grid = container.querySelector('#pcf-grid-container');
  const topLevel = getTopLevelProcesses(allRows);

  const byMajor = (majors) => topLevel
    .filter(p => majors.includes(p.major))
    .sort((a, b) => cmpNormCodes(a.code, b.code));

  const groups = {
    core: byMajor([2,3,4,5,6]),
    enablement: byMajor([7,8,9,10,11,12]),
    management: byMajor([1,13]),
  };

  const managementHTML = blockHTML(
    'Управление', 'var(--warning)', groups.management, 'tower-control',
    'Стратегия и управление бизнес‑возможностями', 'management'
  );
  const coreHTML = blockHTML(
    'Основные', 'var(--blue)', groups.core, 'gauge',
    'Создание и доставка ценности клиентам', 'core'
  );
  const enablementHTML = blockHTML(
    'Обеспечение', 'var(--success)', groups.enablement, 'fuel',
    'Поддержка и инфраструктура основных процессов', 'enablement'
  );

  grid.innerHTML = managementHTML + coreHTML + enablementHTML;
  refreshIcons();

  grid.querySelectorAll('.pcf-item').forEach(btn => {
    btn.addEventListener('click', () => {
      renderLevel2(container, allRows, {
        code: btn.dataset.code,
        name: btn.dataset.name,
        id: btn.dataset.id || ''
      });
    });
  });
}

function deriveL2FromDeeper(allRows, parentMajor) {
  // Строим L2 из глубины: группируем N.X.* в N.X
  const groups = new Map();
  for (const r of allRows) {
    if (r.major !== parentMajor) continue;
    const parts = (r.code || '').split('.');
    if (parts.length < 3) continue; // нужен хотя бы N.X.Y
    const l2 = `${parts[0]}.${parts[1]}`;
    if (!groups.has(l2)) groups.set(l2, []);
    groups.get(l2).push(r);
  }
  const result = Array.from(groups.entries()).map(([code, arr]) => {
    const name = (arr.find(x => x.name)?.name) || `Процесс ${code}`;
    return { code, name };
  }).sort((a, b) => cmpNormCodes(a.code, b.code));
  return result;
}

function labelForGroup(parentMajor) {
  if ([2,3,4,5,6].includes(parentMajor)) return 'Основные';
  if ([7,8,9,10,11,12].includes(parentMajor)) return 'Обеспечение';
  return 'Управление';
}

function renderLevel2(container, allRows, top) {
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

  setHeaderTitle(container, 'Каталог бизнес-функций');
  setHeaderSubtitle(container, 'Процессы по PCF-классификации (Process Classification Framework)');

  // Кнопка "Назад в каталог" — справа сверху
  const headerActions = container.querySelector('#pcf-header-actions');
  headerActions.innerHTML = `
    <button class="btn-back-to-catalog" style="--group-color:${meta.color}; background:${meta.color}; border-color:${meta.color};">
      <i data-lucide="arrow-left"></i>
      <span>Назад в каталог</span>
    </button>`;
  headerActions.querySelector('.btn-back-to-catalog').addEventListener('click', () => {
    renderCatalog(container, allRows);
  });

  // Список L2
  let children = allRows
    .filter(row => row.major === parentMajor && isLevel2(row.code) && row.code !== top.code)
    .sort((a, b) => cmpNormCodes(a.code, b.code))
    .map(ch => ({ code: ch.code, name: ch.name }));

  if (!children.length) {
    const topCode = top.code;
    const topIdNorm = normalizeCode(top.id || '');
    children = allRows
      .filter(r => r.parent_id && (r.parent_id === topCode || r.parent_id === topIdNorm))
      .map(r => ({ code: r.code || '—', name: r.name }))
      .sort((a, b) => cmpNormCodes(a.code, b.code));
  }

  if (!children.length) {
    children = deriveL2FromDeeper(allRows, parentMajor);
  }

  // Рендер блока
  const grid = container.querySelector('#pcf-grid-container');
  const groupLabel = labelForGroup(parentMajor);
  grid.innerHTML = `
    <div class="pcf-l2-container" style="--group-color:${meta.color};">
      <div class="pcf-l2-header">
        <div class="pcf-l2-title">
          <span class="pcf-l2-code">${top.code}</span>
          <span class="pcf-l2-name">${top.name}</span>
          <span class="pcf-l2-group-chip">${groupLabel}</span>
        </div>
      </div>
      <div class="pcf-l2-table-wrap">
        <table class="pcf-l2-table" aria-label="Процессы второго уровня">
          <thead>
            <tr>
              <th style="width:140px;">Код</th>
              <th>Название процесса</th>
            </tr>
          </thead>
          <tbody>
            ${
              children.length
                ? children.map(ch => `
                    <tr data-code="${ch.code}">
                      <td class="pcf-l2-col-code">${ch.code || '—'}</td>
                      <td class="pcf-l2-col-name">${ch.name || '—'}</td>
                    </tr>
                  `).join('')
                : `<tr><td colspan="2"><div class="pcf-empty">Нет дочерних процессов для этой группы.</div></td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>`;

  // Кликабельные строки
  const tbody = grid.querySelector('.pcf-l2-table tbody');
  tbody?.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-code]');
    if (!tr) return;
    const code = tr.getAttribute('data-code');
    const nameCell = tr.querySelector('.pcf-l2-col-name');
    const name = nameCell ? nameCell.textContent.trim() : '';
    // Здесь можно навигировать на L3/деталку (если внедрим позже).
    // Пока — диспатчим событие, чтобы можно было подключить обработчик.
    const ev = new CustomEvent('pcf:l2:select', { detail: { code, name, parent: top } });
    window.dispatchEvent(ev);
    // Визуальная обратная связь
    tr.style.backgroundColor = 'rgba(0,0,0,.035)';
    setTimeout(() => { tr.style.backgroundColor = ''; }, 150);
    // console.log('Select L2:', code, name);
  });

  refreshIcons();
}

/* ================== Точка входа ================== */
export async function renderPCFPage(container) {
  ensurePcfStyles();

  container.innerHTML = `
    <section class="data-card pcf-page">
      <div class="card-header pcf-catalog-header">
        <div class="title-container pcf-title">
          <i data-lucide="waypoints" class="main-icon pcf-header-icon"></i>
          <div class="pcf-title-texts">
            <h3 class="card-title">Каталог бизнес-процессов</h3>
            <p class="card-subtitle">Процессы по PCF-классификации (Process Classification Framework)</p>
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
    const raw = await fetchPCFRows();
    if (!raw || !raw.length) {
      throw new Error('Таблица public."BOLT_pcf" вернула 0 строк. Проверьте RLS SELECT и наличие данных.');
    }
    const all = raw.map(normalizeRow).filter(r => r.code && r.name);
    renderCatalog(container, all);
  } catch (error) {
    console.error('Ошибка при рендеринге PCF:', error);
    const grid = container.querySelector('#pcf-grid-container');
    grid.innerHTML = `
      <div class="card" style="border-color: var(--danger); grid-column: 1 / -1;">
        <div class="card-header"><h3 class="card-title">Ошибка загрузки данных</h3></div>
        <div style="padding: 8px; white-space: pre-wrap;">${error.message || String(error)}</div>
      </div>`;
  }
}