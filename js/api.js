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

/* =========== Вспомогалки (для PCF) =========== */
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

/* =========== Кэш =========== */
let orgDataCache = null;
let pcfAllCache = null;

/* =========== ORG: public."BOLT_orgchat" (как было) =========== */
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
  throw new Error(`Не удалось прочитать public."BOLT_orgchat" или таблица пуста. Причина: ${lastErr?.message || 'возможно, RLS запрещает SELECT'}`);
}

/* =========== PCF: public."BOLT_pcf" (исправлено) =========== */
export async function fetchPCFRows() {
  if (pcfAllCache) return pcfAllCache;
  if (!supa) throw new Error('Supabase не инициализирован.');

  const cols = `"Process ID","Parent Process ID","PCF Code","Process Name"`;
  const tries = [
    () => supa.from('BOLT_pcf').select(cols).limit(50000),
    () => supa.from('"BOLT_pcf"').select(cols).limit(50000),
    () => supa.from('BOLT.PCF').select(cols).limit(50000),
    () => supa.from('PCF').select(cols).limit(50000),
    () => supa.from('pcf').select(cols).limit(50000),
  ];

  let data = null, lastErr = null;
  for (const t of tries) {
    try {
      const res = await t();
      if (!res.error && Array.isArray(res.data)) { data = res.data; break; }
      lastErr = res.error || null;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!data) {
    throw new Error(`Не удалось прочитать public."BOLT_pcf": ${lastErr?.message || lastErr}`);
  }

  // Унифицируем: code из "PCF Code" или "Process ID"; name из "Process Name"; parent_id из "Parent Process ID"
  const mapped = (data || []).map(r => {
    const id = String(r['Process ID'] ?? '').trim();
    const codeRaw = String((r['PCF Code'] ?? id ?? '')).trim();
    const name = String(r['Process Name'] ?? '').trim();
    const parent = String(r['Parent Process ID'] ?? '').trim();
    return { id, code: codeRaw, name, parent_id: parent };
  }).filter(row => row.code || row.id);

  pcfAllCache = mapped;
  return pcfAllCache;
}

/* =========== Вспомогательная выборка L2 (если нужно в других местах) =========== */
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