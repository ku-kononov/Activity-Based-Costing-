// js/pages/pcf-catalog.js
import { fetchPCFRows } from '../api.js';
import { refreshIcons } from '../utils.js';

/* ================== Утилиты нормализации и сравнения ================== */

const pick = (obj, keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
};

const isEmpty = (v) => v == null || String(v).trim() === '';

/**
 * Приводит код вида "PCF-1.2", "1.2", "1" к нормализованному виду:
 * - Убирает префикс "PCF", дефисы и пробелы
 * - Оставляет только цифры и точки
 * - Если только major без точки — приводит к "N.0"
 * - Сохраняет многоуровневые коды (например, "1.2.3")
 */
function normalizeCode(codeRaw) {
  const s = String(codeRaw || '').trim();
  if (!s) return '';
  let t = s.replace(/^PCF[-\s]*/i, ''); // "PCF-1.0" -> "1.0"
  t = t.replace(/[^\d.]/g, '');        // убрать всё, кроме цифр и точек
  if (!t) return '';
  // убираем лишние точки по краям и избыточные
  t = t.replace(/^\.+|\.+$/g, '').replace(/\.+/g, '.');
  // если только major, добавим ".0"
  if (/^\d+$/.test(t)) return `${parseInt(t, 10)}.0`;
  return t;
}

/** Возвращает major часть (целое число) из любого вида кода */
function getMajorAny(raw) {
  const n = normalizeCode(raw);
  if (!n) return NaN;
  const [major] = n.split('.');
  const m = parseInt(major, 10);
  return Number.isNaN(m) ? NaN : m;
}

/** true, если нормализованный код — именно уровень 2 (например, "1.1") */
function isLevel2(nCode) {
  return /^\d+\.\d+$/.test(nCode);
}

/** Сравнение нормализованных кодов вида "1.2.3" корректно по уровням */
function cmpNormCodes(aRaw, bRaw) {
  const a = normalizeCode(aRaw);
  const b = normalizeCode(bRaw);
  const A = a.split('.').map(x => parseInt(x, 10) || 0);
  const B = b.split('.').map(x => parseInt(x, 10) || 0);
  const len = Math.max(A.length, B.length);
  for (let i = 0; i < len; i++) {
    const d = (A[i] || 0) - (B[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Приводит любой код к каноническому виду топ-уровня: "N.0" */
function canonicalTop(raw) {
  const n = normalizeCode(raw);
  if (!n) return '';
  const major = n.split('.')[0] || '';
  const m = parseInt(major, 10);
  if (Number.isNaN(m)) return '';
  return `${m}.0`;
}

/* ================== Построение данных для каталога ================== */

function normalizeRow(r) {
  return {
    code: normalizeCode(pick(r, ['PCF code', 'code'])),
    name: String(pick(r, ['Process Name', 'name']) || '').trim(),
    parent: normalizeCode(pick(r, ['Parent Process', 'parent'])),
    raw: r,
  };
}

function splitGroupsTopLevel(rows) {
  const all = rows.map(normalizeRow);

  // Верхний уровень — где Parent пуст или равен ""
  const top = all.filter(x => isEmpty(pick(x.raw, ['Parent Process', 'parent'])));

  const byMajor = (majors) =>
    top.filter(p => majors.includes(getMajorAny(p.code)))
       .sort((a, b) => cmpNormCodes(a.code, b.code));

  return {
    core:       byMajor([2,3,4,5,6]),
    enablement: byMajor([7,8,9,10,11,12]),
    management: byMajor([1,13]),
    all
  };
}

/* ================== Рендер HTML-кусочков ================== */

function blockHTML(title, color, items, iconName, subtitle, groupKey) {
  const itemsHTML = items.length
    ? items.map(it => `
        <button class="pcf-item" data-code="${it.code}" data-name="${it.name}" data-group="${groupKey}">
          <span class="pcf-code">${it.code}</span>
          <span class="pcf-name">${it.name}</span>
        </button>
      `).join('')
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
    </div>
  `;
}

function detailHeaderHTML(iconName, color, title) {
  return `
    <div class="pcf-detail-header" style="--group-color:${color}">
      <button class="icon-button pcf-back-button" aria-label="Назад к каталогу">
        <i data-lucide="chevron-left"></i>
      </button>
      <i data-lucide="${iconName}" class="pcf-detail-title-icon"></i>
      <h3 class="pcf-detail-title">${title}</h3>
    </div>
  `;
}

/* ================== Рендер представлений ================== */

function renderCatalog(container, groups) {
  const grid = container.querySelector('#pcf-grid-container');

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

  // Переход в детальный вид
  grid.querySelectorAll('.pcf-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.code;   // нормализованный "N.0"
      const name = btn.dataset.name;
      const major = getMajorAny(code);
      const groupKey =
        [2,3,4,5,6].includes(major) ? 'core' :
        [7,8,9,10,11,12].includes(major) ? 'enablement' : 'management';
      renderLevel2(container, groups.all, { code, name, groupKey });
    });
  });
}

function renderLevel2(container, allRows, top) {
  const grid = container.querySelector('#pcf-grid-container');

  // Фильтрация детей: Parent Process должен указывать на этот top (учитываем "PCF-1.0" ~ "1.0")
  const parentCanon = canonicalTop(top.code); // "N.0"
  let children = allRows
    .map(normalizeRow)
    .filter(r => canonicalTop(r.parent) === parentCanon && isLevel2(r.code))
    .sort((a, b) => cmpNormCodes(a.code, b.code));

  // Если по колонке Parent ничего не нашлось — подстрахуемся по major и уровню 2
  if (children.length === 0) {
    const maj = getMajorAny(top.code);
    children = allRows
      .map(normalizeRow)
      .filter(r => getMajorAny(r.code) === maj && isLevel2(r.code))
      .sort((a, b) => cmpNormCodes(a.code, b.code));
  }

  const meta = (k => {
    switch (k) {
      case 'core':       return { color: 'var(--blue)',    icon: 'gauge' };
      case 'enablement': return { color: 'var(--success)', icon: 'fuel' };
      default:           return { color: 'var(--warning)', icon: 'tower-control' };
    }
  })(top.groupKey);

  const header = detailHeaderHTML(meta.icon, meta.color, `${top.code} ${top.name}`);
  const itemsHTML = children.length
    ? children.map(ch => `
        <div class="pcf-detail-item" style="--group-color:${meta.color}">
          <span class="pcf-detail-code">${ch.code}</span>
          <span class="pcf-detail-name">${ch.name}</span>
        </div>
      `).join('')
    : '<div class="pcf-empty">Процессы второго уровня отсутствуют.</div>';

  grid.innerHTML = `
    <div class="pcf-detail-view">
      ${header}
      <div class="pcf-detail-list">${itemsHTML}</div>
    </div>
  `;
  refreshIcons();

  grid.querySelector('.pcf-back-button').addEventListener('click', async () => {
    // Возврат к каталогу
    const groups = splitGroupsTopLevel(allRows);
    renderCatalog(container, groups);
  });
}

/* ================== Точка входа страницы ================== */

export async function renderPCFPage(container) {
  // Статический каркас страницы — без инлайна, всё подхватывается из CSS
  container.innerHTML = `
    <section class="data-card pcf-page">
      <div class="card-header pcf-catalog-header">
        <div class="title-container pcf-title">
          <i data-lucide="waypoints" class="main-icon pcf-header-icon"></i>
          <div class="pcf-title-texts">
            <h3 class="card-title">Каталог бизнес-функций</h3>
            <p class="card-subtitle">Группы процессов PCF-классификация (Process Classification Framework)</p>
          </div>
        </div>
      </div>
      <div id="pcf-grid-container" class="widgets-grid pcf-grid">
        <p>Загрузка процессов...</p>
      </div>
    </section>
  `;
  refreshIcons();

  try {
    const rows = await fetchPCFRows();
    const groups = splitGroupsTopLevel(rows);
    renderCatalog(container, groups);
  } catch (error) {
    console.error('Ошибка при рендеринге PCF:', error);
    container.querySelector('#pcf-grid-container').innerHTML = `
      <div class="card" style="border-color: var(--danger); grid-column: 1 / -1;">
        <div class="card-header"><h3 class="card-title">Ошибка загрузки данных</h3></div>
        <div style="padding: 8px;">${error.message || String(error)}</div>
      </div>
    `;
  }
}