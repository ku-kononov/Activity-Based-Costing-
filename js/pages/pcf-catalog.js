// js/pages/pcf-catalog.js
import { fetchPCFRows, fetchCostDriverPCFOrgRows, fetchOrgStructure } from '../api.js';
import { refreshIcons } from '../utils.js';

/* ========== Встроенные стили (однократно) ========== */
let __pcfStylesInjected = false;
function ensurePcfStyles() {
  if (__pcfStylesInjected) return;
  const css = `
  /* Заголовок страницы */
  .pcf-page .pcf-catalog-header {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    margin-bottom: 24px;
  }
  .pcf-page .pcf-title-block { display: flex; align-items: center; gap: 16px; }
  .pcf-page .pcf-title-block .main-icon { color: var(--blue); width: 32px; height: 32px; }
  .pcf-page .pcf-title-block .card-title { color: var(--blue) !important; font-size: 24px; font-weight: 700; margin: 0; }
  .pcf-page .pcf-title-block .card-subtitle { margin-top: 2px; font-size: 14px; color: var(--muted); }

  /* Кнопка назад */
  .pcf-header-actions { display: flex; align-items: center; gap: 8px; }
  .btn-back-to-catalog {
    display: inline-flex; align-items: center; gap: 8px;
    height: 38px; padding: 0 16px; border-radius: 10px;
    border: none; background: var(--group-color); color: #fff;
    font-weight: 700; cursor: pointer; white-space: nowrap;
    transition: all .2s ease;
    box-shadow: 0 4px 12px -2px color-mix(in srgb, var(--group-color) 40%, transparent);
  }
  .btn-back-to-catalog:hover { filter: brightness(1.1); transform: translateY(-2px); box-shadow: 0 8px 16px -4px color-mix(in srgb, var(--group-color) 40%, transparent); }
  .btn-back-to-catalog i { width: 18px; height: 18px; }

  /* Контейнер и заголовок L2 */
  .pcf-l2-container { grid-column: 1 / -1; background: transparent; border: none; box-shadow: none; padding: 0; }
  .pcf-l2-header {
    padding: 16px 24px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: var(--shadow);
    display: flex; align-items: center; justify-content: space-between;
  }
  .pcf-l2-title { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .pcf-l2-code { font-weight: 900; font-size: 24px; color: var(--group-color); }
  .pcf-l2-name { font-weight: 700; font-size: 24px; color: var(--group-color); }
  .pcf-l2-group-chip { padding: 5px 14px; border-radius: 999px; background: var(--group-color); color: #fff; font-size: 13px; font-weight: 700; }

  /* Новый грид для карточек L2 */
  .pcf-l2-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 24px; margin-top: 24px; }

  /* Карточка процесса L2 */
  .pcf-l2-item-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: var(--shadow);
    display: flex; flex-direction: column;
    transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
    cursor: pointer;
  }
  .pcf-l2-item-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 12px 24px rgba(0,0,0,0.08);
    border-color: var(--group-color);
  }
  .pcf-l2-item-header { padding: 16px 20px; border-bottom: 1px solid var(--divider); display: flex; align-items: baseline; gap: 12px; }
  .pcf-l2-item-code { font-size: 20px; font-weight: 800; color: var(--group-color); }
  .pcf-l2-item-name { font-size: 20px; font-weight: 600; color: var(--group-color); }
  
  .pcf-l2-item-body { padding: 20px; display: flex; flex-direction: column; gap: 24px; flex-grow: 1; }
  
  .pcf-l2-section-title {
    display: inline-flex; align-items: center; gap: 10px;
    font-size: 13px; font-weight: 700; padding: 6px 12px; border-radius: 8px;
    color: color-mix(in srgb, var(--group-color) 90%, black);
    background-color: color-mix(in srgb, var(--group-color) 15%, transparent);
    margin-bottom: 12px;
  }
  .pcf-l2-section-title i { width: 16px; height: 16px; }
  
  .pcf-l2-departments-list ul { list-style-type: none; padding-left: 0; margin: 0; }
  .pcf-l2-departments-list li {
    font-size: 14px; padding: 6px 0 6px 18px;
    border-left: 2px solid var(--divider); position: relative;
  }
  .pcf-l2-departments-list li::before {
    content: ''; position: absolute; left: 0; top: 17px;
    width: 10px; height: 2px; background: var(--divider);
  }
  .pcf-l2-departments-list .dept-name { font-weight: 600; }
  .pcf-l2-departments-list .level-0 > .dept-name,
  .pcf-l2-departments-list .level-1 > .dept-name {
    color: var(--muted);
    font-weight: 500;
  }
  .pcf-l2-departments-list ul { margin-top: 6px; padding-left: 20px; }

  /* Карточки групп на первом экране */
  .pcf-page .pcf-group-card { border-top: 4px solid var(--group-color); }
  .pcf-page .pcf-group-icon { color: var(--group-color); }
  .pcf-page .pcf-group-title { color: var(--group-color) !important; }
  .pcf-page .pcf-group-card .pcf-item { padding: 10px 14px; min-height: 52px; background: color-mix(in srgb, var(--group-color) 85%, white); }
  .pcf-page .pcf-group-card .pcf-item .pcf-code,
  .pcf-page .pcf-group-card .pcf-item .pcf-name { color: #fff; }

  .pcf-page .widgets-grid { grid-template-columns: 1fr; gap: 14px; }
  `;
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
  __pcfStylesInjected = true;
}

const normalizeCode = (c) => String(c||'').trim().replace(/^PCF[-\s]*/i,'').replace(/[^\d.]/g,'').replace(/^\.+|\.+$/g,'').replace(/\.+/g,'.');
const getMajorAny = (c) => parseInt(String(c||'').split('.')[0],10)||0;
const isLevel2 = (c) => /^\d+\.\d+$/.test(c);
const cmpNormCodes = (a, b) => {
  const A = a.split('.').map(Number), B = b.split('.').map(Number);
  for (let i=0; i<Math.max(A.length,B.length); i++) {
    const d = (A[i]||0) - (B[i]||0);
    if (d !== 0) return d;
  }
  return 0;
};
function normalizeRow(raw) {
  const id = String(raw.id ?? raw['Process ID'] ?? '').trim();
  const code = normalizeCode(raw.code ?? raw['PCF Code'] ?? id);
  const name = String(raw.name ?? raw['Process Name'] ?? '').trim();
  const parent_id = normalizeCode(String(raw.parent_id ?? raw['Parent Process ID'] ?? '').trim());
  return { id, code, name, parent_id, major: getMajorAny(code) };
}
function getTopLevelProcesses(rows) {
  let tops = rows.filter(r => /^\d+\.0$/.test(r.code));
  if (!tops.length) tops = rows.filter(r => !r.parent_id && r.code);
  const seen = new Set();
  return tops.filter(r => {
    if (!r.major || seen.has(r.major)) return false;
    seen.add(r.major); return true;
  }).sort((a,b) => cmpNormCodes(a.code,b.code));
}

function blockHTML(title, color, items, icon, subtitle, key) {
  const itemsHTML = items.length
    ? items.map(it => `
        <button class="pcf-item" data-code="${it.code}" data-id="${it.id||''}" data-name="${it.name}" data-group="${key}">
          <span class="pcf-code">${it.code}</span>
          <span class="pcf-name">${it.name}</span>
        </button>`).join('')
    : '<div class="pcf-empty">Нет данных</div>';
  
  return `<div class="card pcf-group-card" style="--group-color:${color};"><div class="card-header pcf-group-header"><i data-lucide="${icon}" class="pcf-group-icon"></i><div class="pcf-group-titles"><h3 class="card-title pcf-group-title">${title}</h3><p class="pcf-group-subtitle">${subtitle}</p></div></div><div class="pcf-items-container">${itemsHTML}</div></div>`;
}

function renderCatalog(container, allRows, costDriverData, orgStructure) {
  const header = container.querySelector('.pcf-catalog-header .pcf-title-block');
  if(header) {
    header.querySelector('h3').textContent = 'Каталог бизнес-процессов';
    header.querySelector('p').textContent = 'Процессы по PCF-классификации';
  }
  container.querySelector('#pcf-header-actions').innerHTML = '';
  const grid = container.querySelector('#pcf-grid-container');
  const topLevel = getTopLevelProcesses(allRows);
  const byMajor = (majors) => topLevel.filter(p => majors.includes(p.major));

  grid.innerHTML = 
    blockHTML('Управление', 'var(--warning)', byMajor([1,13]), 'tower-control', 'Стратегия и управление', 'management') +
    blockHTML('Основные','var(--blue)', byMajor([2,3,4,5,6]), 'gauge', 'Создание и доставка ценности', 'core') +
    blockHTML('Обеспечение','var(--success)', byMajor([7,8,9,10,11,12]), 'fuel', 'Поддержка и инфраструктура', 'enablement');
  
  refreshIcons();
  grid.querySelectorAll('.pcf-item').forEach(b=>b.addEventListener('click',()=>renderLevel2(container, allRows, b.dataset, costDriverData, orgStructure)));
}

function deriveL2FromDeeper(allRows, parentMajor) {
   const groups = new Map();
   for (const r of allRows) {
     if (r.major !== parentMajor) continue;
     const parts = (r.code || '').split('.');
     if (parts.length < 3) continue;
     const l2 = `${parts[0]}.${parts[1]}`;
     if (!groups.has(l2)) groups.set(l2, []);
     groups.get(l2).push(r);
   }
   return Array.from(groups.entries()).map(([code, arr]) => {
     const name = arr.find(x => x.name)?.name || `Процесс ${code}`;
     const id = arr.find(x => x.id)?.id || '';
     return { code, name, id };
   }).sort((a, b) => cmpNormCodes(a.code, b.code));
}

function labelForGroup(parentMajor) {
  if ([2,3,4,5,6].includes(parentMajor)) return 'Основные';
  if ([7,8,9,10,11,12].includes(parentMajor)) return 'Обеспечение';
  return 'Управление';
}

function renderLevel2(container, allRows, top, costDriverData, orgStructure) {
  window.scrollTo(0, 0);

  const parentMajor = getMajorAny(top.code);
  const groupKey = [1,13].includes(parentMajor) ? 'management' : [2,3,4,5,6].includes(parentMajor) ? 'core' : 'enablement';
  const metaColor = {core:'var(--blue)', enablement:'var(--success)', management:'var(--warning)'}[groupKey];

  const header = container.querySelector('.pcf-catalog-header .pcf-title-block');
  if(header) {
    header.querySelector('h3').textContent = 'Каталог бизнес-функций';
    header.querySelector('p').textContent = top.name;
  }
  const headerActions = container.querySelector('#pcf-header-actions');
  headerActions.innerHTML = `<button class="btn-back-to-catalog" style="--group-color:${metaColor};"><i data-lucide="arrow-left"></i><span>Назад в каталог</span></button>`;
  headerActions.querySelector('button').onclick = () => renderCatalog(container, allRows, costDriverData, orgStructure);

  const orgMap = new Map(orgStructure.map(row => [row['Department ID'], row]));

  const buildHierarchyTree = (leafDeptCodes) => {
    const tree = {};
    leafDeptCodes.forEach(id => {
      let path = [], currentId = id;
      while(currentId) {
        const dept = orgMap.get(currentId);
        if (!dept) break;
        path.unshift(dept);
        currentId = dept['Parent Department ID'];
      }
      
      let level = tree;
      path.forEach(deptNode => {
        const name = deptNode['Department Name'];
        if (!level[name]) level[name] = {};
        level = level[name];
      });
    });
    return tree;
  };
  
  const renderTree = (node, level = 0) => {
    const keys = Object.keys(node).sort((a,b) => a.localeCompare(b, 'ru'));
    if (!keys.length) return '';
    return `<ul>${keys.map(key => `<li class="level-${level}"><span class="dept-name">${key}</span>${renderTree(node[key], level + 1)}</li>`).join('')}</ul>`;
  };

  let children = allRows.filter(r => r.major === parentMajor && isLevel2(r.code) && r.code !== top.code).sort((a,b) => cmpNormCodes(a.code,b.code));
  if (!children.length) children = deriveL2FromDeeper(allRows, parentMajor);

  for (let ch of children) {
    const row = costDriverData.find(r => r['Process ID'] === ch.id);
    const codes = row ? Object.keys(row).filter(k => k.startsWith('ORG-') && Number(String(row[k]||'0').replace(',','.')) !== 0) : [];
    ch.departmentsHTML = codes.length ? renderTree(buildHierarchyTree(codes)) : '—';
    ch.costsHTML = '—';
  }

  const grid = container.querySelector('#pcf-grid-container');
  grid.innerHTML = `
    <div class="pcf-l2-container" data-group="${groupKey}">
      <div class="pcf-l2-header" style="--group-color:${metaColor};">
        <div class="pcf-l2-title">
          <span class="pcf-l2-code">${top.code}</span>
          <span class="pcf-l2-name">${top.name}</span>
        </div>
        <span class="pcf-l2-group-chip" style="background:${metaColor};">${labelForGroup(parentMajor)}</span>
      </div>
      <div class="pcf-l2-grid">
        ${children.length ? children.map(ch => `
          <div class="pcf-l2-item-card" data-code="${ch.code}" style="--group-color:${metaColor};">
            <div class="pcf-l2-item-header">
              <span class="pcf-l2-item-code">${ch.code || '—'}</span>
              <span class="pcf-l2-item-name">${ch.name || '—'}</span>
            </div>
            <div class="pcf-l2-item-body">
              <div>
                <div class="pcf-l2-section-title" style="--group-color:${metaColor};"><i data-lucide="users"></i>Подразделения-участники</div>
                <div class="pcf-l2-departments-list">${ch.departmentsHTML}</div>
              </div>
              <div>
                <div class="pcf-l2-section-title" style="--group-color:${metaColor};"><i data-lucide="coins"></i>Затраты процесса</div>
                <div class="pcf-l2-costs">${ch.costsHTML}</div>
              </div>
            </div>
          </div>`).join('')
        : `<div class="pcf-empty" style="grid-column: 1 / -1;">Нет дочерних процессов.</div>`}
      </div>
    </div>`;

  refreshIcons();
}

export async function renderPCFPage(container) {
  ensurePcfStyles();
  container.innerHTML = `<section class="data-card pcf-page"><div class="card-header pcf-catalog-header"><div class="pcf-title-block"><i data-lucide="waypoints" class="main-icon pcf-header-icon"></i><div class="pcf-title-texts"><h3 class="card-title">Каталог бизнес-процессов</h3><p class="card-subtitle">Процессы по PCF-классификации</p></div></div><div id="pcf-header-actions" class="pcf-header-actions"></div></div><div id="pcf-grid-container" class="widgets-grid pcf-grid"><p>Загрузка процессов...</p></div></section>`;
  refreshIcons();

  try {
    const [pcfRaw, costDriverData, orgStructure] = await Promise.all([
      fetchPCFRows(),
      fetchCostDriverPCFOrgRows(),
      fetchOrgStructure()
    ]);

    if (!pcfRaw || !pcfRaw.length) throw new Error('Таблица public."BOLT_pcf" пуста или недоступна.');
    const all = pcfRaw.map(normalizeRow).filter(r => r.code && r.name);
    renderCatalog(container, all, costDriverData, orgStructure);

  } catch (error) {
    console.error('Ошибка при рендеринге PCF:', error);
    container.querySelector('#pcf-grid-container').innerHTML = `<div class="card" style="border-color: var(--danger); grid-column: 1 / -1;"><div class="card-header"><h3 class="card-title">Ошибка загрузки</h3></div><div style="padding: 8px;">${error.message}</div></div>`;
  }
}