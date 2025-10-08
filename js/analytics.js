// js/pages/analytics.js
import { refreshIcons } from '../utils.js';

export function renderAnalyticsPage(container) {
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
        <p style="color: var(--text-muted); padding: 16px;">Страница находится в разработке.</p>
      </div>
    </section>
  `;
  refreshIcons();
}