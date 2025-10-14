// js/api.js
const supa = (() => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.ENV || {};
  if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  console.warn('Supabase клиент не был инициализирован. Проверьте ENV переменные.');
  return null;
})();
export const supabase = supa;

const cache = {};

async function fetchData(tableName, select = '*') {
  if (cache[tableName]) return cache[tableName];
  if (!supa) throw new Error('Supabase не инициализирован.');

  const { data, error } = await supa.from(tableName).select(select).limit(50000);
  if (error) {
    throw new Error(`Не удалось прочитать "${tableName}": ${error.message}.`);
  }
  if (!data || data.length === 0) {
    console.warn(`Таблица "${tableName}" вернула 0 строк. Проверьте RLS и наличие данных.`);
  }
  cache[tableName] = data;
  return data;
}

export const fetchOrgRows = () => fetchData('BOLT_orgchat');
export const fetchPCFRows = () => fetchData('BOLT_pcf', 'code:"PCF Code", name:"Process Name", parent_id:"Parent Process ID"');
export const fetchPnlData = (year) => fetchData(`v_pnl_${year}`);

/**
 * Корректная статистика для модуля "Компания":
 * - total_employees: сотрудники в "генеральной дирекции" (Department ID = ORG-001)
 *   + сотрудники подразделений, где Parent Department ID = ORG-001
 * - total_departments: количество подразделений, где Parent Department ID = ORG-001
 */
export async function fetchOrgStats() {
  const ROOT_DEPT_ID = 'ORG-001'; // Генеральная дирекция
  if (cache['org_stats']) return cache['org_stats'];
  if (!supa) throw new Error('Supabase не инициализирован.');

  // Запрос 1: "генеральная дирекция" (одна строка по Department ID)
  // Запрос 2: все прямые подчиненные (Parent Department ID = ORG-001)
  const [rootRes, childrenRes] = await Promise.all([
    supa
      .from('BOLT_orgchat')
      .select('"number of employees"')
      .eq('Department ID', ROOT_DEPT_ID)
      .limit(1),
    supa
      .from('BOLT_orgchat')
      .select('"number of employees"')
      .eq('Parent Department ID', ROOT_DEPT_ID),
  ]);

  if (rootRes.error) {
    console.error('Ошибка чтения корневого отдела (ORG-001):', rootRes.error);
    throw new Error(`Не удалось получить данные по генеральной дирекции: ${rootRes.error.message}`);
  }
  if (childrenRes.error) {
    console.error('Ошибка чтения дочерних подразделений (Parent=ORG-001):', childrenRes.error);
    throw new Error(`Не удалось получить данные по подразделениям: ${childrenRes.error.message}`);
  }

  const rootRow = (rootRes.data && rootRes.data[0]) || null;
  const rootEmployees = rootRow ? Number(rootRow['number of employees'] || 0) : 0;

  const childrenRows = childrenRes.data || [];
  const total_departments = childrenRows.length;
  const childrenEmployees = childrenRows.reduce(
    (sum, r) => sum + Number(r?.['number of employees'] || 0),
    0
  );

  const stats = {
    total_employees: rootEmployees + childrenEmployees,
    total_departments,
  };

  cache['org_stats'] = stats;
  return stats;
}