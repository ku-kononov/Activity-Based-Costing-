// js/utils.js

/** Инициализирует иконки Lucide. Вызывается один раз при старте. */
export const initIconsOnce = (() => {
  let done = false;
  let retries = 0;
  const MAX_RETRIES = 20; // ~2s при 100ms шаге
  const tryInit = () => {
    if (done) return;
    try {
      if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
        done = true;
        return;
      }
    } catch (e) {
      console.error('Lucide init failed', e);
    }
    if (retries < MAX_RETRIES) {
      retries += 1;
      setTimeout(tryInit, 100);
    }
  };
  return () => { tryInit(); };
})();

/** Перерисовывает иконки Lucide, необходимо после добавления нового контента с иконками. */
export const refreshIcons = () => { try { window.lucide?.createIcons?.(); } catch (e) { console.error("Lucide refresh failed", e); } };

/**
 * Безопасно получает значение из объекта по списку возможных ключей.
 * @param {object} obj - Исходный объект.
 * @param {string[]} keys - Массив ключей для поиска.
 * @returns {*} - Найденное значение или undefined.
 */
export const getProp = (obj, ...keys) => keys.reduce((val, key) => val ?? obj?.[key], undefined);

/**
 * Нормализует строку: в нижний регистр, убирает лишние пробелы.
 * @param {string} s - Исходная строка.
 * @returns {string} - Нормализованная строка.
 */
export const norm = s => (s ?? '').toString().trim().toLowerCase();

/**
 * Нормализует ключ для карты иконок (убирает дефисы, двойные пробелы).
 * @param {string} s - Исходная строка.
 * @returns {string} - Нормализованный ключ.
 */
export const normalizeKey = s => norm(s).replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ');

// --- ЛОГИКА ВЫБОРА ИКОНОК ---

/**
 * Централизованная карта соответствия названий подразделений и иконок Lucide.
 * @type {Map<string, string>}
 */
const ICON_MAP = new Map([
  [normalizeKey('Генеральная дирекция'), 'drum'],
  [normalizeKey('Секретаритариат'), 'inbox'],
  [normalizeKey('Проектный офис'), 'kanban'],
  [normalizeKey('Дирекция по продажам и послепродажному обслуживанию'), 'banknote'],
  [normalizeKey('Управление продуктового маркетинга иностранных брендов'), 'globe-2'],
  [normalizeKey('Отдел продуктового маркетинга'), 'megaphone'],
  [normalizeKey('Отдел развития перспективных продуктовых направлений'), 'rocket'],
  [normalizeKey('Управление продуктового маркетинга и ценообразования'), 'tags'],
  [normalizeKey('Отдел аналитики и ценообразования'), 'line-chart'],
  [normalizeKey('Отдел развития продаж основных продуктовых групп'), 'trending-up'],
  [normalizeKey('Отдел специальных проектов'), 'beaker'],
  [normalizeKey('Отдел аналитики Дилеров Lada'), 'bar-chart-3'],
  [normalizeKey('Управление оперативной поддержки продаж на внутреннем рынке'), 'lifebuoy'],
  [normalizeKey('Отдел планирования и распределения ресурса оптовой сети'), 'calendar'],
  [normalizeKey('Отдел планирования и контроля платежей и отгрузок оптовой сети'), 'clipboard-check'],
  [normalizeKey('Отдел планирования и распределения ресурса Дилерской сети'), 'calendar-clock'],
  [normalizeKey('Отдел планирования и контроля платежей и отгрузок Дилерской сети'), 'receipt'],
  [normalizeKey('Управление продаж запасных частей иностранных брендов'), 'package'],
  [normalizeKey('Отдел развития оптовых продаж'), 'shopping-bag'],
  [normalizeKey('Отдел развития прямых продаж'), 'shopping-cart'],
  [normalizeKey('Управление продаж'), 'coins'],
  [normalizeKey('Отдел продаж в Северо - Западном и Южном округах РФ'), 'compass'],
  [normalizeKey('Отдел продаж в Северо-Западном и Южном округах РФ'), 'compass'],
  [normalizeKey('Отдел продаж в центральном округе рф'), 'target'],
  [normalizeKey('Отдел продаж в приволжском округе рф'), 'map'],
  [normalizeKey('Отдел продаж в уральском и сибирском округах рф'), 'snowflake'],
  [normalizeKey('Управление экспортных продаж'), 'plane'],
  [normalizeKey('Отдел развития партнеров'), 'handshake'],
  [normalizeKey('Отдел планирования и распределения ресурса'), 'sliders-horizontal'],
  [normalizeKey('Отдел планирования и контроля платежей и отгрузок'), 'clipboard-list'],
  [normalizeKey('Отдел по работе с корпоративными клиентами'), 'briefcase'],
  [normalizeKey('Дирекция по маркетинговым коммуникациям'), 'radio'],
  [normalizeKey('Отдел стандартизации и клиентского сервиса'), 'ruler'],
  [normalizeKey('Отдел продаж СI и САП'), 'palette'],
  [normalizeKey('Отдел рекламы и коммуникаций'), 'message-square'],
  [normalizeKey('Бюро обеспечения рекламно-сувенирной продукцией'), 'gift'],
  [normalizeKey('Отдел интернет-проектов'), 'globe'],
  [normalizeKey('Дирекция по развитию бизнеса'), 'lightbulb'],
  [normalizeKey('Отдел клиентского сервиса'), 'headphones'],
  [normalizeKey('Управление развития федеральной сети сервисов'), 'sitemap'],
  [normalizeKey('Отдел развития и продаж франшизы'), 'award'],
  [normalizeKey('Отдел аудита и продвижения'), 'search-check'],
  [normalizeKey('Отдел поддержки бизнеса'), 'helping-hand'],
  [normalizeKey('Управление развития бизнес-проектов'), 'folder-plus'],
  [normalizeKey('Отдел организации продаж РЕНО'), 'car'],
  [normalizeKey('Отдел организации продаж НИССАН'), 'car-front'],
  [normalizeKey('Дирекция по инжинирингу'), 'wrench'],
  [normalizeKey('Управление сопровождения новых моделей автомобилей'), 'sparkles'],
  [normalizeKey('Отдел разработки технологии ремонта'), 'hammer'],
  [normalizeKey('Отдел разработки и валидации запасных частей и аксессуаров'), 'puzzle'],
  [normalizeKey('Бюро обеспечения качества поставок'), 'badge-check'],
  [normalizeKey('Бюро разработки бортовой документации'), 'book-open'],
  [normalizeKey('Управление инженерных данных'), 'database'],
  [normalizeKey('Отдел разработки конструкторской документации'), 'ruler-square'],
  [normalizeKey('Отдел разработки каталогов'), 'library'],
  [normalizeKey('Отдел нормативно-справочной информации'), 'scroll'],
  [normalizeKey('Бюро технической поддержки по подбору запасных частей'), 'stethoscope'],
  [normalizeKey('Дирекция по безопасности'), 'shield'],
  [normalizeKey('Отдел экономической безопасности'), 'lock'],
  [normalizeKey('Отдел анализа и защиты информации'), 'file-lock-2'],
  [normalizeKey('Отдел охраны объектов'), 'shield-plus'],
  [normalizeKey('Бюро пропусков'), 'id-card'],
  [normalizeKey('Дирекция по закупкам'), 'shopping-bag'],
  [normalizeKey('Отдел непрямых закупок'), 'link-2'],
  [normalizeKey('Отдел закупок иностранных брендов'), 'languages'],
  [normalizeKey('Отдел специальных закупок'), 'wand-2'],
  [normalizeKey('Аналитическо-административный отдел'), 'calculator'],
  [normalizeKey('Управление закупок запасных частей и аксессуаров'), 'package-search'],
  [normalizeKey('Отдел закупок запасных частей'), 'package-plus'],
  [normalizeKey('Отдел закупок аксессуаров'), 'gem'],
  [normalizeKey('Отдел закупок запасных частей и сопровождения новых проектов'), 'package-check'],
  [normalizeKey('Дирекция по операционной деятельности'), 'cog'],
  [normalizeKey('Центр запасных частей № 1'), 'box'],
  [normalizeKey('Центр запасных частей № 2'), 'archive'],
  [normalizeKey('Отдел импорта и развития проектов в логистике'), 'ship'],
  [normalizeKey('Служба руководителя по логистике и инжинирингу производства'), 'waypoints'],
  [normalizeKey('Отдел логистики'), 'truck'],
  [normalizeKey('Конструкторско - технологический отдел'), 'pen-tool'],
  [normalizeKey('Конструкторско-технологический отдел'), 'pen-tool'],
  [normalizeKey('Склад в г. Ижевск'), 'home'],
  [normalizeKey('Отдел технического контроля'), 'check-circle-2'],
  [normalizeKey('Склад зарекламированных изделий'), 'recycle'],
  [normalizeKey('Служба главного инженера'), 'nut'],
  [normalizeKey('Административно-хозяйственный отдел'), 'key-round'],
  [normalizeKey('Бюро охраны труда'), 'first-aid'],
  [normalizeKey('Управление формирования и распределения ресурса'), 'gauge'],
  [normalizeKey('Отдел организации и контроля отгрузки дилерам'), 'send'],
  [normalizeKey('Отдел организации и контроля отгрузки оптовым покупателям'), 'package-up'],
  [normalizeKey('Отдел планирования'), 'calendar'],
  [normalizeKey('Отдел поставок'), 'package'],
  [normalizeKey('Отдел обеспечения производственной деятельности'), 'building'],
  [normalizeKey('Управление транспортной логистики'), 'route'],
  [normalizeKey('Отдел организации грузоперевозок'), 'navigation-2'],
  [normalizeKey('Отдел сопровождения и контроля грузоперевозок'), 'radar'],
  [normalizeKey('Отдел отгрузки'), 'outbox'],
  [normalizeKey('Управление обеспечения операционной деятельности'), 'settings-2'],
  [normalizeKey('Отдел оперативного обеспечения ТМЦ'), 'zap'],
  [normalizeKey('Отдел планирования поставок ТМЦ'), 'calendar-plus'],
  [normalizeKey('Дирекция по консолидированному анализу бизнес-процессов'), 'layers'],
  [normalizeKey('Отдел анализа эффективности бизнес-процессов'), 'activity'],
  [normalizeKey('Отдел консолидированной отчетности'), 'pie-chart'],
  [normalizeKey('Юридическое управление'), 'scale'],
  [normalizeKey('Отдел правового обеспечения'), 'file-pen'],
  [normalizeKey('Отдел юридического сопровождения сделок и корпоративной работе'), 'scroll']
]);

/**
 * Возвращает название иконки Lucide для заданного подразделения.
 * @param {string} name - Название подразделения.
 * @returns {string} - Название иконки (slug).
 */
export function iconSlugFor(name) {
  const key = normalizeKey(name);
  return ICON_MAP.get(key) || 'building-2'; // Иконка по умолчанию
}