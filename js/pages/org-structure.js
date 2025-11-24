// js/pages/org-structure.js
import { fetchOrgRows, fetchData } from '../api.js';
import { debounce, norm, refreshIcons, iconSlugFor } from '../utils.js';

/* ========== Встроенные стили (CSS) ========== */
let __orgTableStylesInjected = false;
function ensureOrgTableStyles() {
  if (__orgTableStylesInjected) return;
  const css = `
    /* Современная кнопка процессов */
    .process-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 12px; border-radius: 8px; font-size: 13px; font-weight: 600;
      background: var(--surface); border: 1px solid var(--border); color: var(--text);
      cursor: pointer; transition: all 0.2s ease; white-space: nowrap;
    }
    .process-btn:hover:not([disabled]) {
      border-color: var(--blue); color: var(--blue); background: rgba(74, 137, 243, 0.05);
      transform: translateY(-1px); box-shadow: 0 2px 5px rgba(0,0,0,0.05);
    }
    .process-btn[disabled] { opacity: 0.5; cursor: not-allowed; background: var(--bg); }
    .process-btn i { width: 16px; height: 16px; }
    .process-count {
      background: var(--surface-1); padding: 2px 6px; border-radius: 4px; 
      font-size: 11px; font-weight: 700; color: var(--muted);
    }

    /* Лейаут строки в СПИСКЕ (Grid для выравнивания) */
    .org-node { margin-bottom: 2px; }
    .org-node-head {
      display: grid; 
      grid-template-columns: auto auto 1fr auto auto auto; /* Карет, Иконка, Название, Код, Числ, Кнопка */
      align-items: center; gap: 12px;
      padding: 8px 12px; border-radius: 8px;
      cursor: pointer; transition: background 0.15s ease;
      padding-left: calc(12px + var(--depth, 0) * 24px);
    }
    .org-node-head:hover { background: var(--surface-1); }
    
    /* Стрелки в Списке — цвет блока */
    .org-caret {
      background: none; border: none; cursor: pointer; padding: 4px;
      color: var(--dir-color, var(--muted)); transition: color 0.2s; display: flex; width: 24px; justify-content: center;
    }
    .org-caret:hover { color: var(--dir-color, var(--text)); }
    .org-caret:disabled { color: var(--muted); opacity: 0.35; cursor: default; }
    
    .org-node-icon { color: var(--dir-color, var(--muted)); width: 18px; height: 18px; flex-shrink: 0; }
    
    /* Название подразделения в Списке — цвет блока */
    .org-node-title { 
      font-weight: 600; color: var(--dir-color, var(--text)); 
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; 
    }
    
    /* Метаданные справа */
    .org-code-chip {
      font-size: 12px; font-family: monospace; font-weight: 600; color: var(--muted);
      background: var(--bg); padding: 3px 8px; border-radius: 6px; border: 1px solid var(--border);
      margin-left: auto; /* Прибивает всё правее к правому краю */
      max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    
    .emp-pill {
      font-size: 13px; font-weight: 500; color: var(--text); white-space: nowrap;
      display: flex; align-items: center; gap: 6px; min-width: 80px; justify-content: flex-end;
    }
    .emp-pill i { width: 14px; height: 14px; color: var(--muted); }

    /* Стили Таблицы (дерево) */
    .org-table-wrap { overflow: auto; }
    .org-table { width: 100%; border-collapse: collapse; }
    .org-table thead th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .3px; color: var(--muted); padding: 10px; border-bottom: 1px solid var(--border); background: var(--surface-1); }
    .org-table tbody td { padding: 10px; border-bottom: 1px solid var(--border); vertical-align: middle; }
    .tree-cell { display: flex; align-items: center; }
    .tree-indent { display: inline-block; width: calc(var(--depth) * 20px); flex-shrink: 0; }
    .tree-caret { width: 20px; display: inline-flex; justify-content: center; color: var(--muted); cursor: pointer; margin-right: 6px; }
    .tree-name { font-weight: 600; color: var(--text); }

    /* Модальное окно */
    .org-modal-overlay {
      position: fixed; inset: 0; z-index: 1100;
      background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.2s ease; pointer-events: none;
    }
    .org-modal-overlay.is-open { opacity: 1; pointer-events: auto; }

    .org-modal-window {
      background: var(--surface); border-radius: 12px;
      width: 90%; max-width: 700px; max-height: 85vh;
      display: flex; flex-direction: column;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      transform: scale(0.95); transition: transform 0.2s ease; border: 1px solid var(--border);
    }
    .org-modal-overlay.is-open .org-modal-window { transform: scale(1); }
    
    .org-modal-header {
      padding: 16px 24px; border-bottom: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
    }
    .org-modal-title { font-size: 18px; font-weight: 700; margin: 0; color: var(--text); }
    .org-modal-close {
      background: transparent; border: none; cursor: pointer; padding: 6px;
      color: var(--muted); border-radius: 6px; transition: all 0.2s;
    }
    .org-modal-close:hover { background: var(--bg); color: var(--text); }

    .org-modal-body { padding: 24px; overflow-y: auto; }
    
    .proc-group { margin-bottom: 24px; }
    .proc-group:last-child { margin-bottom: 0; }
    .proc-group-title {
      font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      margin: 0 0 12px; padding-bottom: 6px; border-bottom: 2px solid; display: inline-block;
    }
    .proc-list { display: grid; gap: 8px; }
    .proc-item {
      display: flex; align-items: center; gap: 12px; padding: 10px 14px;
      background: var(--bg); border-radius: 8px; border: 1px solid var(--border);
    }
    .proc-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .proc-code { font-family: monospace; font-weight: 700; font-size: 13px; color: var(--muted); min-width: 60px; }
    .proc-name { font-size: 14px; font-weight: 500; color: var(--text); }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
  __orgTableStylesInjected = true;
}

/* ================== Вспомогалки ================== */
const normalizeCode = (c) => String(c||'').trim().replace(/^PCF[-\s]*/i,'').replace(/[^\d.]/g,'').replace(/^\.+|\.+$/g,'').replace(/\.+/g,'.');
const getMajorAny = (c) => parseInt(String(c||'').split('.')[0],10)||0;
const cmpNormCodes = (a, b) => {
  const A = a.split('.').map(Number), B = b.split('.').map(Number);
  for (let i=0; i<Math.max(A.length,B.length); i++) {
    const d = (A[i]||0) - (B[i]||0);
    if (d !== 0) return d;
  }
  return 0;
};

/* ----------------------- Нормализация и дерево ----------------------- */
function normalizeRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  let auto = 0;
  const seen = new Set();
  return rows.map(r => {
    const rawId = r['Department ID'];
    const rawPid = r['Parent Department ID'];
    const name = String(r['Department Name'] ?? '').trim();
    const code = String(r['Department Code'] ?? '').trim();
    const hcRaw = r['number of employees'];
    if (!name) return null;
    let id = String(rawId ?? '').trim();
    if (!id || seen.has(id)) id = `${id || 'row'}-${auto++}`;
    seen.add(id);
    const parentId = String(rawPid ?? '').trim() || null;
    const headcount = hcRaw != null && hcRaw !== '' ? parseInt(String(hcRaw).replace(/[^\d]/g, ''), 10) : null;
    return { id, parentId, name, code, headcount, children: [] };
  }).filter(Boolean);
}

function buildTree(items) {
  if (!items || !items.length) return null;
  const byId = new Map(items.map(it => [it.id, { ...it, children: [] }]));
  const childIds = new Set();
  byId.forEach(n => {
    const pid = n.parentId && n.parentId !== n.id && byId.has(n.parentId) ? n.parentId : null;
    if (pid) {
      byId.get(pid).children.push(n);
      childIds.add(n.id);
    }
  });
  let roots = Array.from(byId.values()).filter(n => !childIds.has(n.id));
  if (roots.length === 0 && byId.size > 0) {
    const first = byId.values().next().value;
    if (first) {
      first.parentId = null;
      roots = [first];
    }
  }
  let root = roots.find(n => /генеральн/i.test(n.name)) || null;
  if (!root && roots.length > 0) {
    root = { id: 'CEO_VIRTUAL', name: 'Генеральная дирекция', code: 'CEO', children: roots };
  }
  return root || null;
}

const DIR_COLORS = ['#14b8a6', '#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#06b6d4', '#22c55e', '#ef4444'];
function colorizeByDirectorate(root) {
  if (!root) return;
  const rootColor = '#94a3b8';
  root.color = rootColor;
  (root.children || []).forEach((dir, i) => {
    const color = DIR_COLORS[i % DIR_COLORS.length];
    (function paint(n) { n.color = color; (n.children || []).forEach(paint); })(dir);
  });
  (function overrideColors(n) {
    const nameNorm = norm(n.name);
    if (nameNorm.includes('секретариат') || (nameNorm.includes('проектн') && nameNorm.includes('офис'))) {
      n.color = rootColor;
    }
    (n.children || []).forEach(overrideColors);
  })(root);
}

function setDepth(n, d = 0) { if(n) { n.depth = d; (n.children || []).forEach(c => setDepth(c, d + 1)); } }
const matches = (n, q) => !q || norm(n.name).includes(q) || norm(n.code || '').includes(q);

/* -------------------------- MODAL WINDOW --------------------------- */
function showProcessModal(department) {
  const existingModal = document.querySelector('.org-modal-overlay');
  if (existingModal) existingModal.remove();

  const groupProcesses = (processes) => {
    const groups = { management: [], core: [], enablement: [] };
    (processes || []).forEach(p => { if (groups[p.group]) groups[p.group].push(p); });
    return groups;
  };

  const renderGroup = (title, processes, color) => {
    if (!processes.length) return '';
    return `
      <div class="proc-group">
        <div class="proc-group-title" style="color: ${color}; border-color: ${color};">${title}</div>
        <div class="proc-list">
          ${processes.map(p => `
            <div class="proc-item">
              <span class="proc-dot" style="background-color: ${color};"></span>
              <span class="proc-code">${p.code}</span>
              <span class="proc-name">${p.name}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  };

  const grouped = groupProcesses(department.processes);
  
  const overlay = document.createElement('div');
  overlay.className = 'org-modal-overlay';
  overlay.innerHTML = `
    <div class="org-modal-window">
      <div class="org-modal-header">
        <div style="display:flex; flex-direction:column;">
          <h3 class="org-modal-title">${department.name}</h3>
          <span style="font-size:13px; color:var(--muted); margin-top:4px;">Код: ${department.code || '—'} • ${department.headcount || 0} чел.</span>
        </div>
        <button class="org-modal-close"><i data-lucide="x"></i></button>
      </div>
      <div class="org-modal-body">
        ${department.processes.length === 0 ? '<div style="color:var(--muted); text-align:center; padding:20px;">Нет привязанных процессов</div>' : ''}
        ${renderGroup('Управление', grouped.management, 'var(--warning)')}
        ${renderGroup('Основные процессы', grouped.core, 'var(--blue)')}
        ${renderGroup('Обеспечение', grouped.enablement, 'var(--success)')}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  refreshIcons();

  const handleEscape = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleEscape);
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 250);
  };

  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', handleEscape);
  requestAnimationFrame(() => overlay.classList.add('is-open'));
  
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.org-modal-close').addEventListener('click', close);
}

/* ----------------------------- LIST VIEW ----------------------------- */
function renderOrgList(container, root, allNodes) {
  container.innerHTML = `
    <section class="data-card org-page">
      <div class="card-header org-header">
        <div class="org-title-left">
          <i data-lucide="drama" class="main-icon org-header-icon"></i>
          <div class="org-title-texts">
            <h3 class="card-title org-header-title">Организационная структура</h3>
            <p class="card-subtitle org-header-subtitle">Иерархический список</p>
          </div>
        </div>
        <div class="org-actions-top">
          <div class="org-search-wrap">
            <i data-lucide="search"></i>
            <input id="orgGlobalSearch" class="org-search input" type="search" placeholder="Поиск..."/>
          </div>
          <div class="view-toggle segmented">
            <button class="seg-btn active" id="btnOrgList"><i data-lucide="list-tree"></i> Список</button>
            <button class="seg-btn" id="btnOrgTable"><i data-lucide="table-2"></i> Таблица</button>
          </div>
        </div>
      </div>
      <div id="orgListWrap" class="org-list-modern"></div>
    </section>
  `;
  refreshIcons();

  const wrap = container.querySelector('#orgListWrap');
  const searchEl = container.querySelector('#orgGlobalSearch');
  container.querySelector('#btnOrgTable')?.addEventListener('click', () => renderOrgTable(container, root, allNodes));

  const expanded = new Set([root.id]);
  let q = '';

  const drawNode = (n) => {
    const d = n.depth || 0;
    const kids = n.children || [];
    const open = expanded.has(n.id);
    if (q && !matches(n, q)) return;

    const el = document.createElement('div');
    el.className = 'org-node';
    el.style.setProperty('--depth', d);
    if (n.color) el.style.setProperty('--dir-color', n.color);
    
    const head = document.createElement('div');
    head.className = 'org-node-head';
    
    // 1. Карет (раскрытие)
    const caret = document.createElement('button');
    caret.className = 'org-caret';
    caret.innerHTML = `<i data-lucide="${kids.length ? (open ? 'chevron-down' : 'chevron-right') : 'dot'}"></i>`;
    if (!kids.length) caret.disabled = true;

    // 2. Иконка
    const ico = document.createElement('i');
    ico.setAttribute('data-lucide', iconSlugFor(n.name));
    ico.className = 'org-node-icon';

    // 3. Название (цвет блока задаётся через var(--dir-color))
    const title = document.createElement('div');
    title.className = 'org-node-title';
    title.textContent = n.name;

    // 4. Код подразделения (справа)
    const code = document.createElement('span');
    code.className = 'org-code-chip';
    code.textContent = n.code || '—';

    // 5. Численность
    const emp = document.createElement('div');
    emp.className = 'emp-pill';
    emp.title = 'Численность';
    emp.innerHTML = `<i data-lucide="users"></i> ${n.headcount ?? '—'}`;

    // 6. Кнопка процессов
    const processBtn = document.createElement('button');
    processBtn.className = 'process-btn';
    processBtn.dataset.deptId = n.id;
    processBtn.disabled = n.processes.length === 0;
    processBtn.innerHTML = `<i data-lucide="layers"></i> <span>Процессы</span> <span class="process-count">${n.processes.length}</span>`;

    head.append(caret, ico, title, code, emp, processBtn);
    el.appendChild(head);

    const toggle = () => { if (kids.length) { open ? expanded.delete(n.id) : expanded.add(n.id); doRender(); } };
    caret.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    head.addEventListener('click', (e) => {
      if (e.target.closest('.process-btn')) return;
      toggle();
    });

    wrap.appendChild(el);
    if (kids.length && open) kids.forEach(drawNode);
  };

  const doRender = () => { wrap.innerHTML = ''; drawNode(root); refreshIcons(); };
  searchEl?.addEventListener('input', debounce(() => { q = norm(searchEl.value); doRender(); }, 200));
  doRender();
}

/* ---------------------------- TABLE VIEW ----------------------------- */
function renderOrgTable(container, root, allNodes) {
  ensureOrgTableStyles();
  const byId = new Map(allNodes.map(n => [n.id, n]));
  const expanded = new Set([root.id]);
  
  container.innerHTML = `
    <section class="data-card org-page">
      <div class="card-header org-header">
        <div class="org-title-left">
          <i data-lucide="drama" class="main-icon org-header-icon"></i>
          <div class="org-title-texts">
            <h3 class="card-title org-header-title">Организационная структура</h3>
            <p class="card-subtitle org-header-subtitle">Табличное представление</p>
          </div>
        </div>
        <div class="org-actions-top">
          <div class="org-search-wrap">
            <i data-lucide="search"></i>
            <input id="orgGlobalSearch" class="org-search input" type="search" placeholder="Поиск..."/>
          </div>
          <div class="view-toggle segmented">
            <button class="seg-btn" id="btnOrgList"><i data-lucide="list-tree"></i> Список</button>
            <button class="seg-btn active" id="btnOrgTable"><i data-lucide="table-2"></i> Таблица</button>
          </div>
        </div>
      </div>
      <div class="org-table-toolbar">
        <button id="btnExpandAll" class="btn"><i data-lucide="chevrons-down-up"></i> Развернуть все</button>
        <button id="btnCollapseAll" class="btn"><i data-lucide="chevrons-up-down"></i> Свернуть</button>
      </div>
      <div class="org-table-wrap">
        <table class="org-table" id="orgTable">
          <thead><tr><th style="width:45%;">Подразделение</th><th style="width:15%;">Код</th><th style="width:15%;">Численность</th><th style="width:25%;">Процессы</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  `;
  refreshIcons();

  const tbody = container.querySelector('#orgTable tbody');
  const searchEl = container.querySelector('#orgGlobalSearch');
  container.querySelector('#btnOrgList')?.addEventListener('click', () => renderOrgList(container, root, allNodes));

  const visible = (n) => {
    if (n === root) return true;
    let cur = n;
    while (cur.parentId) {
      const p = byId.get(cur.parentId);
      if (!p || !expanded.has(p.id)) return false;
      cur = p;
    }
    return true;
  };

  const doRender = () => {
    const q = norm(searchEl?.value || '');
    const rows = allNodes.filter(n => visible(n) && matches(n, q));
    tbody.innerHTML = rows.map(r => `
      <tr data-id="${r.id}" data-has-children="${(r.children || []).length > 0}" class="org-table-row">
        <td>
          <div class="tree-cell" style="padding-left:calc(${r.depth} * 24px)">
            <span class="tree-caret">
              ${(r.children||[]).length ? `<i data-lucide="${expanded.has(r.id) ? 'chevron-down' : 'chevron-right'}"></i>` : '<span style="width:20px;display:inline-block;"></span>'}
            </span>
            <span class="tree-name">${r.name}</span>
          </div>
        </td>
        <td><span class="org-code-chip">${r.code || '—'}</span></td>
        <td><span class="emp-pill">${r.headcount ?? '—'}</span></td>
        <td>
          <button class="process-btn" data-dept-id="${r.id}" ${r.processes.length === 0 ? 'disabled' : ''}>
            <i data-lucide="layers"></i> <span>Процессы</span> <span class="process-count">${r.processes.length}</span>
          </button>
        </td>
      </tr>
    `).join('');
    refreshIcons();
  };

  tbody.addEventListener('click', e => {
    const btn = e.target.closest('.process-btn');
    if (btn) return; // обработчик в entry point подхватит
    const tr = e.target.closest('tr');
    if (!tr || tr.dataset.hasChildren !== 'true') return;
    const id = tr.dataset.id;
    if (!id) return;
    expanded.has(id) ? expanded.delete(id) : expanded.add(id);
    doRender();
  });

  container.querySelector('#btnExpandAll').addEventListener('click', () => { allNodes.forEach(n => expanded.add(n.id)); doRender(); });
  container.querySelector('#btnCollapseAll').addEventListener('click', () => { expanded.clear(); expanded.add(root.id); doRender(); });
  searchEl?.addEventListener('input', debounce(doRender, 200));
  doRender();
}

/* ------------------------------ ENTRY POINT ------------------------------ */
export async function renderOrgPage(container) {
  ensureOrgTableStyles();
  container.innerHTML = `<section class="data-card org-page"><div class="card-header org-header"><div class="org-title-left"><i data-lucide="drama" class="main-icon org-header-icon"></i><div class="org-title-texts"><h3 class="card-title org-header-title">Организационная структура</h3><p class="card-subtitle org-header-subtitle">Загрузка...</p></div></div></div></section>`;
  refreshIcons();

  try {
    const [rawOrg, costData, pcfDataRaw] = await Promise.all([
      fetchOrgRows(),
      fetchData('BOLT_Cost Driver_pcf+orgchat', '*'),
      fetchData('BOLT_pcf', '*')
    ]);
    
    if (!rawOrg || !rawOrg.length) throw new Error('Таблица оргструктуры (BOLT_orgchat) пуста.');
    
    const orgRows = normalizeRows(rawOrg);
    const root = buildTree(orgRows);
    if (!root) throw new Error('Не удалось построить иерархию оргструктуры.');
    
    setDepth(root, 0);
    colorizeByDirectorate(root);
    
    const pcfMap = new Map((pcfDataRaw || []).map(p => [p['Process ID'], p]));
    const allNodes = [];
    (function collect(n) { allNodes.push(n); (n.children || []).forEach(collect); })(root);

    allNodes.forEach(dept => {
      dept.processes = costData
        .filter(row => Number(String(row[dept.id] || '0').replace(',', '.')) !== 0)
        .map(row => {
          const pcfInfo = pcfMap.get(row['Process ID']) || {};
          const major = getMajorAny(pcfInfo['PCF Code']);
          const groupKey = [1,13].includes(major) ? 'management' : [2,3,4,5,6].includes(major) ? 'core' : 'enablement';
          const color = {core:'var(--blue)', enablement:'var(--success)', management:'var(--warning)'}[groupKey];
          return {
            name: pcfInfo['Process Name'] || row['Process ID'],
            code: pcfInfo['PCF Code'] || 'N/A',
            group: groupKey,
            color: color
          };
        })
        .sort((a,b) => cmpNormCodes(a.code, b.code));
    });

    renderOrgList(container, root, allNodes);

    // Глобальный обработчик кликов для кнопок процессов (работает в обоих режимах)
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.process-btn');
      if (btn && !btn.disabled) {
        e.preventDefault();
        e.stopPropagation();
        const dept = allNodes.find(d => d.id === btn.dataset.deptId);
        if (dept) showProcessModal(dept);
      }
    });

  } catch (e) {
    console.error(e);
    container.innerHTML = `<div class="data-card" style="border-color:var(--danger);"><div class="card-header"><h3 class="card-title">Ошибка</h3></div><div style="padding:16px;">${e.message || String(e)}</div></div>`;
  }
}