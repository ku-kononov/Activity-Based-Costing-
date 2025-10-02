(function () {
  'use strict';

  // ------- Supabase -------
  const SB_URL = window.ENV?.SUPABASE_URL || '';
  const SB_ANON = window.ENV?.SUPABASE_ANON_KEY || '';
  const supa = (window.supabase && SB_URL && SB_ANON)
    ? window.supabase.createClient(SB_URL, SB_ANON)
    : null;

  // ------- DOM refs -------
  const appEl = document.getElementById('app-container');
  const HOME_HTML = appEl ? appEl.innerHTML : '';

  // ------- Design tokens / data -------
  const DIR_COLORS = ['#14b8a6','#60a5fa','#34d399','#f59e0b','#f472b6','#a78bfa','#06b6d4','#22c55e','#ef4444'];

  // ------- Utils -------
  const qs = (s, r = document) => r.querySelector(s);
  const norm = s => (s ?? '').toString().trim().toLowerCase();
  const normalizeKey = s => norm(s).replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ');
  const once = fn => { let done=false; return (...a)=>!done&&(done=true, fn(...a)); };
  const debounce = (fn, ms=200) => {
    let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); };
  };
  const initIcons = once(() => {
    try { window.lucide?.createIcons?.() ?? window.lucide?.install?.(); } catch {}
  });
  const refreshIcons = () => {
    try { window.lucide?.createIcons?.() ?? window.lucide?.install?.(); } catch {}
  };

  // ------- ICONS (для Списка) -------
  const ICON_MAP = new Map(Object.entries({
    'Генеральная дирекция':'ship','Секретариат':'inbox','Проектный офис':'tent',
    'Дирекция по продажам и послепродажному обслуживанию':'hand-metal',
    'Управление продуктового маркетинга иностранных брендов':'globe-2',
    'Отдел продуктового маркетинга':'megaphone',
    'Отдел развития перспективных продуктовых направлений':'rocket',
    'Управление продуктового маркетинга и ценообразования':'tags',
    'Отдел аналитики и ценообразования':'line-chart',
    'Отдел развития продаж основных продуктовых групп':'trending-up',
    'Отдел специальных проектов':'beaker',
    'Отдел аналитики Дилеров Lada':'bar-chart-3',
    'Управление оперативной поддержки продаж на внутреннем рынке':'shovel',
    'Отдел планирования и распределения ресурса оптовой сети':'calendar',
    'Отдел планирования и контроля платежей и отгрузок оптовой сети':'clipboard-check',
    'Отдел планирования и распределения ресурса Дилерской сети':'calendar-clock',
    'Отдел планирования и контроля платежей и отгрузок Дилерской сети':'list-check',
    'Управление продаж запасных частей иностранных брендов':'package',
    'Отдел развития оптовых продаж':'shopping-bag',
    'Отдел развития прямых продаж':'shopping-cart',
    'Управление продаж':'coins',
    'Отдел продаж в Северо - Западном и Южном округах РФ':'compass',
    'Отдел продаж в Северо-Западном и Южном округах РФ':'compass',
    'Отдел продаж в центральном округе рф':'target',
    'Отдел продаж в приволжском округе рф':'map',
    'Отдел продаж в уральском и сибирском округах рф':'snowflake',
    'Управление экспортных продаж':'land-plot',
    'Отдел развития партнеров':'handshake',
    'Отдел планирования и распределения ресурса':'sliders-horizontal',
    'Отдел планирования и контроля платежей и отгрузок':'clipboard-list',
    'Отдел по работе с корпоративными клиентами':'briefcase',
    'Дирекция по маркетинговым коммуникациям':'goal',
    'Отдел стандартизации и клиентского сервиса':'ruler',
    'Отдел продаж СI и САП':'palette',
    'Отдел рекламы и коммуникаций':'message-square',
    'Бюро обеспечения рекламно-сувенирной продукцией':'gift',
    'Отдел интернет-проектов':'globe',
    'Дирекция по развитию бизнеса':'plane',
    'Отдел клиентского сервиса':'headphones',
    'Управление развития федеральной сети сервисов':'swatch-book',
    'Отдел развития и продаж франшизы':'award',
    'Отдел аудита и продвижения':'search-check',
    'Отдел поддержки бизнеса':'helping-hand',
    'Управление развития бизнес-проектов':'folder-plus',
    'Отдел организации продаж РЕНО':'car',
    'Отдел организации продаж НИССАН':'car-front',
    'Дирекция по инжинирингу':'drafting-compass',
    'Управление сопровождения новых моделей автомобилей':'pencil-ruler',
    'Отдел разработки технологии ремонта':'hammer',
    'Отдел разработки и валидации запасных частей и аксессуаров':'puzzle',
    'Бюро обеспечения качества поставок':'badge-check',
    'Бюро разработки бортовой документации':'book-open',
    'Управление инженерных данных':'database',
    'Отдел разработки конструкторской документации':'bolt',
    'Отдел разработки каталогов':'library',
    'Отдел нормативно-справочной информации':'scroll',
    'Бюро технической поддержки по подбору запасных частей':'stethoscope',
    'Дирекция по безопасности':'shield',
    'Отдел экономической безопасности':'lock',
    'Отдел анализа и защиты информации':'file-lock-2',
    'Отдел охраны объектов':'brick-wall-shield',
    'Бюро пропусков':'id-card',
    'Дирекция по закупкам':'shopping-bag',
    'Отдел непрямых закупок':'link-2',
    'Отдел закупок иностранных брендов':'languages',
    'Отдел специальных закупок':'wand-2',
    'Аналитическо-административный отдел':'calculator',
    'Управление закупок запасных частей и аксессуаров':'package-search',
    'Отдел закупок запасных частей':'package-plus',
    'Отдел закупок аксессуаров':'gem',
    'Отдел закупок запасных частей и сопровождения новых проектов':'package-check',
    'Дирекция по операционной деятельности':'cog',
    'Центр запасных частей № 1':'dice-1',
    'Центр запасных частей № 2':'dice-2',
    'Отдел импорта и развития проектов в логистике':'combine',
    'Служба руководителя по логистике и инжинирингу производства':'waypoints',
    'Отдел логистики':'truck',
    'Конструкторско - технологический отдел':'pen-tool',
    'Конструкторско-технологический отдел':'pen-tool',
    'Склад в г. Ижевск':'home',
    'Отдел технического контроля':'check-circle-2',
    'Склад зарекламированных изделий':'recycle',
    'Служба главного инженера':'factory',
    'Административно-хозяйственный отдел':'key-round',
    'Бюро охраны труда':'handshake',
    'Управление формирования и распределения ресурса':'gauge',
    'Отдел организации и контроля отгрузки дилерам':'send',
    'Отдел организации и контроля отгрузки оптовым покупателям':'boxes',
    'Отдел планирования':'calendar',
    'Отдел поставок':'package',
    'Отдел обеспечения производственной деятельности':'building',
    'Управление транспортной логистики':'route',
    'Отдел организации грузоперевозок':'navigation-2',
    'Отдел сопровождения и контроля грузоперевозок':'radar',
    'Отдел отгрузки':'baggage-claim',
    'Управление обеспечения операционной деятельности':'settings-2',
    'Отдел оперативного обеспечения ТМЦ':'zap',
    'Отдел планирования поставок ТМЦ':'calendar-plus',
    'Дирекция по консолидированному анализу бизнес-процессов':'layers',
    'Отдел анализа эффективности бизнес-процессов':'activity',
    'Отдел консолидированной отчетности':'pie-chart',
    'Юридическое управление':'scale',
    'Отдел правового обеспечения':'file-pen',
    'Отдел юридического сопровождения сделок и корпоративной работе':'scroll'
  }).map(([k,v]) => [normalizeKey(k), v]));
  const iconSlugFor = name => ICON_MAP.get(normalizeKey(name)) || 'building-2';

  // ------- Навигация -------
  const setActiveNav = (route) => {
    document.querySelectorAll('.nav-item').forEach(a => {
      a.classList.toggle('active', (route==='home' && /Главная/i.test(a.textContent)) || (route==='org' && /Оргструктура/i.test(a.textContent)));
      a.setAttribute('aria-current', a.classList.contains('active') ? 'page' : 'false');
    });
  };
  const navigate = (route) => {
    if (route === 'org') { renderOrgPage(); setActiveNav('org'); location.hash = '#/org'; }
    else { renderHome(); setActiveNav('home'); location.hash = '#/'; }
  };
  qs('.nav')?.addEventListener('click', e => {
    const link = e.target.closest('.nav-item'); if (!link) return;
    e.preventDefault();
    const txt = link.textContent || '';
    if (/Оргструктура/i.test(txt)) navigate('org');
    if (/Главная/i.test(txt)) navigate('home');
  });

  // ------- Главная -------
  function renderHome() {
    if (!appEl) return;
    appEl.innerHTML = HOME_HTML;
    initIcons();
    initChartsIfExists();
  }
  function initChartsIfExists() {
    if (!window.Chart) return;
    const donut = qs('#donutChart'); const bar = qs('#barChart'); const line = qs('#lineChart');
    donut && new Chart(donut, { type:'doughnut',
      data:{ labels:['В эксплуатации','Внедрение','Вывод из эксплуатации'],
        datasets:[{ data:[58,27,15], backgroundColor:['#4A89F3','#00B39E','#FF6B6B'], borderWidth:0 }]},
      options:{ plugins:{ legend:{ position:'bottom' }, tooltip:{ enabled:true }}, cutout:'60%', maintainAspectRatio:false }});
    bar && new Chart(bar, { type:'bar',
      data:{ labels:['Продажи','IT','Логистика','Финансы'],
        datasets:[{ label:'Затраты (₽)', data:[1800,2400,2100,1600], backgroundColor:'#007BFF' }]},
      options:{ plugins:{ legend:{ display:false }, tooltip:{ enabled:true }},
        scales:{ x:{ grid:{ display:false }}, y:{ grid:{ color:'#E9ECEF' }}}, maintainAspectRatio:false }});
    line && new Chart(line, { type:'line',
      data:{ labels:['Янв','Фев','Мар','Апр','Май','Июн'],
        datasets:[{ label:'PnL (₽)', data:[200,350,300,420,380,460], borderColor:'#28A745', backgroundColor:'rgba(40,167,69,.1)', tension:.3, fill:true }]},
      options:{ plugins:{ legend:{ display:false }, tooltip:{ enabled:true }},
        scales:{ x:{ grid:{ display:false }}, y:{ grid:{ color:'#E9ECEF' }}}, maintainAspectRatio:false }});
  }

  // ------- Данные / дерево -------
  let cacheRows = null;
  async function fetchOrgRows() {
    if (!supa) throw new Error('Supabase не сконфигурирован. Проверьте window.ENV.* и подключение SDK.');
    if (cacheRows) return cacheRows;
    let res = await supa.schema('BOLT').from('orgchat').select('*').limit(10000);
    if (res.error) { res = await supa.from('BOLT.orgchat').select('*').limit(10000); if (res.error) res = await supa.from('orgchat').select('*').limit(10000); }
    if (res.error) throw res.error;
    cacheRows = res.data || [];
    return cacheRows;
  }
  const normalizeRows = rows => rows.map(r => {
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

  function colorizeByDirectorate(root) {
    root.color = '#94a3b8';
    (root.children||[]).forEach((dir, i) => {
      const c = DIR_COLORS[i % DIR_COLORS.length];
      (function dfs(n){ n.color = c; (n.children||[]).forEach(dfs); })(dir);
    });
    const genDir = (root.children||[]).find(d => /генеральн/.test(norm(d.name)) && /дирек/.test(norm(d.name)));
    if (genDir) (genDir.children||[]).forEach(ch => { const nm = norm(ch.name); if (/секретариат/.test(nm) || (/проектн/.test(nm)&&/офис/.test(nm))) ch.color = genDir.color; });
  }

  // ------- Список -------
  function renderOrgList(container, root) {
    const setDepth = (n, d=0)=>{ n.depth=d; (n.children||[]).forEach(c=>setDepth(c,d+1)); };
    setDepth(root);
    const expanded = new Set([root.id]); // только дирекции видны сначала
    const wrap = document.createElement('div'); wrap.className='org-list';
    container.innerHTML=''; container.appendChild(wrap);

    const searchEl = qs('#orgGlobalSearch');
    let query = '';
    const doRender = () => {
      wrap.innerHTML='';
      const walk = n => {
        const d = n.depth||0, kids=(n.children||[]), open=expanded.has(n.id);
        const show = !query || norm(n.name).includes(query) || norm(n.code).includes(query)
          || kids.some(ch => norm(ch.name).includes(query) || norm(ch.code).includes(query) && expanded.add(n.id));
        if (show && d>0) {
          const card = document.createElement('div'); card.className=`org-item depth-${d}`; card.style.borderColor = n.color || '#E9ECEF';
          const row  = document.createElement('div'); row.className='row';
          const h    = document.createElement('h4'); h.className='name'; h.style.color = n.color || '#2b2f33'; h.style.display='inline-flex'; h.style.alignItems='center';
          if (n.code) h.title = `Код: ${n.code}`;
          const ico  = document.createElement('i'); ico.setAttribute('data-lucide', iconSlugFor(n.name));
          ico.style.width='21px'; ico.style.height='21px'; ico.style.marginRight='8px';
          h.appendChild(ico); h.appendChild(document.createTextNode(n.name));
          const emp  = document.createElement('div'); emp.className='emp-pill'; emp.title='Количество сотрудников'; emp.textContent=`${n.headcount ?? '—'} чел.`;
          row.appendChild(h); card.appendChild(row); card.appendChild(emp);
          card.addEventListener('click', () => {
            const isGenDir = d===1 && /генеральн/.test(norm(n.name)) && /дирек/.test(norm(n.name));
            if (d===1 && !open) {
              expanded.add(n.id);
              if (isGenDir) (n.children||[]).forEach(ch => { const nm=norm(ch.name); if (/секретариат/.test(nm)||(/проектн/.test(nm)&&/офис/.test(nm))) expanded.delete(ch.id); });
            } else if (isGenDir) {
              (n.children||[]).forEach(ch => { const nm=norm(ch.name); if (/секретариат/.test(nm)||(/проектн/.test(nm)&&/офис/.test(nm))) expanded.has(ch.id)?expanded.delete(ch.id):expanded.add(ch.id); });
            } else if (kids.length) {
              open ? expanded.delete(n.id) : expanded.add(n.id);
            }
            doRender();
          });
          wrap.appendChild(card);
        }
        if (kids.length && open) kids.forEach(walk);
      };
      walk(root);
      refreshIcons();
    };
    searchEl?.addEventListener('input', debounce(() => { query = norm(searchEl.value); doRender(); }, 200));
    doRender();
  }

  // ------- Таблица -------
  function renderOrgTable(container, root) {
    // Сбор узлов с depth
    const all = [];
    const setDepth = (n, d=0)=>{ n.depth=d; all.push(n); (n.children||[]).forEach(c=>setDepth(c,d+1)); };
    setDepth(root);
    const byId = new Map(all.map(n=>[n.id,n]));
    const expanded = new Set([root.id]); // показываем root + дирекции

    container.innerHTML = `
      <div class="org-table-toolbar">
        <select id="tblLevel" class="select">
          <option value="all">Все уровни</option>
          <option value="0">Только генеральная дирекция</option>
          <option value="1">Только дирекции</option>
          <option value="2">Только управления</option>
          <option value="3+">Только отделы (и глубже)</option>
        </select>
        <button id="btnExpandAll" class="btn">Развернуть все</button>
        <button id="btnCollapseAll" class="btn">Свернуть до дирекций</button>
        <button id="btnExportCSV" class="btn">Экспорт CSV (Excel)</button>
        <button id="btnExportXLSX" class="btn">Экспорт XLSX</button>
      </div>
      <div class="org-table-wrap">
        <table class="org-table" id="orgTable">
          <thead>
            <tr>
              <th style="width:60%;">Подразделение</th>
              <th style="width:20%;">Код</th>
              <th style="width:20%;">Численность</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>`;
    const tbody = qs('#orgTable tbody', container);
    const searchEl = qs('#orgGlobalSearch'); const levelSel = qs('#tblLevel', container);

    const levelPass = (d, v) => v==='all' || (v==='0'&&d===0) || (v==='1'&&d===1) || (v==='2'&&d===2) || (v==='3+'&&d>=3);
    const visible = (n) => {
      if (n===root) return true;
      let cur=n;
      while (cur.parentId) { const p=byId.get(cur.parentId); if (!p) break; if (!expanded.has(p.id)) return false; cur=p; }
      return true;
    };

    const collect = (v, q) => all.filter(n =>
      visible(n) && levelPass(n.depth, v) && (!q || norm(n.name).includes(q) || norm(n.code).includes(q))
    ).map(n => ({ id:n.id, name:n.name, code:n.code||'', headcount:n.headcount??'', depth:n.depth, hasChildren:(n.children||[]).length>0 }));

    const doRender = (v=levelSel.value, q=norm(searchEl?.value||'')) => {
      const rows = collect(v,q);
      tbody.innerHTML = rows.map(r => `
        <tr data-id="${r.id}">
          <td>
            <div class="tree-cell">
              <span class="tree-indent" style="--depth:${r.depth}"></span>
              <button class="tree-caret" ${r.hasChildren?'': 'disabled'}>
                <i data-lucide="${r.hasChildren ? (expanded.has(r.id)?'arrow-down':'arrow-right') : 'circle'}"></i>
              </button>
              <span>${r.name}</span>
            </div>
          </td>
          <td>${r.code || '—'}</td>
          <td>${r.headcount || '—'}</td>
        </tr>`).join('');
      refreshIcons();
    };

    // Делегирование кликов на caret
    tbody.addEventListener('click', e => {
      const btn = e.target.closest('.tree-caret'); if (!btn) return;
      const tr = btn.closest('tr'); const id = tr?.dataset.id; if (!id) return;
      expanded.has(id) ? expanded.delete(id) : expanded.add(id);
      doRender();
    });

    // Панель
    levelSel.addEventListener('change', ()=>doRender());
    qs('#btnExpandAll', container).addEventListener('click', ()=>{ all.forEach(n=>expanded.add(n.id)); doRender(); });
    qs('#btnCollapseAll', container).addEventListener('click', ()=>{ expanded.clear(); expanded.add(root.id); doRender(); });
    qs('#btnExportCSV', container).addEventListener('click', ()=> exportCSV(collect(levelSel.value, norm(searchEl?.value||'')), 'org-structure.csv'));
    qs('#btnExportXLSX', container).addEventListener('click', async ()=>{
      const rows = collect(levelSel.value, norm(searchEl?.value||''));
      try { await exportXLSX(rows, 'org-structure.xlsx'); } catch { exportCSV(rows, 'org-structure.csv'); }
    });

    searchEl?.addEventListener('input', debounce(()=>doRender(), 200));
    doRender();
  }

  // ------- Экспорт -------
  function exportCSV(rows, filename) {
    const escape = s => `"${String(s).replace(/"/g,'""')}"`;
    const lines = [['Подразделение','Код','Численность'].join(',')];
    rows.forEach(r=>{
      const indent=' '.repeat(Math.max(0,r.depth)*2);
      lines.push([escape(indent+r.name), escape(r.code||''), String(r.headcount??'')].join(','));
    });
    const blob = new Blob(['\ufeff'+lines.join('\n')], {type:'text/csv;charset=utf-8;'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
  }
  async function exportXLSX(rows, filename) {
    if (!window.XLSX) await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/xlsx@0.19.3/dist/xlsx.full.min.js'; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
    const aoa=[['Подразделение','Код','Численность']];
    rows.forEach(r=> aoa.push([' '.repeat(Math.max(0,r.depth)*2)+r.name, r.code||'', r.headcount??'']));
    const ws=XLSX.utils.aoa_to_sheet(aoa), wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Оргструктура'); XLSX.writeFile(wb, filename);
  }

  // ------- Страница оргструктуры -------
  async function renderOrgPage() {
    if (!appEl) return;
    appEl.innerHTML = `
      <section class="data-card org-page">
        <div class="card-header">
          <div>
            <h3 class="card-title">Организационная структура</h3>
            <p class="card-subtitle">Organizational Structure</p>
          </div>
          <div class="org-actions">
            <input id="orgGlobalSearch" class="org-search" type="search" placeholder="Поиск по подразделениям"/>
            <div class="view-toggle segmented">
              <button class="seg-btn" id="btnOrgList">Список</button>
              <button class="seg-btn active" id="btnOrgTable">Таблица</button>
            </div>
          </div>
        </div>
        <div id="orgView"></div>
      </section>`;
    initIcons();

    const view = qs('#orgView');
    const btnList = qs('#btnOrgList'); const btnTable = qs('#btnOrgTable');

    let root;
    try {
      const rows = normalizeRows(await fetchOrgRows());
      root = buildTree(rows);
      if (!root) throw new Error('Не найден «Генеральный директор». Проверьте Parent Department ID.');
      colorizeByDirectorate(root);
    } catch (e) {
      view.innerHTML = `
        <div class="data-card" style="border-color:#DC3545;">
          <div class="card-header"><h3 class="card-title">Ошибка загрузки</h3>
          <p class="card-subtitle">Проверьте Supabase URL/Anon Key и RLS SELECT</p></div>
          <pre style="white-space:pre-wrap;color:#DC3545;background:#fff;padding:8px;border-radius:8px;border:1px solid var(--border);">${e.message||e}</pre>
        </div>`;
      return;
    }

    const showList = ()=>{ btnList.classList.add('active'); btnTable.classList.remove('active'); view.innerHTML=''; renderOrgList(view, root); };
    const showTable= ()=>{ btnTable.classList.add('active'); btnList.classList.remove('active'); view.innerHTML=''; renderOrgTable(view, root); };

    btnList.addEventListener('click', showList);
    btnTable.addEventListener('click', showTable);
    showTable(); // по умолчанию — Таблица
  }

  // ------- Header/Sidebar & start -------
  qs('#year') && (qs('#year').textContent = new Date().getFullYear());
  initIcons();
  qs('#sidebarToggle')?.addEventListener('click', ()=>{ document.body.classList.toggle('sidebar-collapsed'); refreshIcons(); });
  (function bindUserMenu(){
    const btn=qs('#userMenuButton'), menu=qs('#userMenu'); if (!btn||!menu) return;
    const toggle=()=>{ const o=menu.classList.toggle('open'); btn.setAttribute('aria-expanded', o?'true':'false'); };
    btn.addEventListener('click', e=>{ e.stopPropagation(); toggle(); refreshIcons(); });
    document.addEventListener('click', e=>{ if (!menu.contains(e.target) && !btn.contains(e.target)) { menu.classList.remove('open'); btn.setAttribute('aria-expanded','false'); }});
  })();
  qs('#themeToggle')?.addEventListener('click', ()=> document.documentElement.classList.toggle('theme-dark'));

  navigate(location.hash.includes('/org') ? 'org' : 'home');
})();