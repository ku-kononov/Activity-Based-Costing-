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

/**
 * Загружает PCF из BOLT.pcf.
 * Используем поля:
 *  - "PCF code"
 *  - "Process Name"
 *  - "Parent Process"
 */
export async function fetchPCFRows() {
  if (pcfDataCache) return pcfDataCache;
  if (!supa) throw new Error('Supabase не инициализирован.');

  const selectColumns = '"PCF code","Process Name","Parent Process"';

  let res = await supa.schema('BOLT').from('pcf').select(selectColumns).limit(10000);
  if (res.error) res = await supa.schema('BOLT').from('PCF').select(selectColumns).limit(10000);
  if (res.error) res = await supa.from('BOLT.pcf').select(selectColumns).limit(10000);
  if (res.error) res = await supa.from('BOLT.PCF').select(selectColumns).limit(10000);
  if (res.error) res = await supa.from('pcf').select(selectColumns).limit(10000);
  if (res.error) res = await supa.from('PCF').select(selectColumns).limit(10000);

  if (res.error) {
    console.warn('PCF: не удалось загрузить из Supabase. Причина:', res.error?.message || res.error);
    // Фолбэк-данные с теми же колонками (на случай офлайна)
    pcfDataCache = [
      { 'PCF code': 'PCF-1.0',  'Process Name': 'Разработка целей и стратегии', 'Parent Process': '' },
      { 'PCF code': 'PCF-2.0',  'Process Name': 'Разработка и управление товарами и услугами', 'Parent Process': '' },
      { 'PCF code': 'PCF-3.0',  'Process Name': 'Продвижение на рынке и продажа товаров и услуг', 'Parent Process': '' },
      { 'PCF code': 'PCF-4.0',  'Process Name': 'Поставка товаров', 'Parent Process': '' },
      { 'PCF code': 'PCF-5.0',  'Process Name': 'Предоставление услуг(сервис)', 'Parent Process': '' },
      { 'PCF code': 'PCF-6.0',  'Process Name': 'Управление обслуживанием клиентов', 'Parent Process': '' },
      { 'PCF code': 'PCF-7.0',  'Process Name': 'Подготовка и управление трудовыми ресурсами', 'Parent Process': '' },
      { 'PCF code': 'PCF-8.0',  'Process Name': 'Управление информационными технологиями (it)', 'Parent Process': '' },
      { 'PCF code': 'PCF-9.0',  'Process Name': 'Управление финансовыми ресурсами', 'Parent Process': '' },
      { 'PCF code': 'PCF-10.0', 'Process Name': 'Приобретение, формирование и управление активами', 'Parent Process': '' },
      { 'PCF code': 'PCF-11.0', 'Process Name': 'Управление рисками предприятия, соответствием требованиям, устранением последствий', 'Parent Process': '' },
      { 'PCF code': 'PCF-12.0', 'Process Name': 'Управление внешними взаимоотношениями', 'Parent Process': '' },
      { 'PCF code': 'PCF-13.0', 'Process Name': 'Разработка и управление бизнес-возможностями', 'Parent Process': '' },

      // Примеры Level 2 (для офлайна, можно удалить при реальном API):
      // { 'PCF code': 'PCF-1.1', 'Process Name': 'Планирование стратегии', 'Parent Process': 'PCF-1.0' },
      // { 'PCF code': 'PCF-1.2', 'Process Name': 'Управление портфелем инициатив', 'Parent Process': 'PCF-1.0' },
      // { 'PCF code': 'PCF-1.3', 'Process Name': 'Мониторинг исполнения', 'Parent Process': '1.0' },
    ];
    return pcfDataCache;
  }

  pcfDataCache = res.data || [];
  return pcfDataCache;
}