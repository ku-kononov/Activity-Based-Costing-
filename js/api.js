// js/api.js

// Создание клиента Supabase
const supa = (() => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.ENV || {};
  if (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY) {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  console.warn('Supabase не сконфигурирован: проверьте window.ENV и загрузку SDK.');
  return null;
})();
export const supabase = supa;

/* =========== Утилиты (PCF оставляем как есть) =========== */
const pick = (obj, keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
};

function normalizeCode(codeRaw) {
  const s = String(codeRaw || '').trim();
  if (!s) return '';
  let t = s.replace(/^PCF[-\s]*/i, '');
  t = t.replace(/[^\d.]/g, '');
  if (!t) return '';
  t = t.replace(/^\.+|\.+$/g, '').replace(/\.+/g, '.');
  if (/^\d+$/.test(t)) return `${parseInt(t, 10)}.0`;
  return t;
}
function getMajorAny(raw) {
  const n = normalizeCode(raw);
  if (!n) return NaN;
  const [major] = n.split('.');
  const m = parseInt(major, 10);
  return Number.isNaN(m) ? NaN : m;
}
function isLevel2(nCode) { return /^\d+\.\d+$/.test(nCode); }

/* =========== Кэши =========== */
let orgDataCache = null;
let pcfAllCache = null;

/* =========== ORG: public."BOLT_orgchat" =========== */
export async function fetchOrgRows() {
  if (orgDataCache) return orgDataCache;
  if (!supa) throw new Error('Supabase не инициализирован.');

  const cols = `"Department ID","Parent Department ID","Department Name","Department Code","number of employees"`;

  const tries = [
    () => supa.from('BOLT_orgchat').select(cols).limit(50000),
    () => supa.from('"BOLT_orgchat"').select(cols).limit(50000),
    () => supa.schema('public').from('BOLT_orgchat').select(cols).limit(50000),
    () => supa.schema('public').from('"BOLT_orgchat"').select(cols).limit(50000),
  ];

  let lastErr = null;
  for (const fn of tries) {
    try {
      const res = await fn();
      if (!res.error && Array.isArray(res.data)) {
        orgDataCache = res.data || [];
        return orgDataCache;
      }
      lastErr = res.error || null;
    } catch (e) {
      lastErr = e;
    }
  }

  // Если RLS запрещает SELECT — Supabase вернёт 200 и пустой массив (это тоже «ошибка» для нас)
  throw new Error(`Не удалось прочитать public."BOLT_orgchat" или таблица пуста. Причина: ${lastErr?.message || 'возможно, RLS запрещает SELECT'}`);
}

/* =========== PCF (как было) =========== */
export async function fetchPCFRows() {
  if (pcfAllCache) return pcfAllCache;
  if (!supa) throw new Error('Supabase не инициализирован.');

  let res = await supa.from('BOLT_pcf').select('*').limit(50000);
  if (res.error) {
    console.error('PCF: не удалось прочитать public.BOLT_pcf:', res.error?.message || res.error);
    pcfAllCache = [
      { code: '1.0',  name: 'Разработка целей и стратегии', parent_id: 'NO' },
      { code: '2.0',  name: 'Разработка и управление товарами и услугами', parent_id: 'NO' },
      { code: '3.0',  name: 'Продвижение на рынке и продажа товаров и услуг', parent_id: 'NO' },
      { code: '4.0',  name: 'Поставка товаров', parent_id: 'NO' },
      { code: '5.0',  name: 'Предоставление услуг(сервис)', parent_id: 'NO' },
      { code: '6.0',  name: 'Управление обслуживанием клиентов', parent_id: 'NO' },
      { code: '7.0',  name: 'Подготовка и управление трудовыми ресурсами', parent_id: 'NO' },
      { code: '8.0',  name: 'Управление информационными технологиями (it)', parent_id: 'NO' },
      { code: '9.0',  name: 'Управление финансовыми ресурсами', parent_id: 'NO' },
      { code: '10.0', name: 'Приобретение, формирование и управление активами', parent_id: 'NO' },
      { code: '11.0', name: 'Управление рисками предприятия, соответствием требованиям, устранением последствий', parent_id: 'NO' },
      { code: '12.0', name: 'Управление внешними взаимоотношениями', parent_id: 'NO' },
      { code: '13.0', name: 'Разработка и управление бизнес-возможностями', parent_id: 'NO' },
      { code: '3.1', name: 'Понимание рынков, покупателей и возможностей', parent_id: '' },
      { code: '3.2', name: 'Разработка маркетинговой стратегии', parent_id: '' },
      { code: '3.3', name: 'Разработка и управление маркетинговыми планами', parent_id: '' },
      { code: '3.4', name: 'Разработка стратегии продаж', parent_id: '' },
      { code: '3.5', name: 'Разработка и управление планами продаж (администрирование продаж)', parent_id: '' },
    ];
    return pcfAllCache;
  }

  const rows = res.data || [];
  pcfAllCache = rows.map(r => ({
    code: String(pick(r, ['PCF Code', 'PCF code', 'pcf_code', 'code']) ?? ''),
    name: String(pick(r, ['Process Name', 'process_name', 'name']) ?? ''),
    parent_id: String(pick(r, ['Parent Process ID', 'parent_process_id', 'parent_id']) ?? ''),
  }));
  return pcfAllCache;
}

export async function fetchPCFLevel2ByMajor(major) {
  const m = parseInt(major, 10);
  if (Number.isNaN(m)) throw new Error(`Некорректный major: ${major}`);

  const all = await fetchPCFRows();
  const topCode = `${m}.0`;

  return all
    .map(r => ({ ...r, codeN: normalizeCode(r.code) }))
    .filter(r => getMajorAny(r.codeN) === m && isLevel2(r.codeN) && r.codeN !== topCode)
    .sort((a, b) => {
      const A = a.codeN.split('.').map(n => parseInt(n, 10) || 0);
      const B = b.codeN.split('.').map(n => parseInt(n, 10) || 0);
      for (let i = 0; i < Math.max(A.length, B.length); i++) {
        const d = (A[i] || 0) - (B[i] || 0);
        if (d) return d;
      }
      return 0;
    });
}