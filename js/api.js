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

  const allRows = await fetchData('BOLT_orgchat', '"Department ID", "Parent Department ID", "number of employees"');
  const total_departments = allRows.length;
  
  // Считаем сотрудников: Генеральная дирекция (ORG-001) + все подразделения с Parent = ORG-001
  const topLevelDepts = allRows.filter(r =>
    r?.['Department ID'] === 'ORG-001' || r?.['Parent Department ID'] === 'ORG-001'
  );
  const total_employees = topLevelDepts.reduce((sum, r) => sum + Number(r?.['number of employees'] || 0), 0);

  return { total_employees, total_departments };
}

/** Получить названия подразделений по списку кодов */
export async function fetchDepartmentNamesByCodes(orgCodes) {
  if (!orgCodes || !orgCodes.length) return {};
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

/* ========= НОВЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С ПРОФИЛЯМИ ========= */

/**
 * Загружает существующий профиль пользователя или создает новый
 * @param {Object} user - объект пользователя от Supabase Auth
 * @returns {Promise<Object>} - объект профиля
 */
export async function loadOrCreateProfile(user) {
  if (!supa) throw new Error('Supabase не инициализирован');
  if (!user?.id) throw new Error('Требуется объект пользователя');

  try {
    // Сначала пытаемся получить существующий профиль
    let { data: profile, error } = await supa
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Если профиля нет (ошибка PGRST116), создаем новый
    if (error && error.code === 'PGRST116') {
      console.log('Профиль не найден, создаем новый...');
      
      const newProfile = {
        user_id: user.id,
        email: user.email || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: true,
        login_count: 0,
        ui_theme: 'light',
        language: 'ru',
        security_level: 1,
        employment_type: 'FULL_TIME',
        status: 'ACTIVE'
      };

      const { data: createdProfile, error: createError } = await supa
        .from('profiles')
        .insert([newProfile])
        .select()
        .single();

      if (createError) throw createError;
      
      console.log('Профиль успешно создан');
      profile = createdProfile;
    } else if (error) {
      throw error;
    }

    // Обновляем информацию о последнем входе
    await supa
      .from('profiles')
      .update({
        last_login: new Date().toISOString(),
        login_count: (profile.login_count || 0) + 1
      })
      .eq('user_id', user.id);

    return profile;
  } catch (error) {
    console.error('Ошибка в loadOrCreateProfile:', error);
    throw error;
  }
}

/**
 * Загружает аватар пользователя в Supabase Storage
 * @param {File} file - файл изображения
 * @param {string} userId - ID пользователя
 * @returns {Promise<string>} - публичный URL загруженного файла
 */
export async function uploadAvatar(file, userId) {
  if (!supa) throw new Error('Supabase не инициализирован');
  if (!file) throw new Error('Файл не предоставлен');
  if (!userId) throw new Error('ID пользователя не указан');

  try {
    // Проверяем размер файла (макс 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error('Размер файла не должен превышать 5MB');
    }

    // Проверяем тип файла
    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error('Поддерживаются только изображения (JPG, PNG, WebP, GIF)');
    }

    // Генерируем имя файла
    const fileExt = file.name.split('.').pop().toLowerCase();
    const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;

    console.log('Загрузка аватара:', fileName);

    // Загружаем файл в Storage
    const { data, error } = await supa.storage
      .from('avatars')
      .upload(fileName, file, {
        upsert: true,
        cacheControl: '3600',
        contentType: file.type
      });

    if (error) {
      console.error('Ошибка загрузки в Storage:', error);
      
      // Fallback: конвертируем в Base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    // Получаем публичный URL
    const { data: { publicUrl } } = supa.storage
      .from('avatars')
      .getPublicUrl(fileName);

    console.log('Аватар успешно загружен:', publicUrl);
    return publicUrl;

  } catch (error) {
    console.error('Ошибка в uploadAvatar:', error);
    throw error;
  }
}