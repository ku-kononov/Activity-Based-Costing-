// js/pages/analytics.js
import { refreshIcons } from '../utils.js';

/**
 * Рендерит базовую страницу "Аналитика" с заголовком.
 * @param {HTMLElement} container - DOM-элемент, в который будет отрисована страница.
 */
export function renderAnalyticsPage(container) {
  // 1. Создаем HTML-структуру.
  // Мы используем те же классы, что и на странице PCF, для консистентности.
  container.innerHTML = `
    <section class="card analytics-page">
      <div class="card-header analytics-page-header">
        <div class="title-container">
          <i data-lucide="bar-chart-big" class="main-icon"></i>
          <div class="title-texts">
            <h2 class="card-title">Анализ PnL</h2>
            <p class="card-subtitle">FP&A (Financial Planning & Analysis)</p>
          </div>
        </div>
      </div>
      <div class="analytics-content-grid">
        <!-- Здесь в будущем будут виджеты -->
        <p style="color: var(--text-muted); padding: 16px;">Страница находится в разработке.</p>
      </div>
    </section>
  `;

  // 2. Обязательно обновляем иконки после добавления HTML.
  refreshIcons();
}