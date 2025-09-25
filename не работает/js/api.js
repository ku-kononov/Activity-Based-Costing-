// js/api.js

/** Экземпляр клиента Supabase. */
const supa = (() => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.ENV || {};
  if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  console.warn('Supabase не сконфигурирован.');
  return null;
})();

let orgDataCache = null;
let pcfDataCache = null;

/**
 * Загружает и кэширует данные оргструктуры.
 * @returns {Promise<Array<object>>} - Массив строк из таблицы.
 */
export async function fetchOrgRows() {
  if (orgDataCache) return orgDataCache;
  if (!supa) throw new Error('Supabase не инициализирован.');

  let res = await supa.schema('BOLT').from('orgchat').select('*').limit(10000);
  if (res.error) res = await supa.from('BOLT.orgchat').select('*').limit(10000);
  if (res.error) res = await supa.from('orgchat').select('*').limit(10000);
  if (res.error) throw res.error;
  
  orgDataCache = res.data || [];
  return orgDataCache;
}

/**
 * Загружает и кэширует данные PCF.
 * @returns {Promise<Array<object>>} - Массив строк из таблицы.
 */
export async function fetchPCFRows() {
    if (pcfDataCache) return pcfDataCache;
    if (!supa) throw new Error('Supabase не инициализирован.');

    let res = await supa.schema('BOLT').from('PCF').select('*').limit(10000);
    if (res.error) res = await supa.from('BOLT.PCF').select('*').limit(10000);
    if (res.error) res = await supa.from('PCF').select('*').limit(10000);
    if (res.error) throw res.error;
    
    pcfDataCache = res.data || [];
    return pcfDataCache;
}