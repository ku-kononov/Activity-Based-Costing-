// js/api.js

// Создание клиента Supabase
const supa = (() => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.ENV || {};
  if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  console.warn('Supabase не сконфигурирован: проверьте window.ENV в index.html и загрузку SDK.');
  return null;
})();
export const supabase = supa;

/* Кэши (только для "сырых" данных) */
let orgDataCache = null;
let pcfDataCache = null;

/* ========== ORG: public."BOLT_orgchat" ========== */
export async function fetchOrgRows() {
  if (orgDataCache) return orgDataCache;
  if (!supa) throw new Error('Supabase не инициализирован.');

  const cols = '"Department ID","Parent Department ID","Department Name","Department Code","number of employees"';
  const { data, error } = await supa.from('BOLT_orgchat').select(cols).limit(50000);
  if (error || !data) {
    throw new Error(`Не удалось прочитать public."BOLT_orgchat": ${error?.message || 'RLS/пусто'}`);
  }
  orgDataCache = data;
  return orgDataCache;
}

/* ========== ORG STATS: корень + первый уровень (root по умолчанию 'ORG-001') ========== */
export async function fetchOrgStats() {
  if (!supa) throw new Error('Supabase не инициализирован.');

  // 1) RPC: используем дефолтный root из функции (НЕ передаём параметр, чтобы не переопределять 'ORG-001')
  try {
    const { data, error } = await supa.rpc('count_employees_lvl1'); // без { root: ... }
    if (!error && Array.isArray(data) && data.length) {
      return {
        total_departments: Number(data[0].total_departments || 0),
        total_employees: Number(data[0].total_employees || 0),
      };
    }
  } catch (e) {
    console.warn('RPC count_employees_lvl1 недоступен, fallback на клиенте:', e?.message || e);
  }

  // 2) Fallback: считаем на клиенте
  const { data: rows, error: selErr, count } = await supa
    .from('BOLT_orgchat')
    .select('"Department ID","Department Code","Parent Department ID","number of employees"', { count: 'exact' })
    .limit(50000);

  if (selErr || !rows) {
    console.error('Ошибка получения статистики по оргструктуре (fallback):', selErr);
    return { total_departments: 0, total_employees: 0 };
  }

  const ROOT = 'ORG-001'; // корневой ID с дефисом
  const trimS = v => String(v ?? '').trim();

  // Находим реальный корневой ID по ID или по коду
  const rootRow = rows.find(r => trimS(r['Department ID']) === ROOT || trimS(r['Department Code']) === ROOT);
  const rootId = rootRow ? trimS(rootRow['Department ID']) : ROOT;

  // Парсер численности: удаляем всё, кроме цифр
  const toInt = v => {
    if (typeof v === 'number') return v;
    const s = String(v ?? '').replace(/[^\d]/g, '');
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? 0 : n;
  };

  // Суммируем: корень + только первый уровень подчинения
  let total_employees = 0;
  for (const r of rows) {
    const depId = trimS(r['Department ID']);
    const parentId = trimS(r['Parent Department ID']);
    if (depId === rootId || parentId === rootId) {
      total_employees += toInt(r['number of employees']);
    }
  }

  return {
    total_departments: typeof count === 'number' ? count : rows.length,
    total_employees,
  };
}

/* ========== PCF: public."BOLT_pcf" ========== */
export async function fetchPCFRows() {
  if (pcfDataCache) return pcfDataCache;
  if (!supa) throw new Error('Supabase не инициализирован.');

  const { data, error } = await supa
    .from('BOLT_pcf')
    .select('code:"PCF Code", name:"Process Name", parent_id:"Parent Process ID"')
    .limit(50000);

  if (error || !data) {
    throw new Error(`Не удалось прочитать public."BOLT_pcf": ${error?.message || 'RLS/пусто'}`);
  }

  pcfDataCache = data;
  return pcfDataCache;
}