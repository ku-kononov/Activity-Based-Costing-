// js/pages/ibp.js

/**
 * Метаданные для страниц IBP
 */
function pageMeta(sub = 'financial') {
  const map = {
    financial: {
      title: 'Управление финансовыми операциями',
      subtitle: 'FP&A (Financial Planning & Analysis)',
      icon: 'calculator',
    },
    // Изменения внесены сюда
    operational: {
      title: 'Продажи и операционное планирование',
      subtitle: 'S&OP (Sales & Operations Planning)',
      icon: 'trending-up-down',
    },
    'plan-vs-fact': {
      title: 'Анализ плана и факта',
      subtitle: 'Integrated Reconciliation',
      icon: 'chart-column-stacked',
    },
    'management-data': {
      title: 'Данные для управленческих решений',
      subtitle: 'Management Business Review',
      icon: 'briefcase-business',
    },
  };
  return map[sub] || map['financial'];
}

/**
 * Рендерит общий заголовок страницы
 */
function renderPageHeader(meta) {
  return `
    <div class="analytics-header">
      <div class="analytics-header__title-block">
        <i data-lucide="${meta.icon}" class="analytics-header__icon" aria-hidden="true"></i>
        <div>
          <h2 class="analytics-header__title">${meta.title}</h2>
          <p class="analytics-header__subtitle">${meta.subtitle}</p>
        </div>
      </div>
    </div>`;
}

/**
 * Рендерит страницу "Продажи и операционное планирование" (S&OP)
 */
function renderOperationalPage(meta) {
  return `
    <div class="analytics-page">
      ${renderPageHeader(meta)}
      <div class="widgets-grid">
        <!-- 1.1 Планирование продаж -->
        <a href="#" onclick="event.preventDefault();" class="module-card" style="--module-color: var(--blue);">
          <div class="module-header">
            <i class="module-icon" data-lucide="trending-up"></i>
            <h3 class="module-title">Планирование продаж</h3>
          </div>
          <div class="module-body">
            <p class="module-text">Системное и оперативное планирование объемов продаж</p>
          </div>
        </a>
        <!-- 1.2 Операционные планы -->
        <a href="#" onclick="event.preventDefault();" class="module-card" style="--module-color: var(--accent);">
          <div class="module-header">
            <i class="module-icon" data-lucide="clipboard-list"></i>
            <h3 class="module-title">Операционные планы</h3>
          </div>
          <div class="module-body">
            <p class="module-text">Планирование логистических процессов и использования ресурсов</p>
          </div>
        </a>
        <!-- 1.3 Юнит-экономика -->
        <a href="#" onclick="event.preventDefault();" class="module-card" style="--module-color: var(--warning);">
          <div class="module-header">
            <i class="module-icon" data-lucide="coins"></i>
            <h3 class="module-title">Юнит-экономика</h3>
          </div>
          <div class="module-body">
            <p class="module-text">Оценка эффективности бизнеса через анализ прибыли и расходов на один юнит</p>
          </div>
        </a>
      </div>
    </div>`;
}

/**
 * Рендерит страницу "Анализ плана и факта"
 */
function renderPlanVsFactPage(meta) {
  return `
    <div class="analytics-page">
      ${renderPageHeader(meta)}
      <div class="widgets-grid">
        <!-- 2.1 Сопоставление данных -->
        <a href="#" onclick="event.preventDefault();" class="module-card" style="--module-color: var(--blue);">
          <div class="module-header">
            <i class="module-icon" data-lucide="git-compare-arrows"></i>
            <h3 class="module-title">Сопоставление данных</h3>
          </div>
          <div class="module-body">
            <p class="module-text">Сравнение плановых и фактических показателей</p>
          </div>
        </a>
        <!-- 2.2 Анализ отклонений -->
        <a href="#" onclick="event.preventDefault();" class="module-card" style="--module-color: var(--danger);">
          <div class="module-header">
            <i class="module-icon" data-lucide="bar-chart-4"></i>
            <h3 class="module-title">Анализ отклонений</h3>
          </div>
          <div class="module-body">
            <p class="module-text">Анализ отклонений с определением причин</p>
          </div>
        </a>
        <!-- 2.3 Корректировка планов -->
        <a href="#" onclick="event.preventDefault();" class="module-card" style="--module-color: var(--success);">
          <div class="module-header">
            <i class="module-icon" data-lucide="rotate-cw"></i>
            <h3 class="module-title">Корректировка планов</h3>
          </div>
          <div class="module-body">
            <p class="module-text">Сценарии коррекции планов на основе анализа фактических результатов</p>
          </div>
        </a>
      </div>
    </div>`;
}

/**
 * Рендерит страницу "Данные для управленческих решений"
 */
function renderManagementDataPage(meta) {
  return `
    <div class="analytics-page">
      ${renderPageHeader(meta)}
      <div class="widgets-grid">
        <!-- 3.1 Отчеты для АВ -->
        <a href="#" onclick="event.preventDefault();" class="module-card" style="--module-color: var(--blue);">
          <div class="module-header">
            <i class="module-icon" data-lucide="file-text"></i>
            <h3 class="module-title">Отчеты для АВ</h3>
          </div>
          <div class="module-body">
            <p class="module-text">Комплексные отчеты ДЗО</p>
          </div>
        </a>
        <!-- 3.2 Управленческие отчеты -->
        <a href="#" onclick="event.preventDefault();" class="module-card" style="--module-color: var(--accent);">
          <div class="module-header">
            <i class="module-icon" data-lucide="layout-dashboard"></i>
            <h3 class="module-title">Управленческие отчеты</h3>
          </div>
          <div class="module-body">
            <p class="module-text">Учет затрат в разрезе процессов и сегментов бизнеса</p>
          </div>
        </a>
        <!-- 3.3 Финансовая устойчивость -->
        <a href="#" onclick="event.preventDefault();" class="module-card" style="--module-color: var(--warning);">
          <div class="module-header">
            <i class="module-icon" data-lucide="shield"></i>
            <h3 class="module-title">Финансовая устойчивость</h3>
          </div>
          <div class="module-body">
            <p class="module-text">Структура ресурсов компании: активы, обязательства и капитал</p>
          </div>
        </a>
      </div>
    </div>`;
}

/**
 * Главная функция рендеринга для всех страниц IBP
 */
export async function renderIBPPage(container, subpage = 'financial') {
  const meta = pageMeta(subpage);

  switch (subpage) {
    case 'financial':
      container.innerHTML = `
        <div class="analytics-page">
          ${renderPageHeader(meta)}
          <div class="fp-grid">
            <!-- 1) Финансовая аналитика -->
            <a href="#!/analytics" onclick="navigate('analytics'); return false;"
               class="module-card fp-card fp-card--analytics" style="--module-color: var(--success);" aria-label="Финансовая аналитика">
              <div class="module-header">
                <i class="module-icon" data-lucide="line-chart"></i>
                <h3 class="module-title">Финансовая аналитика</h3>
              </div>
              <div class="module-body">
                <p class="module-text">Данные PnL. Показатели и метрики для поддержки принятия управленческих решений</p>
              </div>
            </a>
            <!-- 2) Бюджетирование -->
            <a href="#" onclick="event.preventDefault();"
               class="module-card fp-card" style="--module-color: var(--blue);" aria-label="Бюджетирование">
              <div class="module-header">
                <i class="module-icon" data-lucide="anchor"></i>
                <h3 class="module-title">Бюджетирование</h3>
              </div>
              <div class="module-body">
                <p class="module-text">Управление бюджетами компании по различным направлениям деятельности</p>
              </div>
            </a>
            <!-- 3) Финансовое планирование -->
            <a href="#" onclick="event.preventDefault();"
               class="module-card fp-card" style="--module-color: var(--warning);" aria-label="Финансовое планирование">
              <div class="module-header">
                <i class="module-icon" data-lucide="calendar"></i>
                <h3 class="module-title">Финансовое планирование</h3>
              </div>
              <div class="module-body">
                <p class="module-text">Управление, распределение и контроль денежных средств компании</p>
              </div>
            </a>
          </div>
        </div>`;
      break;
    
    case 'operational':
      container.innerHTML = renderOperationalPage(meta);
      break;
      
    case 'plan-vs-fact':
      container.innerHTML = renderPlanVsFactPage(meta);
      break;
      
    case 'management-data':
      container.innerHTML = renderManagementDataPage(meta);
      break;

    default:
      // Плейсхолдер на случай непредвиденной страницы
      container.innerHTML = `
        <div class="analytics-page">
          ${renderPageHeader(meta)}
          <div class="analytics-grid">
            <div class="analytics-chart is-placeholder">
              <div class="analytics-chart__header">
                <i data-lucide="wrench"></i>
                <div class="analytics-chart__title-block">
                  <h3 class="analytics-chart__title">Раздел в разработке</h3>
                  <div class="analytics-chart__subtitle">Контент для этой страницы скоро появится.</div>
                </div>
              </div>
            </div>
          </div>
        </div>`;
      break;
  }
}