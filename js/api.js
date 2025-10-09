// js/api.js
const supa = (() => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.ENV || {};
  if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
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
    throw new Error(`Таблица "${tableName}" вернула 0 строк. Проверьте RLS.`);
  }
  cache[tableName] = data;
  return data;
}

export const fetchOrgRows = () => fetchData('BOLT_orgchat');
export const fetchPCFRows = () => fetchData('BOLT_pcf', 'code:"PCF Code", name:"Process Name", parent_id:"Parent Process ID"');
export const fetchPnlData = (year) => fetchData(`v_pnl_${year}`);
export async function fetchOrgStats() { /* ... код без изменений ... */ }