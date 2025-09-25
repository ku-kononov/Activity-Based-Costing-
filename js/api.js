// js/api.js

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

export async function fetchPCFRows() {
  if (pcfDataCache) return pcfDataCache;
  if (!supa) throw new Error('Supabase не инициализирован.');
  let res = await supa.schema('BOLT').from('PCF').select('*').limit(10000);
  if (res.error) res = await supa.from('BOLT.PCF').select('*').limit(10000);
  if (res.error) res = await supa.from('PCF').select('*').limit(10000);
  if (res.error) {
    console.warn('PCF: не удалось загрузить из Supabase. Причина:', res.error?.message || res.error);
    // Фолбэк: минимальный набор верхнеуровневых кодов для отображения каталога
    pcfDataCache = [
      { code:'1.0', name:'Управление' },
      { code:'2.0', name:'Разработка стратегии' },
      { code:'3.0', name:'Маркетинг и продажи' },
      { code:'4.0', name:'Производство/Оказание услуг' },
      { code:'5.0', name:'Доставка/Логистика' },
      { code:'6.0', name:'Обслуживание клиентов' },
      { code:'7.0', name:'Управление человеческим капиталом' },
      { code:'8.0', name:'Управление ИТ' },
      { code:'9.0', name:'Управление финансовыми ресурсами' },
      { code:'10.0', name:'Управление активами' },
      { code:'11.0', name:'Покупки/Закупки' },
      { code:'12.0', name:'Риски, соответствие и безопасность' },
      { code:'13.0', name:'Корпоративные отношения' }
    ];
    return pcfDataCache;
  }
  pcfDataCache = res.data || [];
  return pcfDataCache;
}



