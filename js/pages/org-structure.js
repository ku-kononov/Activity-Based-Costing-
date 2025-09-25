// js/pages/org-structure.js
import { fetchOrgRows } from '../api.js';
import { debounce, norm, refreshIcons, iconSlugFor } from '../utils.js';

function normalizeRows(rows) {
  return rows.map(r => {
    const pick = (...keys)=>keys.reduce((v,k)=>v ?? r[k], undefined);
    const id = pick('Department ID','DepartmentID','department_id','id');
    const p  = pick('Parent Department ID','ParentDepartmentID','parent_department_id','parent_id','parentId');
    return { id: id!=null?String(id):undefined,
      parentId: p!=null?String(p):null,
      name: pick('Department Name','department_name','name') || '',
      code: pick('Department Code','department_code','code') || '',
      headcount: pick('number of employees','number_of_employees','employees','headcount','employee_count') ?? null,
      children: [] };
  }).filter(x => x.id && x.name);
}

function buildTree(items) {
  const map = new Map(items.map(it => [it.id, { ...it, children: [] }]));
  const roots = [];
  map.forEach(n => (n.parentId && n.parentId!==n.id && map.has(n.parentId))
    ? map.get(n.parentId).children.push(n) : roots.push(n));
  let root = roots.find(n => /генеральн/i.test(n.name)) || null;
  if (!root && roots.length === 1) {
    root = roots[0];
    if (!/генеральн/i.test(root.name)) root = { id:'CEO_VIRTUAL', name:'Генеральный директор', code:'CEO', headcount:null, parentId:null, children:[roots[0]] };
  } else if (!root && roots.length > 1) {
    root = { id:'CEO_VIRTUAL', name:'Генеральный директор', code:'CEO', headcount:null, parentId:null, children: roots };
  }
  return root;
}

// Цвета для верхних дирекций (циклически)
const DIR_COLORS = ['#14b8a6','#60a5fa','#34d399','#f59e0b','#f472b6','#a78bfa','#06b6d4','#22c55e','#ef4444'];

function colorizeByDirectorate(root) {
  root.color = '#94a3b8';
  (root.children||[]).forEach((dir, i) => {
    const color = DIR_COLORS[i % DIR_COLORS.length];
    const paint = (n)=>{ n.color = color; (n.children||[]).forEach(paint); };
    paint(dir);
  });
}

function renderOrgList(container, root) {
  container.innerHTML = `
    <section class="data-card org-page">
      <div class="card-header">
        <div><div class="org-title"><i data-lucide="drama"></i><h3 class="card-title">Организационная структура</h3></div><p class="card-subtitle">Organizational Structure</p></div>
        <div class="org-actions">
          <input id="orgGlobalSearch" class="org-search" type="search" placeholder="Поиск по подразделениям"/>
          <div class="view-toggle segmented">
            <button class="seg-btn active" id="btnOrgList">Список</button>
            <button class="seg-btn" id="btnOrgTable">Таблица</button>
          </div>
        </div>
      </div>
      <div id="orgListWrap" class="org-list"></div>
    </section>`;

  const wrap = container.querySelector('#orgListWrap');
  const searchEl = container.querySelector('#orgGlobalSearch');
  const btnTable = container.querySelector('#btnOrgTable');
  btnTable?.addEventListener('click', ()=> renderOrgTable(container, root));
  refreshIcons();

  const setDepth = (n, d=0)=>{ n.depth=d; (n.children||[]).forEach(c=>setDepth(c,d+1)); };
  setDepth(root);
  const expanded = new Set([root.id]);
  let query = '';
  const doRender = () => {
    wrap.innerHTML='';
    const walk = (n) => {
      const d = n.depth||0, kids=(n.children||[]), open=expanded.has(n.id);
      const show = !query || norm(n.name).includes(query) || norm(n.code||'').includes(query);
      if (show) {
        const card = document.createElement('div'); card.className=`org-item depth-${d}`;
        if (n.color) card.style.borderColor = n.color;
        const row  = document.createElement('div'); row.className='row';
        const h    = document.createElement('h4'); h.className='name'; if (n.color) h.style.color = n.color;
        const ico  = document.createElement('i'); ico.setAttribute('data-lucide', iconSlugFor(n.name));
        h.appendChild(ico);
        const displayName = d===0 ? 'Генеральная дирекция' : n.name;
        h.appendChild(document.createTextNode(displayName));
        const emp  = document.createElement('div'); emp.className='emp-pill'; emp.title='Количество сотрудников'; emp.textContent=`${n.headcount ?? '—'} чел.`;
        row.appendChild(h); card.appendChild(row); card.appendChild(emp);
        if (kids.length) card.addEventListener('click',()=>{ open?expanded.delete(n.id):expanded.add(n.id); doRender(); });
        wrap.appendChild(card);
      }
      if (kids.length && open) kids.forEach(walk);
    };
    walk(root);
    refreshIcons();
  };
  searchEl?.addEventListener('input', debounce(()=>{ query = norm(searchEl.value); doRender(); },200));
  doRender();
}

function renderOrgTable(container, root) {
  const all = [];
  const setDepth = (n, d=0)=>{ n.depth=d; all.push(n); (n.children||[]).forEach(c=>setDepth(c,d+1)); };
  setDepth(root);
  const byId = new Map(all.map(n=>[n.id,n]));
  const expanded = new Set([root.id]);

  container.innerHTML = `
    <section class="data-card org-page">
      <div class="card-header">
        <div><div class="org-title"><i data-lucide="drama"></i><h3 class="card-title">Организационная структура</h3></div><p class="card-subtitle">Organizational Structure</p></div>
        <div class="org-actions">
          <input id="orgGlobalSearch" class="org-search" type="search" placeholder="Поиск по подразделениям"/>
          <div class="view-toggle segmented">
            <button class="seg-btn" id="btnOrgList">Список</button>
            <button class="seg-btn active" id="btnOrgTable">Таблица</button>
          </div>
        </div>
      </div>
      <div class="org-table-wrap">
        <table class="org-table" id="orgTable"><thead><tr><th style="width:60%;">Подразделение</th><th style="width:20%;">Код</th><th style="width:20%;">Численность</th></tr></thead><tbody></tbody></table>
      </div>
      <div class="org-table-toolbar"><button id="btnExpandAll" class="btn">Развернуть все</button><button id="btnCollapseAll" class="btn">Свернуть до дирекций</button></div>
    </section>`;

  const tbody = container.querySelector('#orgTable tbody');
  const searchEl = container.querySelector('#orgGlobalSearch');
  const btnList = container.querySelector('#btnOrgList');
  btnList?.addEventListener('click', ()=> renderOrgList(container, root));
  refreshIcons();

  const visible = (n) => {
    if (n===root) return true;
    let cur=n;
    while (cur.parentId) { const p=byId.get(cur.parentId); if (!p) break; if (!expanded.has(p.id)) return false; cur=p; }
    return true;
  };

  const collect = (q) => all.filter(n => visible(n) && (!q || norm(n.name).includes(q) || norm(n.code).includes(q)))
    .map(n => ({ id:n.id, name:n.name, code:n.code||'', headcount:n.headcount??'', depth:n.depth, hasChildren:(n.children||[]).length>0 }));

  const doRender = () => {
    const q = norm(searchEl?.value||'');
    const rows = collect(q);
    tbody.innerHTML = rows.map(r => `
      <tr data-id="${r.id}">
        <td><div class="tree-cell"><span class="tree-indent" style="--depth:${r.depth}"></span><button class="tree-caret" ${r.hasChildren?'':'disabled'}><i data-lucide="${r.hasChildren ? (expanded.has(r.id)?'arrow-down':'arrow-right') : 'circle'}"></i></button><span>${r.name}</span></div></td>
        <td>${r.code || '—'}</td>
        <td>${r.headcount || '—'}</td>
      </tr>`).join('');
    refreshIcons();
  };

  tbody.addEventListener('click', e => {
    const btn = e.target.closest('.tree-caret'); if (!btn) return;
    const tr = btn.closest('tr'); const id = tr?.dataset.id; if (!id) return;
    expanded.has(id) ? expanded.delete(id) : expanded.add(id);
    doRender();
  });

  container.querySelector('#btnExpandAll').addEventListener('click', ()=>{ all.forEach(n=>expanded.add(n.id)); doRender(); });
  container.querySelector('#btnCollapseAll').addEventListener('click', ()=>{ expanded.clear(); expanded.add(root.id); doRender(); });
  searchEl?.addEventListener('input', debounce(doRender, 200));
  doRender();
}

export async function renderOrgPage(container) {
  container.innerHTML = '<div class="data-card"><div class="card-header"><h3 class="card-title">Загрузка оргструктуры…</h3></div></div>';
  let root;
  try {
    const rows = normalizeRows(await fetchOrgRows());
    root = buildTree(rows);
    if (!root) throw new Error('Данные оргструктуры пусты.');
    // раскраска по дирекциям
    try { (function colorize(){
      const DIR_COLORS = ['#14b8a6','#60a5fa','#34d399','#f59e0b','#f472b6','#a78bfa','#06b6d4','#22c55e','#ef4444'];
      root.color = '#94a3b8';
      (root.children||[]).forEach((dir,i)=>{ const c=DIR_COLORS[i%DIR_COLORS.length]; (function paint(n){ n.color=c; (n.children||[]).forEach(paint); })(dir); });
    })(); } catch {}
  } catch (e) {
    container.innerHTML = `<div class="data-card" style="border-color:#DC3545;"><div class="card-header"><h3 class="card-title">Ошибка</h3></div><div style="padding:8px;">${e.message||e}</div></div>`;
    return;
  }
  renderOrgTable(container, root);
}