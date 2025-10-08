// js/pages/analytics.js
import { refreshIcons } from '../utils.js';

/**
 * Рендерит базовую страницу "Аналитика" с заголовком в стиле PCF.
 * @param {HTMLElement} container - DOM-элемент, в который будет отрисована страница.
 */
export function renderAnalyticsPage(container) {
  // ИСПРАВЛЕНО: Используем точную HTML-структуру и классы из `pcf-catalog.js`
  container.innerHTML = `
    <section class="card pcf-page">
      <div class="card-header pcf-catalog-header">
        <div class="title-container pcf-title">
          <i data-lucide="bar-chart-big" class="main-icon pcf-header-icon"></i>
          <div class="pcf-title-texts">
            <h3 class="card-title">Анализ PnL</h3>
            <p class="card-subtitle">FP&A (Financial Planning & Analysis)</p>
          </div>
        </div>
        <!-- Контейнер для будущих кнопок, как на странице PCF -->
        <div id="analytics-header-actions" class="pcf-header-actions"></div>
      </div>
      
      <div class="widgets-grid" style="margin-top: 20px;">
        <p style="color: var(--muted); padding: 16px; text-align: center; grid-column: 1 / -1;">
          Страница находится в разработке. Здесь появятся виджеты и графики.
        </p>
      </div>
    </section>
  `;

  // Обязательно обновляем иконки после добавления HTML.
  refreshIcons();
}