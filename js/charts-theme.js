// js/charts-theme.js
export function applyChartTheme(theme) {
  if (!window.Chart) return;

  const isDark = theme === 'dark';
  const textColor = isDark ? '#E7EAF0' : '#212529';
  const axisColor = isDark ? '#9AA3AF' : '#6C757D';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : '#E9ECEF';
  const borderColor = gridColor;

  window.Chart.defaults.color = textColor;
  window.Chart.defaults.borderColor = borderColor;
  window.Chart.defaults.plugins = window.Chart.defaults.plugins || {};
  window.Chart.defaults.plugins.legend = window.Chart.defaults.plugins.legend || {};
  window.Chart.defaults.plugins.legend.labels = window.Chart.defaults.plugins.legend.labels || {};
  window.Chart.defaults.plugins.legend.labels.color = textColor;
  window.Chart.defaults.plugins.title = window.Chart.defaults.plugins.title || {};
  window.Chart.defaults.plugins.title.color = textColor;
  window.Chart.defaults.font = window.Chart.defaults.font || {};
  window.Chart.defaults.font.family = getComputedStyle(document.documentElement).getPropertyValue('--font-family') || 'Inter, system-ui, sans-serif';

  const instances = window.Chart.instances;
  const list = instances
    ? (instances instanceof Map ? Array.from(instances.values()) : Array.isArray(instances) ? instances : Object.values(instances))
    : [];

  list.forEach((inst) => {
    const opts = inst.options || {};
    if (opts.scales) {
      Object.values(opts.scales).forEach((scale) => {
        scale.ticks = scale.ticks || {};
        scale.ticks.color = axisColor;
        scale.grid = scale.grid || {};
        scale.grid.color = gridColor;
        scale.grid.borderColor = borderColor;
      });
    }
    if (opts.plugins) {
      if (opts.plugins.legend && opts.plugins.legend.labels) {
        opts.plugins.legend.labels.color = textColor;
      }
      if (opts.plugins.title) {
        opts.plugins.title.color = textColor;
      }
    }
    inst.update('none');
  });
}