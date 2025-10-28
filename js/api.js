// js/api.js
'use strict';

/**
 * Универсальный Supabase‑клиент + кэш с привязкой к сессии.
 * Требуются ENV: window.ENV = { SUPABASE_URL: '...', SUPABASE_ANON_KEY: '...' }
 */

const supa = (() => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.ENV || {};
  if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    } catch (e) {
      console.error('Ошибка инициализации Supabase:', e);
      return null;
    }
  }
  console.warn('Supabase клиент не был инициализирован. Проверьте window.ENV (SUPABASE_URL, SUPABASE_ANON_KEY).');
  return null;
})();
export const supabase = supa;

/* ========= Кэш с привязкой к сессии ========= */
const cache = Object.create(null);

async function getSessionKey() {
  if (!supa) return 'anon';
  try {
    const { data: { session } } = await supa.auth.getSession();
    return session?.user?.id || 'anon';
  } catch {
    return 'anon';
  }
}

if (supa?.auth?.onAuthStateChange) {
  supa.auth.onAuthStateChange(() => {
    Object.keys(cache).forEach(k => delete cache[k]);
  });
}

/**
 * Универсальная выборка из таблицы/вью с кэшированием по сессии.
 * @param {string} tableName
 * @param {string} [select='*']
 * @param {{ noCache?: boolean, limit?: number }} [options]
 */
export async function fetchData(tableName, select = '*', options = {}) {
  if (!supa) throw new Error('Supabase не инициализирован.');

  const sel = (typeof select === 'string' && select.trim().length > 0) ? select : '*';
  const sessKey = await getSessionKey();
  const key = `${tableName}::${sel}::${sessKey}`;

  if (!options.noCache && cache[key]) return cache[key];

  let query = supa.from(tableName).select(sel);
  if (Number.isFinite(options.limit)) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw new Error(`Не удалось прочитать "${tableName}": ${error.message}.`);

  cache[key] = data || [];
  return cache[key];
}

/** Полные строки из BOLT_orgchat (если требуется) */
export const fetchOrgRows = () => fetchData('BOLT_orgchat');

/** Полные строки из BOLT_Cost Driver_pcf+orgchat для связи процессов и подразделений */
export const fetchCostDriverPCFOrgRows = () => fetchData('BOLT_Cost Driver_pcf+orgchat');

/** PCF (минимальные поля) */
export const fetchPCFRows = () =>
  fetchData('BOLT_pcf', '"Process ID", code:"PCF Code", name:"Process Name", parent_id:"Parent Process ID"');

/** PnL-вью за год */
export const fetchPnlData = (year) => fetchData(`v_pnl_${year}`);

/** Отсортированный список подразделений (строки) */
export async function fetchOrgDepartments() {
  const rows = await fetchData('BOLT_orgchat', '"Department Name"');
  const names = Array.from(new Set((rows || []).map(r => r?.['Department Name']).filter(Boolean)));
  names.sort((a, b) => a.localeCompare(b, 'ru'));
  return names;
}

/** Статистика для раздела "Компания" */
export async function fetchOrgStats() {
  if (!supa) throw new Error('Supabase не инициализирован.');
  const ROOT_DEPT_ID = 'ORG-001';

  const [rootRes, childrenRes] = await Promise.all([
    supa.from('BOLT_orgchat').select('"number of employees"').eq('Department ID', ROOT_DEPT_ID).limit(1),
    supa.from('BOLT_orgchat').select('"number of employees"').eq('Parent Department ID', ROOT_DEPT_ID)
  ]);

  if (rootRes.error) throw new Error(`Не удалось получить данные по генеральной дирекции: ${rootRes.error.message}`);
  if (childrenRes.error) throw new Error(`Не удалось получить данные по подразделениям: ${childrenRes.error.message}`);

  const rootRow = (rootRes.data && rootRes.data[0]) || null;
  const rootEmployees = rootRow ? Number(rootRow['number of employees'] || 0) : 0;

  const childrenRows = childrenRes.data || [];
  const total_departments = childrenRows.length;
  const childrenEmployees = childrenRows.reduce((sum, r) => sum + Number(r?.['number of employees'] || 0), 0);

  return { total_employees: rootEmployees + childrenEmployees, total_departments };
}

/** Получить названия подразделений по списку кодов */
export async function fetchDepartmentNamesByCodes(orgCodes) {
  if (!orgCodes || !orgCodes.length) return {};
  const codesList = orgCodes.join(',');
  const rows = await fetchData('BOLT_orgchat', '"Department ID", "Department Name", "Parent Department ID"', { noCache: true });
  const nameMap = {};
  rows.forEach(row => {
    if (orgCodes.includes(row['Department ID'])) {
      nameMap[row['Department ID']] = row['Department Name'];
    }
  });
  return nameMap;
}

/** Получить полную оргструктуру для построения иерархии */
export const fetchOrgStructure = () => fetchData('BOLT_orgchat', '"Department ID", "Department Name", "Parent Department ID"');