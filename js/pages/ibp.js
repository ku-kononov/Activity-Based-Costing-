// js/pages/ibp.js
function pageMeta(sub = 'financial') {
  const map = {
    'financial': { title: 'Финансовые планы', subtitle: 'IBP | Финансы', icon: 'wallet' },
    'operational': { title: 'Операционные планы', subtitle: 'IBP | Операции', icon: 'clipboard-list' },
    'plan-vs-fact': { title: 'Анализ плана и факта', subtitle: 'IBP | Аналитика', icon: 'trending-up' },
    'management-data': { title: 'Управленческие данные', subtitle: 'IBP | Данные', icon: 'file-cog' },
  };
  return map[sub] || map['financial'];
}

export async function renderIBPPage(container, subpage = 'financial') {
  const meta = pageMeta(subpage);

  container.innerHTML = `
    <div class="analytics-page">
      <div class="analytics-header">
        <div class="analytics-header__title-block">
          <i data-lucide="database" class="analytics-header__icon" aria-hidden="true"></i>
          <div>
            <h2 class="analytics-header__title">${meta.title}</h2>
            <p class="analytics-header__subtitle">${meta.subtitle}</p>
          </div>
        </div>

        <div class="analytics-header__filters">
          <div class="analytics-segmented-control" role="tablist" aria-label="Разделы IBP">
            <button class="${subpage==='financial'?'active':''}" role="tab" aria-selected="${subpage==='financial'}" onclick="navigate('ibp/financial')">Финансы</button>
            <button class="${subpage==='operational'?'active':''}" role="tab" aria-selected="${subpage==='operational'}" onclick="navigate('ibp/operational')">Операции</button>
            <button class="${subpage==='plan-vs-fact'?'active':''}" role="tab" aria-selected="${subpage==='plan-vs-fact'}" onclick="navigate('ibp/plan-vs-fact')">План/Факт</button>
            <button class="${subpage==='management-data'?'active':''}" role="tab" aria-selected="${subpage==='management-data'}" onclick="navigate('ibp/management-data')">Данные</button>
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