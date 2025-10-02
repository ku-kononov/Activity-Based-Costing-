// js/pages/org-structure.js
import { fetchOrgRows } from '../api.js';
import { debounce, norm, refreshIcons, iconSlugFor } from '../utils.js';

/* ----------------------- Нормализация и дерево ----------------------- */
// Жёстко под ваши колонки:
// - Department ID
// - Parent Department ID
// - Department Name
// - Department Code
// - number of employees
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
    if (!id) id = `row-${auto++}`;
    if (seen.has(id)) id = `${id}-${auto++}`;
    seen.add(id);

    const parentId = String(rawPid ?? '').trim() || null;
    const headcount = hcRaw != null && hcRaw !== '' ? parseInt(String(hcRaw).replace(/[^\d]/g, ''), 10) : null;

    return { id, parentId, name, code, headcount, children: [] };
  }).filter(Boolean);
}

function buildTree(items) {
  if (!items || !items.length) return null;

  // Картотека узлов
  const byId = new Map(items.map(it => [it.id, { ...it, children: [] }]));

  // Связываем дети -> родитель (только если родитель существует и не self)
  const childIds = new Set();
  byId.forEach(n => {
    const pid = n.parentId && n.parentId !== n.id && byId.has(n.parentId) ? n.parentId : null;
    if (pid) {
      byId.get(pid).children.push(n);
      childIds.add(n.id);
    }
  });

  // Корни = те, кто ни разу не помечен как ребёнок
  let roots = Array.from(byId.values()).filter(n => !childIds.has(n.id));

  // Если корней нет (циклические ссылки) — разрываем цикл у первого попавшегося
  if (roots.length === 0) {
    const first = byId.values().next().value;
    if (first) {
      // Удаляем у него ссылку на родителя и считаем корнем
      first.parentId = null;
      roots = [first];
    }
  }

  // Предпочтём корень с "Генеральн"
  let root = roots.find(n => /генеральн/i.test(n.name)) || null;

  if (!root && roots.length === 1) {
    root = roots[0];
    if (!/генеральн/i.test(root.name)) {
      root = { id: 'CEO_VIRTUAL', name: 'Генеральная дирекция', code: 'CEO', headcount: null, parentId: null, children: [roots[0]] };
    }
  } else if (!root && roots.length > 1) {
    root = { id: 'CEO_VIRTUAL', name: 'Генеральная дирекция', code: 'CEO', headcount: null, parentId: null, children: roots };
  }

  return root || null;
}

const DIR_COLORS = ['#14b8a6', '#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#06b6d4', '#22c55e', '#ef4444'];
function colorizeByDirectorate(root) {
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

/* ---------------------------- Вспомогалки ---------------------------- */
function setDepth(n, d = 0) { n.depth = d; (n.children || []).forEach(c => setDepth(c, d + 1)); }
const matches = (n, q) => !q || norm(n.name).includes(q) || norm(n.code || '').includes(q);

/* ----------------------------- LIST VIEW ----------------------------- */
function renderOrgList(container, root) {
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
  btnTable?.addEventListener('click', () => renderOrgTable(container, root));

  setDepth(root);
  const expanded = new Set([root.id]);
  let q = '';

  const drawNode = (n) => {
    const d = n.depth || 0;
    const kids = n.children || [];
    const open = expanded.has(n.id);
    const show = matches(n, q);
    if (!show) return;

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

    if (kids.length && expanded.has(n.id)) kids.forEach(drawNode);
  };

  const doRender = () => { wrap.innerHTML = ''; drawNode(root); refreshIcons(); };
  searchEl?.addEventListener('input', debounce(() => { q = norm(searchEl.value); doRender(); }, 200));
  doRender();
}

/* ---------------------------- TABLE VIEW ----------------------------- */
function renderOrgTable(container, root) {
  const all = [];
  setDepth(root);
  (function collect(n) { all.push(n); (n.children || []).forEach(collect); })(root);
  const byId = new Map(all.map(n => [n.id, n]));
  const expanded = new Set([root.id]);

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
            <button class="seg-btn" id="btnOrgList"><i data-lucide="panel-left"></i> Список</button>
            <button class="seg-btn active" id="btnOrgTable"><i data-lucide="table"></i> Таблица</button>
          </div>
        </div>
      </div>
      <div class="org-table-toolbar">
        <button id="btnExpandAll" class="btn"><i data-lucide="chevrons-down-up"></i> Развернуть все</button>
        <button id="btnCollapseAll" class="btn"><i data-lucide="chevrons-up-down"></i> Свернуть до дирекций</button>
        <span class="toolbar-spacer"></span>
        <button id="btnExportExcel" class="btn"><i data-lucide="file-spreadsheet"></i> Экспорт в Excel</button>
        <button id="btnExportPDF" class="btn"><i data-lucide="file-text"></i> Экспорт в PDF</button>
      </div>
      <div class="org-table-wrap">
        <table class="org-table" id="orgTable">
          <thead><tr><th style="width:56%;">Подразделение</th><th style="width:22%;">Код</th><th style="width:22%;">Численность</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  `;
  refreshIcons();

  const tbody = container.querySelector('#orgTable tbody');
  const searchEl = container.querySelector('#orgGlobalSearch');
  const btnList = container.querySelector('#btnOrgList');
  btnList?.addEventListener('click', () => renderOrgList(container, root));

  const visible = (n) => {
    if (n === root) return true;
    let cur = n;
    while (cur.parentId) { const p = byId.get(cur.parentId); if (!p) break; if (!expanded.has(p.id)) return false; cur = p; }
    return true;
  };

  const collectVisible = (q) => all
    .filter(n => visible(n) && matches(n, q))
    .map(n => ({
      id: n.id,
      name: n.depth === 0 ? 'Генеральная дирекция' : n.name,
      code: n.code || '—',
      headcount: n.headcount ?? '—',
      depth: n.depth,
      hasChildren: (n.children || []).length > 0,
      color: n.color
    }));

  const doRender = () => {
    const q = norm(searchEl?.value || '');
    const rows = collectVisible(q);
    tbody.innerHTML = rows.map(r => `
      <tr data-id="${r.id}" data-has-children="${r.hasChildren}">
        <td>
          <div class="tree-cell">
            <span class="tree-indent" style="--depth:${r.depth}"></span>
            <span>${r.name}</span>
          </div>
        </td>
        <td><span class="org-code-badge">${r.code}</span></td>
        <td>${r.headcount}</td>
      </tr>
    `).join('');
    refreshIcons();
  };

  tbody.addEventListener('click', e => {
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
  container.querySelector('#btnExportExcel').addEventListener('click', () => { /* ... экспорт ... */ });
  container.querySelector('#btnExportPDF').addEventListener('click', () => { /* ... экспорт ... */ });
  doRender();
}

/* ------------------------------ ENTRY ------------------------------ */
export async function renderOrgPage(container) {
  container.innerHTML = `
    <section class="data-card org-page">
      <div class="card-header org-header">
        <div class="org-title-left">
          <i data-lucide="drama" class="main-icon org-header-icon"></i>
          <div class="org-title-texts">
            <h3 class="card-title org-header-title">Организационная структура</h3>
            <p class="card-subtitle org-header-subtitle">Загрузка оргструктуры…</p>
          </div>
        </div>
      </div>
    </section>
  `;
  refreshIcons();

  try {
    const raw = await fetchOrgRows();
    if (!raw || raw.length === 0) {
      throw new Error('Таблица public."BOLT_orgchat" вернула 0 строк. Проверьте RLS-политику SELECT и наличие данных.');
    }
    const rows = normalizeRows(raw);
    const root = buildTree(rows);
    if (!root) throw new Error('Данные оргструктуры пусты или не удалось построить иерархию. Проверьте Parent Department ID.');
    colorizeByDirectorate(root);
    renderOrgList(container, root);
  } catch (e) {
    container.innerHTML = `
      <div class="data-card" style="border-color:#DC3545;">
        <div class="card-header"><h3 class="card-title">Ошибка</h3></div>
        <div style="padding:8px; white-space:pre-wrap;">${e.message || String(e)}</div>
      </div>`;
  }
}