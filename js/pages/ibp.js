// js/pages/ibp.js
function pageMeta(sub = 'financial') {
  const map = {
    financial: {
      title: 'Управление финансовыми операциями',
      subtitle: 'FP&A (Financial Planning & Analysis)',
      icon: 'calculator',
    },
    operational: {
      title: 'Операционные планы',
      subtitle: 'IBP | Операции',
      icon: 'clipboard-list',
    },
    'plan-vs-fact': {
      title: 'Анализ плана и факта',
      subtitle: 'IBP | Аналитика',
      icon: 'trending-up',
    },
    'management-data': {
      title: 'Управленческие данные',
      subtitle: 'IBP | Данные',
      icon: 'file-cog',
    },
  };
  return map[sub] || map['financial'];
}

export async function renderIBPPage(container, subpage = 'financial') {
  const meta = pageMeta(subpage);

  // Спец-верстка для "Финансовые планы"
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

  // Плейсхолдеры для прочих разделов IBP (как раньше)
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