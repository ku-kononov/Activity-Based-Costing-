// js/pages/ibp.js

function pageMeta(sub = 'financial') {
  const map = {
    financial: {
      title: 'Управление финансовыми операциями',
      subtitle: 'FP&A (Financial Planning & Analysis)',
      icon: 'calculator',
    },
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

export async function renderIBPPage(container, subpage = 'financial') {
  const meta = pageMeta(subpage);

  // Хедер (единый стиль)
  const headerHTML = `
    <div class="analytics-header">
      <div class="analytics-header__title-block">
        <i data-lucide="${meta.icon}" class="analytics-header__icon" aria-hidden="true"></i>
        <div>
          <h2 class="analytics-header__title">${meta.title}</h2>
          <p class="analytics-header__subtitle">${meta.subtitle}</p>
        </div>
      </div>
    </div>
  `;

  // 1) Финансы — оставляем как было (ваш рабочий раздел)
  if (subpage === 'financial') {
    container.innerHTML = `
      <div class="analytics-page">
        <div class="analytics-header">
          <div class="analytics-header__title-block">
            <i data-lucide="${meta.icon}" class="analytics-header__icon" aria-hidden="true"></i>
            <div>
              <h2 class="analytics-header__title">${meta.title}</h2>
              <p class="analytics-header__subtitle">${meta.subtitle}</p>
            </div>
          </div>
        </div>

        <div class="fp-grid">
          <!-- 1) Финансовая аналитика (реализовано) -->
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
          <a href="#!/ibp/financial" onclick="navigate('ibp/financial'); return false;"
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
          <a href="#!/ibp/financial" onclick="navigate('ibp/financial'); return false;"
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
    return;
  }

  // 2) Продажи и операционное планирование (S&OP)
  if (subpage === 'operational') {
    container.innerHTML = `
      <div class="analytics-page">
        ${headerHTML}
        <div class="fp-grid">
          <!-- 1.1 Планирование продаж -->
          <a href="#!/ibp/operational" onclick="navigate('ibp/operational'); return false;"
             class="module-card" style="--module-color: var(--blue);" aria-label="Планирование продаж">
            <div class="module-header">
              <i class="module-icon" data-lucide="target"></i>
              <h3 class="module-title">Планирование продаж</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Системное и оперативное планирование объемов продаж</p>
            </div>
          </a>

          <!-- 1.2 Операционные планы -->
          <a href="#!/ibp/operational" onclick="navigate('ibp/operational'); return false;"
             class="module-card" style="--module-color: var(--accent);" aria-label="Операционные планы">
            <div class="module-header">
              <i class="module-icon" data-lucide="workflow"></i>
              <h3 class="module-title">Операционные планы</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Планирование логистических процессов и использования ресурсов</p>
            </div>
          </a>

          <!-- 1.3 Юнит-экономика -->
          <a href="#!/ibp/operational" onclick="navigate('ibp/operational'); return false;"
             class="module-card" style="--module-color: var(--success);" aria-label="Юнит-экономика">
            <div class="module-header">
              <i class="module-icon" data-lucide="calculator"></i>
              <h3 class="module-title">Юнит-экономика</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Оценка эффективности бизнеса через анализ прибыли и расходов на один юнит</p>
            </div>
          </a>
        </div>
      </div>`;
    return;
  }

  // 3) Анализ плана и факта (Integrated Reconciliation)
  if (subpage === 'plan-vs-fact') {
    container.innerHTML = `
      <div class="analytics-page">
        ${headerHTML}
        <div class="fp-grid">
          <!-- 2.1 Сопоставление данных -->
          <a href="#!/ibp/plan-vs-fact" onclick="navigate('ibp/plan-vs-fact'); return false;"
             class="module-card" style="--module-color: var(--blue);" aria-label="Сопоставление данных">
            <div class="module-header">
              <i class="module-icon" data-lucide="table"></i>
              <h3 class="module-title">Сопоставление данных</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Сравнение плановых и фактических показателей</p>
            </div>
          </a>

          <!-- 2.2 Анализ отклонений -->
          <a href="#!/ibp/plan-vs-fact" onclick="navigate('ibp/plan-vs-fact'); return false;"
             class="module-card" style="--module-color: var(--warning);" aria-label="Анализ отклонений">
            <div class="module-header">
              <i class="module-icon" data-lucide="activity"></i>
              <h3 class="module-title">Анализ отклонений</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Анализ отклонений с определением причин</p>
            </div>
          </a>

          <!-- 2.3 Корректировка планов -->
          <a href="#!/ibp/plan-vs-fact" onclick="navigate('ibp/plan-vs-fact'); return false;"
             class="module-card" style="--module-color: var(--success);" aria-label="Корректировка планов">
            <div class="module-header">
              <i class="module-icon" data-lucide="sliders"></i>
              <h3 class="module-title">Корректировка планов</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Сценарии коррекции планов на основе анализа фактических результатов</p>
            </div>
          </a>
        </div>
      </div>`;
    return;
  }

  // 4) Данные для управленческих решений (MBR)
  if (subpage === 'management-data') {
    container.innerHTML = `
      <div class="analytics-page">
        ${headerHTML}
        <div class="fp-grid">
          <!-- 3.1 Отчеты для АВ -->
          <a href="#!/ibp/management-data" onclick="navigate('ibp/management-data'); return false;"
             class="module-card" style="--module-color: var(--blue);" aria-label="Отчеты для АВ">
            <div class="module-header">
              <i class="module-icon" data-lucide="file-text"></i>
              <h3 class="module-title">Отчеты для АВ</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Комплексные отчеты ДЗО</p>
            </div>
          </a>

          <!-- 3.2 Управленческие отчеты -->
          <a href="#!/ibp/management-data" onclick="navigate('ibp/management-data'); return false;"
             class="module-card" style="--module-color: var(--accent);" aria-label="Управленческие отчеты">
            <div class="module-header">
              <i class="module-icon" data-lucide="bar-chart-3"></i>
              <h3 class="module-title">Управленческие отчеты</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Учет затрат в разрезе процессов и сегментов бизнеса</p>
            </div>
          </a>

          <!-- 3.3 Финансовая устойчивость -->
          <a href="#!/ibp/management-data" onclick="navigate('ibp/management-data'); return false;"
             class="module-card" style="--module-color: var(--success);" aria-label="Финансовая устойчивость">
            <div class="module-header">
              <i class="module-icon" data-lucide="shield-check"></i>
              <h3 class="module-title">Финансовая устойчивость</h3>
            </div>
            <div class="module-body">
              <p class="module-text">Структура ресурсов компании: активы, обязательства и капитал</p>
            </div>
          </a>
        </div>
      </div>`;
    return;
  }

  // На всякий случай — безопасный плейсхолдер
  container.innerHTML = `
    <div class="analytics-page">
      ${headerHTML}
      <div class="analytics-grid analytics-grid--2-col">
        <div class="analytics-chart is-placeholder">
          <div class="analytics-chart__header">
            <i data-lucide="${meta.icon}"></i>
            <div class="analytics-chart__title-block">
              <h3 class="analytics-chart__title">${meta.title}</h3>
              <div class="analytics-chart__subtitle">Раздел в разработке</div>
            </div>
          </div>
        </div>
        <div class="analytics-chart is-placeholder">
          <div class="analytics-chart__header">
            <i data-lucide="loader"></i>
            <div class="analytics-chart__title-block">
              <h3 class="analytics-chart__title">Плейсхолдер контента</h3>
              <div class="analytics-chart__subtitle">Схемы данных, таблицы и графики появятся позже</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}