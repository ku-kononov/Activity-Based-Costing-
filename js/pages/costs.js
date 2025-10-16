// js/pages/costs.js
export async function renderCostsPage(container) {
  container.innerHTML = `
    <div class="analytics-page">
      <div class="analytics-header">
        <div class="analytics-header__title-block">
          <i data-lucide="chart-pie" class="analytics-header__icon" aria-hidden="true"></i>
          <div>
            <h2 class="analytics-header__title">Затраты процессов</h2>
            <p class="analytics-header__subtitle">Activity Based Costing (ABC)</p>
          </div>
        </div>
      </div>

      <div class="analytics-grid analytics-grid--1-1">
        <div class="analytics-chart is-placeholder">
          <div class="analytics-chart__header">
            <i data-lucide="chart-pie"></i>
            <div class="analytics-chart__title-block">
              <h3 class="analytics-chart__title">Страница в разработке</h3>
              <div class="analytics-chart__subtitle">Здесь будут диаграммы и отчёты по затратам</div>
            </div>
          </div>
        </div>
        <div class="analytics-chart is-placeholder">
          <div class="analytics-chart__header">
            <i data-lucide="table"></i>
            <div class="analytics-chart__title-block">
              <h3 class="analytics-chart__title">Плейсхолдер</h3>
              <div class="analytics-chart__subtitle">Структура данных появится позже</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}