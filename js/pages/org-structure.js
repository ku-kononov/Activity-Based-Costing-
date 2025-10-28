// js/pages/org-structure.js
import { fetchOrgRows, fetchData } from '../api.js';
import { debounce, norm, refreshIcons, iconSlugFor } from '../utils.js';

/* ========== Встроенные стили для модального окна (однократно) ========== */
let __orgTableStylesInjected = false;
function ensureOrgTableStyles() {
  if (__orgTableStylesInjected) return;
  const css = `
    .process-popup-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 10px; border-radius: 8px; font-weight: 600;
      border: 1px solid var(--border); background: var(--surface);
      cursor: pointer; transition: all .2s;
    }
    .process-popup-btn:not([disabled]):hover {
      background: var(--bg); border-color: var(--blue); color: var(--blue);
    }
    .process-popup-btn[disabled] { opacity: 0.6; cursor: not-allowed; }
    .process-popup-btn i { width: 14px; height: 14px; }
    .process-popup-btn .count { font-size: 12px; font-weight: 700; }

    .org-modal-overlay {
      position: fixed; inset: 0; z-index: 1050;
      background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity .2s ease; pointer-events: none;
    }
    .org-modal-overlay.is-open { opacity: 1; pointer-events: auto; }

    .org-modal-window {
      background: var(--surface); border-radius: 16px;
      width: 90%; max-width: 800px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      display: flex; flex-direction: column;
      transform: scale(0.95); transition: transform .2s ease;
    }
    .org-modal-overlay.is-open .org-modal-window { transform: scale(1); }
    
    .org-modal-header {
      padding: 16px 20px; border-bottom: 1px solid var(--border);
      display: flex; justify-content: space-between; align-items: center;
    }
    .org-modal-title { font-size: 18px; font-weight: 700; margin: 0; }
    .org-modal-close { background: transparent; border: none; cursor: pointer; padding: 4px; }

    .org-modal-body { padding: 20px; max-height: 70vh; overflow-y: auto; }
    .process-group { margin-bottom: 20px; }
    .process-group-title {
      font-size: 14px; font-weight: 800; color: var(--muted);
      text-transform: uppercase; letter-spacing: 0.5px;
      margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--divider);
    }
    .process-list-item {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 0; font-size: 14px;
    }
    .process-list-item-marker {
      width: 8px; height: 8px; border-radius: 50%;
      flex-shrink: 0;
    }
    .process-list-item-name { font-weight: 600; }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
  __orgTableStylesInjected = true;
}


/* ================== Вспомогалки (восстановлены) ================== */
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


/* ----------------------------- LIST VIEW ----------------------------- */
function renderOrgList(container, root, costData, pcfData) {
    container.innerHTML = `
    <section class="data-card org-page">
      <div class="card-header org-header">
        <div class="org-title-left">
          <i data-lucide="drama" class="main-icon org-header-icon"></i>
          <div class="org-title-texts">
            <h3 class="card-title org-header-title">Организационная структура</h3>
            <p class="card-subtitle org-header-subtitle">Organizational Structure</p>
          </div>
        </div>
        <div class="org-actions-top">
          <div class="org-search-wrap">
            <i data-lucide="search"></i>
            <input id="orgGlobalSearch" class="org-search input" type="search" placeholder="Поиск по подразделениям"/>
          </div>
          <div class="view-toggle segmented">
            <button class="seg-btn active" id="btnOrgList"><i data-lucide="panel-left"></i> Список</button>
            <button class="seg-btn" id="btnOrgTable"><i data-lucide="table"></i> Таблица</button>
          </div>
        </div>
      </div>
      <div id="orgListWrap" class="org-list-modern"></div>
    </section>
  `;
  refreshIcons();

  const wrap = container.querySelector('#orgListWrap');
  const searchEl = container.querySelector('#orgGlobalSearch');
  const btnTable = container.querySelector('#btnOrgTable');
  btnTable?.addEventListener('click', () => renderOrgTable(container, root, costData, pcfData));

  setDepth(root);
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
    el.dataset.depth = String(d);

    const head = document.createElement('div');
    head.className = 'org-node-head';

    const caret = document.createElement('button');
    caret.className = 'org-caret';
    const caretIcon = kids.length ? (open ? 'chevron-up' : 'chevron-down') : 'dot';
    caret.innerHTML = `<i data-lucide="${caretIcon}"></i>`;
    if (!kids.length) caret.setAttribute('disabled', 'true');

    const ico = document.createElement('i');
    ico.setAttribute('data-lucide', iconSlugFor(n.name));
    ico.className = 'org-node-icon';

    const title = document.createElement('div');
    title.className = 'org-node-title';
    const displayName = d === 0 ? 'Генеральная дирекция' : n.name;
    title.textContent = displayName;

    const code = document.createElement('span');
    code.className = 'org-code-chip';
    code.textContent = n.code || '—';

    const emp = document.createElement('div');
    emp.className = 'emp-pill';
    emp.title = 'Численность';
    emp.textContent = `${n.headcount ?? '—'} чел.`;

    head.appendChild(caret);
    head.appendChild(ico);
    head.appendChild(title);
    head.appendChild(code);
    head.appendChild(emp);
    el.appendChild(head);

    const toggle = () => { if (kids.length) { open ? expanded.delete(n.id) : expanded.add(n.id); doRender(); } };
    caret.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    head.addEventListener('click', (e) => { if (e.target.closest('.org-code-chip')) return; toggle(); });

    wrap.appendChild(el);

    if (kids.length && open) kids.forEach(drawNode);
  };

  const doRender = () => { wrap.innerHTML = ''; drawNode(root); refreshIcons(); };
  searchEl?.addEventListener('input', debounce(() => { q = norm(searchEl.value); doRender(); }, 200));
  doRender();
}


/* ---------------------------- TABLE VIEW (с новой колонкой) ----------------------------- */
function renderOrgTable(container, root, costData, pcfData) {
  ensureOrgTableStyles();
  const all = [];
  setDepth(root);
  (function collect(n) { all.push(n); (n.children || []).forEach(collect); })(root);
  const byId = new Map(all.map(n => [n.id, n]));
  const expanded = new Set([root.id]);
  
  const pcfMap = new Map(pcfData.map(p => [p['Process ID'], p]));

  all.forEach(dept => {
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

  container.innerHTML = `
    <section class="data-card org-page">
      <div class="card-header org-header">
        <div class="org-title-left">
          <i data-lucide="drama" class="main-icon org-header-icon"></i>
          <div class="org-title-texts">
            <h3 class="card-title org-header-title">Организационная структура</h3>
            <p class="card-subtitle org-header-subtitle">Представление в виде таблицы</p>
          </div>
        </div>
        <div class="org-actions-top">
          <div class="org-search-wrap">
            <i data-lucide="search"></i>
            <input id="orgGlobalSearch" class="org-search input" type="search" placeholder="Поиск по подразделениям"/>
          </div>
          <div class="view-toggle segmented">
            <button class="seg-btn" id="btnOrgList"><i data-lucide="panel-left"></i> Список</button>
            <button class="seg-btn active" id="btnOrgTable"><i data-lucide="table"></i> Таблица</button>
          </div>
        </div>
      </div>
      <div class="org-table-toolbar">
        <button id="btnExpandAll" class="btn"><i data-lucide="chevrons-down-up"></i> Развернуть все</button>
        <button id="btnCollapseAll" class="btn"><i data-lucide="chevrons-up-down"></i> Свернуть до дирекций</button>
      </div>
      <div class="org-table-wrap">
        <table class="org-table" id="orgTable">
          <thead><tr><th style="width:15%;">Код</th><th style="width:40%;">Подразделение</th><th style="width:20%;">Численность</th><th style="width:25%;">Процессы</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  `;
  refreshIcons();

  const tbody = container.querySelector('#orgTable tbody');
  const searchEl = container.querySelector('#orgGlobalSearch');
  container.querySelector('#btnOrgList')?.addEventListener('click', () => renderOrgList(container, root, costData, pcfData));

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
    const rows = all.filter(n => visible(n) && matches(n, q));
    tbody.innerHTML = rows.map(r => `
      <tr data-id="${r.id}" data-has-children="${(r.children || []).length > 0}">
        <td><span class="org-code-badge">${r.code || '—'}</span></td>
        <td>
          <div class="tree-cell">
            <span class="tree-indent" style="--depth:${r.depth}"></span>
            <span>${r.depth === 0 ? 'Генеральная дирекция' : r.name}</span>
          </div>
        </td>
        <td>${r.headcount ?? '—'}</td>
        <td>
          <button class="process-popup-btn" data-dept-id="${r.id}" ${r.processes.length === 0 ? 'disabled' : ''}>
            <i data-lucide="list-checks"></i>
            <span class="count">${r.processes.length}</span>
          </button>
        </td>
      </tr>
    `).join('');
    refreshIcons();
  };

  tbody.addEventListener('click', e => {
    const btn = e.target.closest('.process-popup-btn');
    if (btn) {
      e.stopPropagation();
      const dept = all.find(d => d.id === btn.dataset.deptId);
      if (dept) showProcessModal(dept);
      return;
    }
    const tr = e.target.closest('tr');
    if (!tr || tr.dataset.hasChildren !== 'true') return;
    const id = tr.dataset.id;
    if (!id) return;
    expanded.has(id) ? expanded.delete(id) : expanded.add(id);
    doRender();
  });

  container.querySelector('#btnExpandAll').addEventListener('click', () => { all.forEach(n => expanded.add(n.id)); doRender(); });
  container.querySelector('#btnCollapseAll').addEventListener('click', () => { expanded.clear(); expanded.add(root.id); doRender(); });
  searchEl?.addEventListener('input', debounce(doRender, 200));
  doRender();
}

/* -------------------------- MODAL WINDOW --------------------------- */
function showProcessModal(department) {
    const existingModal = document.querySelector('.org-modal-overlay');
    if (existingModal) existingModal.remove();

    const groupProcesses = (processes) => {
        const groups = { management: [], core: [], enablement: [] };
        processes.forEach(p => {
            if (groups[p.group]) groups[p.group].push(p);
        });
        return groups;
    };

    const renderGroup = (title, processes) => {
        if (!processes.length) return '';
        const color = processes[0].color;
        return `
            <div class="process-group">
                <h4 class="process-group-title" style="color: ${color};">${title}</h4>
                ${processes.map(p => `
                    <div class="process-list-item">
                        <span class="process-list-item-marker" style="background-color: ${p.color};"></span>
                        <span class="process-list-item-name">${p.code} ${p.name}</span>
                    </div>
                `).join('')}
            </div>
        `;
    };

    const grouped = groupProcesses(department.processes);
    
    const overlay = document.createElement('div');
    overlay.className = 'org-modal-overlay';
    overlay.innerHTML = `
        <div class="org-modal-window">
            <div class="org-modal-header">
                <h3 class="org-modal-title">Процессы подразделения: ${department.name}</h3>
                <button class="org-modal-close"><i data-lucide="x"></i></button>
            </div>
            <div class="org-modal-body">
                ${renderGroup('Управление', grouped.management)}
                ${renderGroup('Основные', grouped.core)}
                ${renderGroup('Обеспечение', grouped.enablement)}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    refreshIcons();

    const close = () => {
        overlay.classList.remove('is-open');
        setTimeout(() => overlay.remove(), 250);
    };

    setTimeout(() => overlay.classList.add('is-open'), 10);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('.org-modal-close').addEventListener('click', close);
}


/* ------------------------------ ENTRY POINT ------------------------------ */
export async function renderOrgPage(container) {
  container.innerHTML = `<section class="data-card org-page"><div class="card-header org-header"><div class="org-title-left"><i data-lucide="drama" class="main-icon org-header-icon"></i><div class="org-title-texts"><h3 class="card-title org-header-title">Организационная структура</h3><p class="card-subtitle org-header-subtitle">Загрузка...</p></div></div></div></section>`;
  refreshIcons();

  try {
    const [rawOrg, costData, pcfDataRaw] = await Promise.all([
        fetchOrgRows(),
        fetchData('BOLT_Cost Driver_pcf+orgchat', '*'),
        fetchData('BOLT_pcf', '*, "Process ID", "Process Name", "PCF Code"')
    ]);
    
    if (!rawOrg || rawOrg.length === 0) throw new Error('Таблица оргструктуры (BOLT_orgchat) пуста.');
    
    const rows = normalizeRows(rawOrg);
    const root = buildTree(rows);
    if (!root) throw new Error('Не удалось построить иерархию оргструктуры.');
    
    colorizeByDirectorate(root);
    
    const pcfData = pcfDataRaw.map(r => ({
        'Process ID': r['Process ID'],
        'Process Name': r['Process Name'],
        'PCF Code': r['PCF Code'],
    }));

    renderOrgTable(container, root, costData, pcfData);
  } catch (e) {
    container.innerHTML = `<div class="data-card" style="border-color:var(--danger);"><div class="card-header"><h3 class="card-title">Ошибка</h3></div><div style="padding:8px;">${e.message || String(e)}</div></div>`;
  }
}