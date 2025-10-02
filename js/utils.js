// js/utils.js (consolidated)

/** Инициализация иконок Lucide один раз с ретраями (скрипт подключён defer). */
export const initIconsOnce = (() => {
  let done = false;
  let retries = 0;
  const MAX_RETRIES = 40; // ~4s
  let loading = false;

  const ensureLucideScript = () => {
    if (window.lucide || loading) return;
    loading = true;
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/lucide@0.468.0/dist/umd/lucide.min.js';
    s.async = true;
    s.onload = () => { loading = false; tryInit(); };
    s.onerror = () => {
      const s2 = document.createElement('script');
      s2.src = 'https://unpkg.com/lucide@0.468.0/dist/umd/lucide.min.js';
      s2.async = true;
      s2.onload = () => { loading = false; tryInit(); };
      s2.onerror = () => { loading = false; };
      document.head.appendChild(s2);
    };
    document.head.appendChild(s);
  };
  const tryInit = () => {
    if (done) return;
    try {
      if (window.lucide && (typeof window.lucide.createIcons === 'function' || typeof window.lucide.replace === 'function')) {
        (window.lucide.createIcons || window.lucide.replace).call(window.lucide);
        done = true;
        return;
      }
    } catch {}
    if (!window.lucide) ensureLucideScript();
    if (retries < MAX_RETRIES) { retries += 1; setTimeout(tryInit, 100); }
  };
  return () => tryInit();
})();

/** Форс-обновление иконок после динамического DOM-рендера. */
export const refreshIcons = () => { try { (window.lucide?.createIcons || window.lucide?.replace)?.call(window.lucide); } catch {} };

/** Утилиты */
export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const norm = s => (s ?? '').toString().trim().toLowerCase();
export const normalizeKey = s => norm(s).replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ');

/** Debounce */
export const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/** Централизованная карта соответствия названий подразделений и иконок Lucide. */
const ICON_MAP = new Map([
  [normalizeKey('Генеральная дирекция'), 'ship'],
  [normalizeKey('Секретариат'), 'clapperboard'],
  [normalizeKey('Проектный офис'), 'tent'],
  [normalizeKey('Дирекция по продажам и послепродажному обслуживанию'), 'gift'],
  [normalizeKey('Управление продуктового маркетинга иностранных брендов'), 'globe-2'],
  [normalizeKey('Отдел продуктового маркетинга'), 'megaphone'],
  [normalizeKey('Отдел развития перспективных продуктовых направлений'), 'rocket'],
  [normalizeKey('Управление продуктового маркетинга и ценообразования'), 'tags'],
  [normalizeKey('Отдел аналитики и ценообразования'), 'line-chart'],
  [normalizeKey('Отдел развития продаж основных продуктовых групп'), 'trending-up'],
  [normalizeKey('Отдел специальных проектов'), 'beaker'],
  [normalizeKey('Отдел аналитики Дилеров Lada'), 'bar-chart-3'],
  [normalizeKey('Управление оперативной поддержки продаж на внутреннем рынке'), 'heart-handshake'],
  [normalizeKey('Отдел планирования и распределения ресурса оптовой сети'), 'calendar'],
  [normalizeKey('Отдел планирования и контроля платежей и отгрузок оптовой сети'), 'clipboard-check'],
  [normalizeKey('Отдел планирования и распределения ресурса Дилерской сети'), 'calendar-clock'],
  [normalizeKey('Отдел планирования и контроля платежей и отгрузок Дилерской сети'), 'hand-coins'],
  [normalizeKey('Управление продаж запасных частей иностранных брендов'), 'package'],
  [normalizeKey('Отдел развития оптовых продаж'), 'shopping-bag'],
  [normalizeKey('Отдел развития прямых продаж'), 'shopping-cart'],
  [normalizeKey('Управление продаж'), 'coins'],
  [normalizeKey('Отдел продаж в Северо - Западном и Южном округах РФ'), 'compass'],
  [normalizeKey('Отдел продаж в Северо-Западном и Южном округах РФ'), 'compass'],
  [normalizeKey('Отдел продаж в центральном округе рф'), 'target'],
  [normalizeKey('Отдел продаж в приволжском округе рф'), 'map'],
  [normalizeKey('Отдел продаж в уральском и сибирском округах рф'), 'snowflake'],
  [normalizeKey('Управление экспортных продаж'), 'banknote'],
  [normalizeKey('Отдел развития партнеров'), 'file-user'],
  [normalizeKey('Отдел планирования и распределения ресурса'), 'sliders-horizontal'],
  [normalizeKey('Отдел планирования и контроля платежей и отгрузок'), 'clipboard-list'],
  [normalizeKey('Отдел по работе с корпоративными клиентами'), 'briefcase'],
  [normalizeKey('Дирекция по маркетинговым коммуникациям'), 'radio'],
  [normalizeKey('Отдел стандартизации и клиентского сервиса'), 'ruler'],
  [normalizeKey('Отдел продаж СI и САП'), 'palette'],
  [normalizeKey('Отдел рекламы и коммуникаций'), 'message-square'],
  [normalizeKey('Бюро обеспечения рекламно-сувенирной продукцией'), 'candy'],
  [normalizeKey('Отдел интернет-проектов'), 'globe'],
  [normalizeKey('Дирекция по развитию бизнеса'), 'plane'],
  [normalizeKey('Отдел клиентского сервиса'), 'headphones'],
  [normalizeKey('Управление развития федеральной сети сервисов'), 'radio-tower'],
  [normalizeKey('Отдел развития и продаж франшизы'), 'award'],
  [normalizeKey('Отдел аудита и продвижения'), 'search-check'],
  [normalizeKey('Отдел поддержки бизнеса'), 'helping-hand'],
  [normalizeKey('Управление развития бизнес-проектов'), 'folder-plus'],
  [normalizeKey('Отдел организации продаж РЕНО'), 'car'],
  [normalizeKey('Отдел организации продаж НИССАН'), 'car-front'],
  [normalizeKey('Дирекция по инжинирингу'), 'drafting-compass'],
  [normalizeKey('Управление сопровождения новых моделей автомобилей'), 'pencil-ruler'],
  [normalizeKey('Отдел разработки технологии ремонта'), 'hammer'],
  [normalizeKey('Отдел разработки и валидации запасных частей и аксессуаров'), 'puzzle'],
  [normalizeKey('Бюро обеспечения качества поставок'), 'badge-check'],
  [normalizeKey('Бюро разработки бортовой документации'), 'book-open'],
  [normalizeKey('Управление инженерных данных'), 'database'],
  [normalizeKey('Отдел разработки конструкторской документации'), 'book-type'],
  [normalizeKey('Отдел разработки каталогов'), 'library'],
  [normalizeKey('Отдел нормативно-справочной информации'), 'scroll'],
  [normalizeKey('Бюро технической поддержки по подбору запасных частей'), 'stethoscope'],
  [normalizeKey('Дирекция по безопасности'), 'shield'],
  [normalizeKey('Отдел экономической безопасности'), 'lock'],
  [normalizeKey('Отдел анализа и защиты информации'), 'file-lock-2'],
  [normalizeKey('Отдел охраны объектов'), 'cctv'],
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
  [normalizeKey('Центр запасных частей № 1'), 'warehouse'],
  [normalizeKey('Центр запасных частей № 2'), 'warehouse'],
  [normalizeKey('Отдел импорта и развития проектов в логистике'), 'sailboat'],
  [normalizeKey('Служба руководителя по логистике и инжинирингу производства'), 'waypoints'],
  [normalizeKey('Отдел логистики'), 'truck'],
  [normalizeKey('Конструкторско - технологический отдел'), 'pen-tool'],
  [normalizeKey('Конструкторско-технологический отдел'), 'pen-tool'],
  [normalizeKey('Склад в г. Ижевск'), 'warehouse'],
  [normalizeKey('Отдел технического контроля'), 'check-circle-2'],
  [normalizeKey('Склад зарекламированных изделий'), 'recycle'],
  [normalizeKey('Служба главного инженера'), 'factory'],
  [normalizeKey('Административно-хозяйственный отдел'), 'key-round'],
  [normalizeKey('Бюро охраны труда'), 'heart-handshake'],
  [normalizeKey('Управление формирования и распределения ресурса'), 'chart-candlestick'],
  [normalizeKey('Отдел организации и контроля отгрузки дилерам'), 'shopping-cart'],
  [normalizeKey('Отдел организации и контроля отгрузки оптовым покупателям'), 'baggage-claim'],
  [normalizeKey('Отдел планирования'), 'calendar'],
  [normalizeKey('Отдел поставок'), 'package'],
  [normalizeKey('Отдел обеспечения производственной деятельности'), 'building'],
  [normalizeKey('Управление транспортной логистики'), 'route'],
  [normalizeKey('Отдел организации грузоперевозок'), 'navigation-2'],
  [normalizeKey('Отдел сопровождения и контроля грузоперевозок'), 'radar'],
  [normalizeKey('Отдел отгрузки'), 'shopping-basket'],
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

export function iconSlugFor(name) { const key = normalizeKey(name); return ICON_MAP.get(key) || 'building-2'; }