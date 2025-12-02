// js/pages/costs.js
import { refreshIcons } from '../utils.js';
import { fetchData } from '../api.js';

// ========== Утилиты ==========
const fmt = (val, digits = 1) =>
  new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number.isFinite(val) ? val : 0);

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const cssVar = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name)?.trim() || fallback;

// Конвертер ArrayBuffer в Base64 для встраивания шрифта в PDF
const ab2b64 = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

// ========== Встроенные стили ==========
function injectCostStyles() {
  if (document.getElementById('costs-page-styles')) return;
  const css = `
    /* Карточки-виджеты: кликабельность, рамки */
    .clickable-card {
      cursor: pointer;
      transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
      border: 2px solid var(--border);
      border-style: solid;
      background: var(--surface);
      border-radius: 12px;
    }
    .clickable-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 24px rgba(0,0,0,.12);
      border-color: var(--blue);
      border-style: solid;
    }

    /* Заголовки карточек (единый вид) */
    .analytics-chart__header { display:flex; align-items: center; gap: 12px; padding: 10px 8px 0; }
    .analytics-chart__header i[data-lucide] { width: 24px; height: 24px; }
    .analytics-chart__title-block { display:flex; flex-direction: column; gap: 2px; }
    .analytics-chart__title { font-size: 18px; font-weight: 700; }
    .analytics-header__subtitle { color: var(--muted); font-size: 13px; margin: 0; }

    /* === FTE виджет: показатели + унифицированная шапка === */
    .fte-widget .analytics-chart__header i { width: 24px; height: 24px; }
    .fte-widget .analytics-chart__title { font-size: 18px; }
    .fte-widget-body { padding: 12px 8px 16px; }
    .fte-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; width: 100%; }
    .fte-summary-item { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 14px; border-top: 4px solid var(--item-color); background: var(--bg); border-radius: 10px; }
    .fte-summary-value { font-size: 26px; font-weight: 800; color: var(--item-color); line-height: 1.1; font-variant-numeric: tabular-nums; }
    .fte-summary-label { font-size: 13px; font-weight: 600; color: var(--item-color); margin-top: 6px; }

    /* === Общая модалка === */
    .metric-modal-overlay { position: fixed; inset: 0; z-index: 1050; background: rgba(17,24,39,0.65); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity .2s ease; }
    .metric-modal-overlay.is-open { opacity: 1; pointer-events: auto; }
    .metric-modal { background: var(--surface); border-radius: 16px; width: min(96vw, 1100px); max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 18px 48px rgba(0,0,0,.28); overflow: hidden; }
    .metric-modal__header { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--border); }
    .metric-modal__header i[data-lucide] { width: 22px; height: 22px; }
    .metric-modal__title { font-size: 18px; font-weight: 800; }
    .metric-modal__subtitle { margin-left: auto; color: var(--muted); font-weight: 600; }
    .metric-modal__body { padding: 16px 18px; overflow: auto; color: var(--text); line-height: 1.55; }
    .metric-modal__body p { margin: 0 0 8px; }
    .metric-modal__footer { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--border); }
    .metric-close { width: 36px; height: 36px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; border:1px solid var(--border); background: var(--bg); color: var(--muted); }
    .metric-close:hover { background: var(--blue); color:#fff; border-color: transparent; transform: rotate(90deg); }
    .metric-card__body { padding: 10px 8px 12px; color: var(--muted); font-size: 13px; }
    .metric-modal__header .title--blue, .metric-modal__header .title--blue + i[data-lucide] { color: var(--blue); }


    /* Таблица внутри модалок (универсальная) */
    .metric-table { width:100%; border-collapse: collapse; }
    .metric-table th, .metric-table td { padding: 8px 10px; border-bottom: 1px solid var(--border); text-align: left; }
    .metric-table th { color: var(--muted); font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: .3px; }
    .mono { font-variant-numeric: tabular-nums; }
    .chip { display:inline-block; padding: 2px 6px; border-radius: 6px; color:#fff; font-size:12px; font-weight:700; }

    /* === Расширение для FTE-модалки (доп. элементы) === */
    .metric-modal__actions { display:flex; align-items:center; gap:8px; margin-left: 12px; }
    .metric-icon-btn { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--border); background: var(--bg); color: var(--muted); display: inline-flex; align-items:center; justify-content:center; cursor: pointer; transition: all .15s; }
    .metric-icon-btn:hover { background: var(--blue); color:#fff; border-color: transparent; }

    .fte-top { display:flex; flex-direction: column; gap: 10px; }
    .fte-desc { font-size: 14px; color: var(--text); }
    .fte-controls { display:flex; align-items:center; gap:12px; justify-content: space-between; flex-wrap: wrap; }
    .fte-left { display:flex; align-items:center; gap:12px; }
    .fte-label { font-weight: 700; font-size: 13px; color: var(--text); }
    .segmented { display:flex; background: var(--bg); padding:4px; border:1px solid var(--border); border-radius: 10px; }
    .segmented button { padding:8px 14px; border:none; background:transparent; border-radius:8px; color:var(--muted); font-weight:600; cursor:pointer; transition: all .15s; }
    .segmented button.active { background: var(--surface); color: var(--blue); box-shadow: var(--shadow-sm); }

    .tip-wrap { position: relative; }
    .tip-bubble { position: absolute; top: calc(100% + 10px); right: 0; width: 820px; max-width: 92vw; background:#262D38; color:#fff; padding: 16px 18px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.3); font-size: 14px; line-height: 1.7; white-space: pre-line; opacity: 0; visibility: hidden; transition: all .15s; z-index: 3; }
    .tip-bubble.is-visible { opacity: 1; visibility: visible; }
    .tip-bubble:after { content:''; position:absolute; bottom:100%; right:16px; border:8px solid transparent; border-bottom-color:#262D38; }

    .fte-content { border:1px solid var(--border); border-radius: 12px; background: var(--bg); min-height: 380px; padding: 12px; overflow:auto; }

    .tree-controls { display:flex; gap:8px; }
    .tree-btn { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:8px; border:1px solid transparent; background:transparent; color: var(--muted); font-weight:600; cursor:pointer; transition: all .15s; }
    .tree-btn:hover { color: var(--blue); background: var(--bg); }
    .tree-btn i { width: 16px; height: 16px; }

    .dept-hierarchy { display:block; }
    .dept-node > summary { list-style: none; display:grid; grid-template-columns: minmax(0,1fr) 140px; gap:16px; align-items:center; padding:10px; cursor:pointer; border-radius:8px; }
    .dept-node > summary::-webkit-details-marker { display:none; }
    .dept-node > summary:hover { background: var(--bg); }
    .dept-title-group { display:flex; align-items:center; gap: 8px; }
    .dept-chevron { transition: transform .2s; color: var(--muted); }
    .dept-node[open] .dept-chevron { transform: rotate(90deg); color: var(--blue); }
    .dept-title { font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: calc(var(--level,0)*24px); }
    .dept-fte { font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
    .dept-content { padding: 0 12px 8px calc(24px + var(--level,0)*24px); }
    .dept-process-list { list-style: none; margin: 6px 0 0; padding: 0; display:grid; gap:8px; }
    .dept-process-item { display:grid; grid-template-columns: 100px 1fr auto; align-items:center; gap:12px; padding:6px 8px; border:1px solid var(--border); border-radius:8px; background: var(--surface); }
    .proc-chip { padding: 2px 6px; border-radius: 6px; color:#fff; font-size:12px; font-weight:700; text-align:center; }
    .proc-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .proc-fte { font-weight:700; font-variant-numeric: tabular-nums; }

    /* === VA widget (мини‑показатели и модалка) === */
    .va-mini { padding: 12px 8px 16px; }
    .va-mini-cards { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:16px; }
    .va-mini-item {
      background: var(--bg);
      border:1px solid var(--border);
      border-radius: 10px;
      padding: 14px;
      display:flex; flex-direction:column; gap:6px; align-items:center; text-align:center;
      border-top: 4px solid var(--item-color);
    }
    .va-mini-value { font-size: 24px; font-weight: 800; color: var(--blue); line-height:1.1; font-variant-numeric: tabular-nums; }
    .va-mini-label { font-size: 13px; font-weight: 600; color: var(--blue); }

    /* VA modal layout */
    .va-modal-grid { display:grid; grid-template-columns: 1fr 1fr; gap:18px; align-items:stretch; }
    .va-legend-below { display:flex; align-items:center; gap:12px; justify-content:center; margin-top:8px; color: var(--muted); font-size: 13px; }
    .va-dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
    .va-explainer, .va-chart-container {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
      padding: 16px;
      display: flex;
      flex-direction: column;
    }
    .va-explainer { font-size: 13.5px; line-height: 1.6; }
    .va-chart-container { align-items: center; justify-content: center; }

    /* === Tabs for RPSC modal === */
    .tabs { display: flex; flex-direction: column; }
    .tab-buttons { display: flex; border-bottom: 1px solid var(--border); }
    .tab-button { padding: 12px 16px; border: none; background: transparent; color: var(--muted); font-weight: 600; cursor: pointer; transition: all .15s; border-bottom: 2px solid transparent; }
    .tab-button.active { color: var(--blue); border-bottom-color: var(--blue); }
    .tab-content { padding: 16px; }
    .tab-pane { display: none; }
    .tab-pane.active { display: block; }

    /* RPSC specific */
    .rpsc-widget-body, .spcr-widget-body, .rpse-widget-body { padding: 12px 8px 16px; }
    .rpsc-summary, .spcr-summary, .rpse-summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; width: 100%; }
    .rpsc-summary-item, .spcr-summary-item, .rpse-summary-item { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 14px; border-top: 4px solid var(--blue); background: var(--bg); border-radius: 10px; }
    .rpsc-summary-value, .spcr-summary-value, .rpse-summary-value { font-size: 24px; font-weight: 800; color: var(--blue); line-height: 1.1; font-variant-numeric: tabular-nums; }
    .rpsc-summary-label, .spcr-summary-label { font-size: 13px; font-weight: 600; color: var(--blue); margin-top: 6px; }
    .rpse-summary-label { font-size: 13px; font-weight: 600; color: var(--blue); margin-top: 6px; }

    .rpsc-modules { display: flex; flex-direction: column; gap: 20px; }
    .rpsc-module { border: 1px solid var(--border); border-radius: 12px; background: var(--surface); padding: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .rpsc-module h4 { margin: 0 0 12px; font-size: 16px; font-weight: 700; color: var(--text); }
    .rpsc-period, .costs-period-selector { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-weight: 600; }
    .rpsc-period label, .costs-period-selector label { color: var(--blue); }
    .costs-period-selector { margin-bottom: 0; margin-left: auto; }
    .rpsc-period select, .costs-period-selector select { padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); font-size: 14px; }
    .mono { font-variant-numeric: tabular-nums; }
  `;
  const styleEl = document.createElement('style');
  styleEl.id = 'costs-page-styles';
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}

// ========== Логика данных ==========
const getMajorAny = (c) => parseInt(String(c || '').split('.')[0], 10) || 0;
const groupKey = (major) =>
  [1, 13].includes(major) ? 'management' : [2, 3, 4, 5, 6].includes(major) ? 'core' : 'enablement';
const groupColors = { core: '#60a5fa', enablement: '#34d399', management: '#fbbf24' };
let chartInstance = null;

async function prepareFTEData() {
  const [costData, pcfData, orgData] = await Promise.all([
    fetchData('BOLT_Cost Driver_pcf+orgchat', '*'),
    fetchData('BOLT_pcf', '"Process ID", "Process Name", "PCF Code"'),
    fetchData('BOLT_orgchat', '"Department ID", "Department Name", "Parent Department ID"'),
  ]);

  // Все процессы из PCF
  const processFTE = {};
  pcfData.forEach((p) => {
    const major = getMajorAny(p['PCF Code']);
    processFTE[p['Process ID']] = {
      code: p['PCF Code'],
      label: `${p['PCF Code'] || ''} ${p['Process Name']}`,
      group: groupKey(major),
      color: groupColors[groupKey(major)],
      fte: 0,
    };
  });

  // Сумма FTE по процессу из всех ORG-* колонок
  costData.forEach((row) => {
    const p = processFTE[row['Process ID']];
    if (!p) return;
    let total = 0;
    Object.keys(row).forEach((k) => {
      if (k.startsWith('ORG-')) {
        const v = Number(String(row[k] || '0').replace(',', '.'));
        if (Number.isFinite(v) && v >= 0) total += v;
      }
    });
    if (Number.isFinite(total) && total >= 0) p.fte += total;
  });

  // Дерево подразделений
  const departments = {};
  orgData.forEach((d) => {
    departments[d['Department ID']] = {
      id: d['Department ID'],
      name: d['Department Name'],
      parentId: d['Parent Department ID'] || null,
      directFte: 0,
      totalFte: 0,
      processes: [],
      children: [],
    };
  });

  costData.forEach((row) => {
    const proc = processFTE[row['Process ID']];
    if (!proc) return;
    Object.keys(row).forEach((k) => {
      if (!k.startsWith('ORG-')) return;
      const dept = departments[k];
      if (!dept) return;
      const v = Number(String(row[k] || '0').replace(',', '.'));
      if (Number.isFinite(v) && v > 0) {
        dept.directFte += v;
        const found = dept.processes.find((x) => x.code === proc.code);
        if (found) found.fte += v;
        else dept.processes.push({ code: proc.code, label: proc.label, color: proc.color, fte: v });
      }
    });
  });

  // Иерархия
  const roots = [];
  Object.values(departments).forEach((d) => {
    if (d.parentId && departments[d.parentId]) departments[d.parentId].children.push(d);
    else roots.push(d);
  });

  const calcTotals = (d) => {
    d.totalFte = d.directFte + d.children.reduce((s, c) => s + calcTotals(c), 0);
    return d.totalFte;
  };
  roots.forEach(calcTotals);

  return { processFTE, departments, roots };
}

// ========== PDF Экспорт с кириллицей ==========
let PDF_FONT_DATA = { b64: null };
async function ensurePdfFont() {
  if (PDF_FONT_DATA.b64) return;
  try {
    const url = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf';
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Font load failed');
    const buf = await resp.arrayBuffer();
    PDF_FONT_DATA.b64 = ab2b64(buf);
  } catch (e) {
    console.error('Failed to load PDF font:', e);
  }
}

async function exportToPdf(data, dimension) {
  await ensurePdfFont();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: dimension === 'process' ? 'p' : 'l',
    unit: 'pt',
    format: 'a4',
  });

  if (PDF_FONT_DATA.b64) {
    doc.addFileToVFS('Roboto-Regular.ttf', PDF_FONT_DATA.b64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.setFont('Roboto');
  }

  const title = `Анализ трудозатрат (FTE) в разрезе ${dimension === 'process' ? 'процессов' : 'подразделений'}`;
  doc.setFontSize(16);
  doc.text(title, doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text(`Дата выгрузки: ${new Date().toLocaleString('ru-RU')}`, doc.internal.pageSize.getWidth() / 2, 55, {
    align: 'center',
  });
  doc.setTextColor(0);

  if (dimension === 'process' && chartInstance) {
    const imgData = chartInstance.toBase64Image('image/png', 1.0);
    const pdfWidth = doc.internal.pageSize.getWidth() - 80;
    const pdfHeight = (chartInstance.height * pdfWidth) / chartInstance.width;
    doc.addImage(imgData, 'PNG', 40, 70, pdfWidth, pdfHeight);
  } else {
    const tableData = [];
    const flatten = (arr, lvl = 0) => {
      arr.sort((a, b) => b.totalFte - a.totalFte).forEach((d) => {
        tableData.push([`${' '.repeat(lvl * 3)}${d.name}`, fmt(d.totalFte, 2)]);
        if (d.children.length) flatten(d.children, lvl + 1);
      });
    };
    flatten(data.roots);

    doc.autoTable({
      head: [['Подразделение', 'Суммарный FTE']],
      body: tableData,
      startY: 70,
      theme: 'grid',
      styles: { font: 'Roboto', fontSize: 10 },
      headStyles: { fillColor: [52, 73, 94], textColor: 255, fontStyle: 'bold' },
    });
  }

  doc.save(`FTE_analysis_${dimension}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ========== Хелперы модалки FTE ==========
function buildProcessChartData(processFTE) {
  const arr = Object.values(processFTE).sort((a, b) => b.fte - a.fte);
  const labels = arr.map((p) => (p.label.length > 90 ? p.label.slice(0, 87) + '…' : p.label));
  const data = arr.map((p) => p.fte);
  const colors = arr.map((p) => p.color);
  const height = clamp(arr.length * 32 + 100, 420, 10000);
  return { labels, data, colors, height };
}

function buildDeptHierarchyHTML(roots) {
  const renderNode = (d, level = 0) => {
    const sortedChildren = [...d.children].sort((a, b) => b.totalFte - a.totalFte);
    const sortedProcs = [...d.processes].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    const hasContent = sortedChildren.length > 0 || sortedProcs.length > 0;
    return `
      <details class="dept-node" style="--level:${level}" ${level < 1 ? 'open' : ''}>
        <summary>
          <div class="dept-title-group">
            ${hasContent ? '<i data-lucide="chevron-right" class="dept-chevron"></i>' : '<span style="width:16px"></span>'}
            <span class="dept-title">${d.name}</span>
          </div>
          <div class="dept-fte">${fmt(d.totalFte, 2)} FTE</div>
        </summary>
        ${hasContent ? `
          <div class="dept-content">
            ${sortedProcs.length ? `
              <ul class="dept-process-list">
                ${sortedProcs.map(p => `
                  <li class="dept-process-item">
                    <span class="proc-chip" style="background:${p.color}">${p.code}</span>
                    <span class="proc-name" title="${p.label}">${p.label.replace(p.code, '').trim()}</span>
                    <span class="proc-fte">${fmt(p.fte, 2)} FTE</span>
                  </li>`).join('')}
              </ul>` : ''}
            ${sortedChildren.map(ch => renderNode(ch, level + 1)).join('')}
          </div>` : ''}
      </details>
    `;
  };
  return `<div class="dept-hierarchy">${[...roots].sort((a, b) => b.totalFte - a.totalFte).map(r => renderNode(r, 0)).join('')}</div>`;
}

// ========== Расширенная FTE-модалка ==========
async function showFteModal() {
  const id = 'fte-modal-overlay';
  document.getElementById(id)?.remove();

  const tpl = `
    <div class="metric-modal-overlay" id="${id}">
      <div class="metric-modal">
        <div class="metric-modal__header">
          <i data-lucide="pencil-ruler" class="title--blue"></i>
          <div class="metric-modal__title title--blue">FTE (Full-Time Equivalent)</div>
          <div class="metric-modal__subtitle">Трудозатраты по процессам</div>
          <div class="metric-modal__actions">
            <div class="tip-wrap">
              <button class="metric-icon-btn" id="fteTipBtn" aria-label="Подсказка"><i data-lucide="help-circle"></i></button>
              <div class="tip-bubble" id="fteTip">
FTE (Full-Time Equivalent﻿) — это показатель, обозначающий эквивалент полной занятости одного сотрудника.
Он используется для оценки суммарной рабочей нагрузки, учитывая как сотрудников с полной занятостью, 
так и тех, кто работает неполный рабочий день или по гибкому графику. 
Например, два сотрудника, каждый из которых работает по половине ставки, вместе составляют 1 FTE.

Применение FTE:
• Помогает организациям точно планировать потребности в персонале и управлять трудозатратами.
• Используется для составления бюджетов, прогнозирования и оценки эффективности работы команды.
• Обеспечивает стандартизацию трудозатрат при анализе и сравнении подразделений или проектов.
• Важно для оптимизации распределения ресурсов и оценки производительности.
              </div>
            </div>
            <button class="metric-icon-btn" id="fteExportBtn" aria-label="Экспорт в PDF"><i data-lucide="download"></i></button>
            <button class="metric-close" id="fteClose" aria-label="Закрыть"><i data-lucide="x"></i></button>
          </div>
        </div>
        <div class="metric-modal__body">
          <div class="rpsc-period">
            <label>Период:</label>
            <select id="ftePeriodSelect">
              <option value="H1_2025">H1 2025</option>
            </select>
          </div>
          <div class="fte-top">
            <p class="fte-desc">FTE — это эквивалент полной занятости, показывающий, сколько человеко‑часов тратится на выполнение бизнес‑процесса или работу подразделения.</p>
            <div class="fte-controls">
              <div class="fte-left">
                <span class="fte-label">Показать в разрезе:</span>
                <div class="segmented" id="fteSegmented">
                  <button class="active" data-value="process">Процессы</button>
                  <button data-value="department">Подразделения</button>
                </div>
              </div>
              <div class="tree-controls" id="treeControls" style="display:none;">
                <button class="tree-btn" id="treeExpand"><i data-lucide="chevrons-down-up"></i>Развернуть все</button>
                <button class="tree-btn" id="treeCollapse"><i data-lucide="chevrons-up-down"></i>Свернуть все</button>
              </div>
            </div>
          </div>
          <div class="fte-content" id="fteContent"></div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', tpl);
  refreshIcons();

  const overlay = document.getElementById(id);
  const btnClose = document.getElementById('fteClose');
  const btnTip = document.getElementById('fteTipBtn');
  const tip = document.getElementById('fteTip');
  const btnExport = document.getElementById('fteExportBtn');
  const segmented = document.getElementById('fteSegmented');
  const content = document.getElementById('fteContent');
  const treeControls = document.getElementById('treeControls');

  function open() { setTimeout(() => overlay.classList.add('is-open'), 10); }
  function close() { overlay.classList.remove('is-open'); setTimeout(() => overlay.remove(), 180); }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  btnClose.addEventListener('click', close);
  btnTip.addEventListener('click', (e) => { e.stopPropagation(); tip.classList.toggle('is-visible'); });
  document.addEventListener('click', (e) => {
    if (tip && !btnTip.contains(e.target) && !tip.contains(e.target)) tip.classList.remove('is-visible');
  }, false);

  const data = await prepareFTEData();

  async function draw() {
    const mode = segmented.querySelector('button.active')?.dataset.value || 'process';
    content.innerHTML = '';
    if (chartInstance) { try { chartInstance.destroy(); } catch (_) {} chartInstance = null; }

    if (mode === 'process') {
      treeControls.style.display = 'none';
      const { labels, data: vals, colors, height } = buildProcessChartData(data.processFTE);

      if (window.Chart) {
        const canvas = document.createElement('canvas');
        canvas.id = 'fteChart';
        canvas.style.height = `${height}px`;
        content.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        chartInstance = new Chart(ctx, {
          type: 'bar',
          data: { labels, datasets: [{ label: 'FTE', data: vals, backgroundColor: colors, borderColor: colors, borderWidth: 1 }] },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (c) => ` ${fmt(c.raw, 2)} FTE` } },
            },
            layout: { padding: { left: 8, right: 12, top: 8, bottom: 8 } },
            scales: {
              x: { title: { display: true, text: 'FTE' }, grid: { color: 'rgba(128,128,128,0.2)' } },
              y: { ticks: { autoSkip: false, font: { size: 12 } }, grid: { display: false } },
            },
          },
        });
      } else {
        const rows = labels.map((l, i) => `<tr><td>${l}</td><td class="mono">${fmt(vals[i], 2)}</td></tr>`).join('');
        content.innerHTML = `<table class="metric-table"><thead><tr><th>Процесс</th><th>FTE</th></tr></thead><tbody>${rows}</tbody></table>`;
      }
    } else {
      treeControls.style.display = 'flex';
      content.innerHTML = buildDeptHierarchyHTML(data.roots);
      refreshIcons();
      const host = content;
      document.getElementById('treeExpand')?.addEventListener('click', () => host.querySelectorAll('.dept-node').forEach((d) => (d.open = true)));
      document.getElementById('treeCollapse')?.addEventListener('click', () => host.querySelectorAll('.dept-node').forEach((d) => (d.open = false)));
    }
  }

  segmented.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.classList.contains('active')) return;
    segmented.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    draw();
  });

  btnExport.addEventListener('click', async () => {
    const mode = segmented.querySelector('button.active')?.dataset.value || 'process';
    await exportToPdf(data, mode);
  });

  open();
  draw();
}

// ========== Рендеринг FTE-виджета (показатели + клик => модалка) ==========
async function createFteWidget(mountEl) {
  const el = mountEl || document.getElementById('card-fte');
  if (!el) return;

  el.classList.add('clickable-card', 'fte-widget');
  el.innerHTML = `
    <div class="analytics-chart__header">
      <i data-lucide="pencil-ruler"></i>
      <div class="analytics-chart__title-block">
        <h3 class="analytics-chart__title">Мера включённости в процессы</h3>
        <p class="analytics-header__subtitle">FTE (Full-Time Equivalent)</p>
      </div>
    </div>
    <div class="fte-widget-body">
      <div class="fte-summary" id="fteSummary">Загрузка...</div>
    </div>
  `;
  refreshIcons();

  try {
    const { processFTE } = await prepareFTEData();
    const totals = Object.values(processFTE).reduce(
      (acc, p) => {
        const fte = Number.isFinite(p.fte) && p.fte >= 0 ? p.fte : 0;
        acc[p.group] = (acc[p.group] || 0) + fte;
        return acc;
      },
      { core: 0, management: 0, enablement: 0 }
    );
    const box = (label, v, color) => `
      <div class="fte-summary-item" style="--item-color:${color}">
        <div class="fte-summary-value">${fmt(v, 1)} FTE</div>
        <div class="fte-summary-label">${label}</div>
      </div>`;
    document.getElementById('fteSummary').innerHTML = `
      ${box('Основные', totals.core, groupColors.core)}
      ${box('Управление', totals.management, groupColors.management)}
      ${box('Обеспечение', totals.enablement, groupColors.enablement)}
    `;
  } catch (e) {
    const box = document.getElementById('fteSummary');
    if (box) box.innerHTML = `<span style="color:var(--muted)">Ошибка загрузки данных</span>`;
  }

  el.addEventListener('click', showFteModal);
}

/* ========== VA vs NVA: подготовка, виджет, модалка (современный UI/UX) ========== */
const normVaFlag = (v) => {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return 'UNK';
  if (s.startsWith('va') || s.includes('value-added')) return 'VA';
  if (s.startsWith('nva') || s.includes('non-value')) return 'NVA';
  if (s.includes('value') && !s.includes('non')) return 'VA';
  return 'UNK';
};

async function prepareVaBreakdown() {
  const [pcfData, costData] = await Promise.all([
    fetchData('BOLT_pcf', '"Process ID", "Process Name", "PCF Code", "VA/NVA"'),
    fetchData('BOLT_Cost Driver_pcf+orgchat', '*'),
  ]);

  const classById = new Map();
  const labelById = new Map();
  const codeById = new Map();
  pcfData.forEach((p) => {
    classById.set(p['Process ID'], normVaFlag(p['VA/NVA']));
    labelById.set(p['Process ID'], p['Process Name'] || '');
    codeById.set(p['Process ID'], p['PCF Code'] || '');
  });

  const agg = { VA: 0, NVA: 0, UNK: 0 };
  const topVA = new Map();
  const topNVA = new Map();

  costData.forEach((row) => {
    const pid = row['Process ID'];
    const clazz = classById.get(pid) || 'UNK';
    let fte = 0;
    Object.keys(row).forEach((k) => {
      if (k.startsWith('ORG-')) {
        const v = Number(String(row[k] || '0').replace(',', '.'));
        if (Number.isFinite(v) && v > 0) fte += v;
      }
    });
    if (fte <= 0) return;
    agg[clazz] = (agg[clazz] || 0) + fte;

    const rec = { code: codeById.get(pid) || '', label: labelById.get(pid) || '', fte };
    if (clazz === 'VA') topVA.set(pid, { ...rec, fte: (topVA.get(pid)?.fte || 0) + fte });
    else if (clazz === 'NVA') topNVA.set(pid, { ...rec, fte: (topNVA.get(pid)?.fte || 0) + fte });
  });

  const topVaArr = [...topVA.values()].sort((a, b) => b.fte - a.fte).slice(0, 10);
  const topNvaArr = [...topNVA.values()].sort((a, b) => b.fte - a.fte).slice(0, 10);

  return {
    totals: { va: agg.VA || 0, nva: agg.NVA || 0, unk: agg.UNK || 0 },
    topVa: topVaArr,
    topNva: topNvaArr,
  };
}

async function createVaWidget(mountEl) {
  const el = mountEl || document.getElementById('card-va');
  if (!el) return;

  el.classList.add('clickable-card', 'va-widget');
  el.innerHTML = `
    <div class="analytics-chart__header">
      <i data-lucide="pie-chart" class="title--blue"></i>
      <div class="analytics-chart__title-block">
        <h3 class="analytics-chart__title">Доля процессов с добавленной стоимостью</h3>
        <p class="analytics-header__subtitle">Value‑Added vs. Non‑Value‑Added</p>
      </div>
    </div>
    <div class="va-mini">
      <div class="va-mini-cards" id="vaMiniCards">Загрузка...</div>
    </div>
  `;
  refreshIcons();

  try {
    const res = await prepareVaBreakdown();
    const { va, nva, unk } = res.totals;
    // Исключаем UNK из расчета процентов, так как это неопределенные процессы
    const total = (va || 0) + (nva || 0);
    const totalWithUnk = total + (unk || 0);
    const pct = (v) => total > 0 ? `${fmt((v / total) * 100, 1)}%` : '0.0%';

    const box = (label, v) => `
      <div class="va-mini-item" style="--item-color: var(--blue)">
        <div class="va-mini-value">${fmt(v, 1)} FTE</div>
        <div class="va-mini-label">${label} • ${pct(v)}</div>
      </div>`;

    document.getElementById('vaMiniCards').innerHTML = `
      ${box('Value‑Added (VA)', va)}
      ${box('Non‑Value‑Added (NVA)', nva)}
    `;

    el.addEventListener('click', () => showVaModal(res));
  } catch (e) {
    const box = document.getElementById('vaMiniCards');
    if (box) box.innerHTML = `<span style="color:var(--muted)">Ошибка загрузки данных</span>`;
  }
}

function showVaModal(prepared) {
  const id = 'va-modal-overlay';
  document.getElementById(id)?.remove();

  const tpl = `
    <div class="metric-modal-overlay" id="${id}">
      <div class="metric-modal" style="width: min(96vw, 980px);">
        <div class="metric-modal__header">
          <i data-lucide="pie-chart" class="title--blue"></i>
          <div class="metric-modal__title title--blue">Доля процессов с добавленной стоимостью</div>
          <div class="metric-modal__subtitle">VA vs NVA (по FTE)</div>
          <div class="metric-modal__actions">
            <button class="metric-close" id="vaClose" aria-label="Закрыть"><i data-lucide="x"></i></button>
          </div>
        </div>
        <div class="metric-modal__body">
          <div class="rpsc-period">
            <label>Период:</label>
            <select id="vaPeriodSelect">
              <option value="H1_2025">H1 2025</option>
            </select>
          </div>
          <div class="va-modal-grid">
            <div class="va-chart-container">
              <canvas id="vaDonut" style="max-height: 280px;"></canvas>
              <div class="va-legend-below">
                <span><span class="va-dot" style="background: ${cssVar('--blue', '#4A89F3')}"></span> Value‑Added (VA)</span>
                <span><span class="va-dot" style="background:#4B5563"></span> Non‑Value‑Added (NVA)</span>
              </div>
            </div>
            <div class="va-explainer">
              <p><strong>Value‑Added (VA)</strong> и <strong>Non‑Value‑Added (NVA)</strong> — ключевые понятия в бережливом производстве и процессном управлении:</p>
              <ul style="margin:0 0 0 18px; padding:0;">
                <li><strong>Value‑Added (VA)</strong> — деятельность, которая напрямую увеличивает ценность продукта или услуги с точки зрения конечного потребителя. Такие операции меняют или улучшают продукт, за них клиент готов платить</li>
                <li style="margin-top:8px;"><strong>Non‑Value‑Added (NVA)</strong> — деятельность, которая не добавляет ценности клиенту и рассматривается или как необходимая для поддержания процессов, или как прямые потери. Задача — оптимизировать процессы: сосредоточиться на VA и эффективно управлять NVA</li>
              </ul>
            </div>
          </div>

          <div style="margin-top:16px; display:grid; grid-template-columns: 1fr 1fr; gap:14px;">
            <div>
              <p style="font-weight:700;margin:0 0 6px;color:${cssVar('--blue', '#4A89F3')}">Top‑10 Value‑Added</p>
              <div class="metric-table-wrap" style="background: var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden;">
                <table class="metric-table">
                  <thead><tr><th>Код</th><th>Процесс</th><th>FTE</th></tr></thead>
                  <tbody id="vaTopVa"></tbody>
                </table>
              </div>
            </div>
            <div>
              <p style="font-weight:700;margin:0 0 6px;color:#4B5563;">Top‑10 Non‑Value‑Added</p>
              <div class="metric-table-wrap" style="background: var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden;">
                <table class="metric-table">
                  <thead><tr><th>Код</th><th>Процесс</th><th>FTE</th></tr></thead>
                  <tbody id="vaTopNva"></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', tpl);
  refreshIcons();

  const overlay = document.getElementById(id);
  document.getElementById('vaClose').addEventListener('click', () => {
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 180);
  });
  setTimeout(() => overlay.classList.add('is-open'), 10);

  const { totals, topVa, topNva } = prepared;
  const va = totals.va || 0, nva = totals.nva || 0;
  const blue = cssVar('--blue', '#4A89F3');

  const canvas = document.getElementById('vaDonut');
  if (window.Chart && canvas) {
    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Value‑Added', 'Non‑Value‑Added'],
        datasets: [{ data: [va, nva], backgroundColor: [blue, '#4B5563'], borderWidth: 1 }]
      },
      options: {
        cutout: '58%',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${fmt(c.raw, 2)} FTE` } } },
        responsive: true,
        maintainAspectRatio: false
      }
    });
  } else if (canvas) {
    canvas.parentElement.innerHTML = `<table class="metric-table"><thead><tr><th>Категория</th><th>FTE</th></tr></thead><tbody><tr><td>Value‑Added</td><td class="mono">${fmt(va, 2)}</td></tr><tr><td>Non‑Value‑Added</td><td class="mono">${fmt(nva, 2)}</td></tr></tbody></table>`;
  }

  const toRows = (arr, color) => arr.map(p => `<tr><td><span class="chip" style="background:${color}">${p.code || '-'}</span></td><td title="${p.label || ''}">${p.label || '-'}</td><td class="mono">${fmt(p.fte, 2)}</td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--muted);">Нет данных</td></tr>';
  document.getElementById('vaTopVa').innerHTML = toRows(topVa, blue);
  document.getElementById('vaTopNva').innerHTML = toRows(topNva, '#4B5563');
}

// ========== RPSC Widget ==========
async function createRpscWidget(mountEl) {
  const el = mountEl || document.getElementById('card-rpsc');
  if (!el) return;

  el.classList.add('clickable-card', 'rpsc-widget');
  el.innerHTML = `
    <div class="analytics-chart__header">
      <i data-lucide="trending-up"></i>
      <div class="analytics-chart__title-block">
        <h3 class="analytics-chart__title">Эффективность процессов продаж</h3>
        <p class="analytics-header__subtitle">Revenue per Sales Cost (RPSC)</p>
      </div>
    </div>
    <div class="rpsc-widget-body">
      <div class="rpsc-summary" id="rpscSummary">Загрузка...</div>
    </div>
  `;
  refreshIcons();

  try {
    const data = await fetchData('BOLT_SPCR_H1_2025', '*');
    const frontOffice = data.filter(row => (row.sales || '').toLowerCase().includes('front') || (row.segment || '').toLowerCase().includes('front'));
    const backOffice = data.filter(row => (row.sales || '').toLowerCase().includes('back') || (row.segment || '').toLowerCase().includes('back'));

    const calcTotalRpsc = (rows) => {
      let totalRev = 0, totalCost = 0;
      rows.forEach(row => {
        totalRev += Number(row.REVENUE_H1_2025 || 0);
        totalCost += Number(row.Costs || 0);
      });
      return totalCost > 0 ? totalRev / totalCost : 0;
    };

    const frontRpsc = calcTotalRpsc(frontOffice);
    const backRpsc = calcTotalRpsc(backOffice);

    const box = (label, v) => `
      <div class="rpsc-summary-item">
        <div class="rpsc-summary-value">${fmt(v, 2)}</div>
        <div class="rpsc-summary-label">${label}</div>
      </div>`;

    document.getElementById('rpscSummary').innerHTML = `
      ${box('Фронт-офис', frontRpsc)}
      ${box('Бэк-офис', backRpsc)}
    `;
  } catch (e) {
    const box = document.getElementById('rpscSummary');
    if (box) box.innerHTML = `<span style="color:var(--muted)">Ошибка загрузки данных</span>`;
  }

  el.addEventListener('click', () => showRpscModal());
}

// ========== SPCR Widget ==========
async function createSpcrWidget(mountEl) {
  const el = mountEl || document.getElementById('card-spcr');
  if (!el) return;

  el.classList.add('clickable-card', 'spcr-widget');
  el.innerHTML = `
    <div class="analytics-chart__header">
      <i data-lucide="percent"></i>
      <div class="analytics-chart__title-block">
        <h3 class="analytics-chart__title">Доля затрат процессов продаж в выручке</h3>
        <p class="analytics-header__subtitle">Sales Process Cost Ratio (SPCR)</p>
      </div>
    </div>
    <div class="spcr-widget-body">
      <div class="spcr-summary" id="spcrSummary">Загрузка...</div>
    </div>
  `;
  refreshIcons();

  try {
    const data = await fetchData('BOLT_SPCR_H1_2025', '*');
    const frontOffice = data.filter(row => (row.sales || '').toLowerCase().includes('front') || (row.segment || '').toLowerCase().includes('front'));
    const backOffice = data.filter(row => (row.sales || '').toLowerCase().includes('back') || (row.segment || '').toLowerCase().includes('back'));

    const calcTotalSpcr = (rows) => {
      let totalRev = 0, totalCost = 0;
      rows.forEach(row => {
        totalRev += Number(row.REVENUE_H1_2025 || 0);
        totalCost += Number(row.Costs || 0);
      });
      return totalRev > 0 ? (totalCost / totalRev) * 100 : 0;
    };

    const frontSpcr = calcTotalSpcr(frontOffice);
    const backSpcr = calcTotalSpcr(backOffice);

    const box = (label, v) => `
      <div class="spcr-summary-item">
        <div class="spcr-summary-value">${fmt(v, 1)}%</div>
        <div class="spcr-summary-label">${label}</div>
      </div>`;

    document.getElementById('spcrSummary').innerHTML = `
      ${box('Фронт-офис', frontSpcr)}
      ${box('Бэк-офис', backSpcr)}
    `;
  } catch (e) {
    const box = document.getElementById('spcrSummary');
    if (box) box.innerHTML = `<span style="color:var(--muted)">Ошибка загрузки данных</span>`;
  }

  el.addEventListener('click', () => showSpcrModal());
}

// ========== RPSE Widget ==========
async function createRpseWidget(mountEl) {
  const el = mountEl || document.getElementById('card-rcd');
  if (!el) return;

  el.classList.add('clickable-card', 'rpse-widget');
  el.innerHTML = `
    <div class="analytics-chart__header">
      <i data-lucide="user"></i>
      <div class="analytics-chart__title-block">
        <h3 class="analytics-chart__title">Выручка на одного сотрудника отдела продаж</h3>
        <p class="analytics-header__subtitle">Revenue per Sales Employee</p>
      </div>
    </div>
    <div class="rpse-widget-body">
      <div class="rpse-summary" id="rpseSummary">Загрузка...</div>
    </div>
  `;
  refreshIcons();

  try {
    const data = await fetchData('BOLT_SPCR_H1_2025', '*');
    const frontOffice = data.filter(row => (row.sales || '').toLowerCase().includes('front') || (row.segment || '').toLowerCase().includes('front'));
    const backOffice = data.filter(row => (row.sales || '').toLowerCase().includes('back') || (row.segment || '').toLowerCase().includes('back'));

    const calcTotalRpse = (rows) => {
      let totalRev = 0, totalEmp = 0;
      rows.forEach(row => {
        totalRev += Number(row.REVENUE_H1_2025 || 0);
        totalEmp += Number(row['number of employees'] || 0);
      });
      return totalEmp > 0 ? (totalRev / 1000) / totalEmp : 0; // в тыс. руб. на сотрудника
    };

    const frontRpse = calcTotalRpse(frontOffice);
    const backRpse = calcTotalRpse(backOffice);

    const box = (label, v) => `
      <div class="rpse-summary-item">
        <div class="rpse-summary-value">${fmt(v, 0)} <span style="color: var(--blue)">тыс. руб.</span></div>
        <div class="rpse-summary-label">${label}</div>
      </div>`;

    document.getElementById('rpseSummary').innerHTML = `
      ${box('Фронт-офис', frontRpse)}
      ${box('Бэк-офис', backRpse)}
    `;
  } catch (e) {
    const box = document.getElementById('rpseSummary');
    if (box) box.innerHTML = `<span style="color:var(--muted)">Ошибка загрузки данных</span>`;
  }

  el.addEventListener('click', () => showRpseModal());
}

// ========== RPSC Modal ==========
async function showRpscModal() {
  const id = 'rpsc-modal-overlay';
  document.getElementById(id)?.remove();

  const tpl = `
    <div class="metric-modal-overlay" id="${id}">
      <div class="metric-modal" style="width: min(96vw, 1000px);">
        <div class="metric-modal__header">
          <i data-lucide="trending-up" class="title--blue"></i>
          <div class="metric-modal__title title--blue">Эффективность процессов продаж</div>
          <div class="metric-modal__subtitle">Revenue per Sales Cost (RPSC)</div>
          <div class="metric-modal__actions">
            <button class="metric-close" id="rpscClose" aria-label="Закрыть"><i data-lucide="x"></i></button>
          </div>
        </div>
        <div class="metric-modal__body">
          <div class="rpsc-period">
            <label>Период:</label>
            <select id="rpscPeriodSelect">
              <option value="H1_2025">H1 2025</option>
            </select>
          </div>
          <div class="tabs">
            <div class="tab-buttons">
              <button class="tab-button active" data-tab="departments">Подразделения</button>
              <button class="tab-button" data-tab="processes">Процессы</button>
            </div>
            <div class="tab-content">
              <div class="tab-pane active" id="tab-departments">
                <div class="rpsc-modules" id="rpscModules"></div>
              </div>
              <div class="tab-pane" id="tab-processes">
                <p>Раздел "Процессы" в разработке. Данные будут добавлены позже.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', tpl);
  refreshIcons();

  const overlay = document.getElementById(id);
  const btnClose = document.getElementById('rpscClose');
  const tabButtons = overlay.querySelectorAll('.tab-button');
  const tabPanes = overlay.querySelectorAll('.tab-pane');

  function open() { setTimeout(() => overlay.classList.add('is-open'), 10); }
  function close() { overlay.classList.remove('is-open'); setTimeout(() => overlay.remove(), 180); }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  btnClose.addEventListener('click', close);

  // Tab switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      overlay.querySelector(`#tab-${tab}`).classList.add('active');
    });
  });

  // Load data for departments
  try {
    const data = await fetchData('BOLT_SPCR_H1_2025', '*');
    const frontOffice = data.filter(row => (row.sales || '').toLowerCase().includes('front') || (row.segment || '').toLowerCase().includes('front'));
    const backOffice = data.filter(row => (row.sales || '').toLowerCase().includes('back') || (row.segment || '').toLowerCase().includes('back'));

    const renderChart = (title, rows) => {
      const container = document.createElement('div');
      container.className = 'rpsc-module';
      container.innerHTML = `<h4>${title}</h4><canvas style="max-height: 300px;"></canvas>`;
      const canvas = container.querySelector('canvas');
      const labels = rows.map(row => row.segment || '-');
      const data = rows.map(row => {
        const costs = Number(row.Costs || 0);
        const revenue = Number(row.REVENUE_H1_2025 || 0);
        return costs > 0 ? revenue / costs : 0;
      });
      if (window.Chart) {
        new Chart(canvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'RPSC',
              data,
              backgroundColor: 'rgba(74, 137, 243, 0.8)',
              borderColor: cssVar('--blue', '#4A89F3'),
              borderWidth: 2,
              borderRadius: 6,
              borderSkipped: false,
              hoverBackgroundColor: 'rgba(74, 137, 243, 1)',
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              duration: 1200,
              easing: 'easeOutQuart',
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(0,0,0,0.9)',
                titleColor: '#fff',
                bodyColor: '#fff',
                titleFont: { size: 14, weight: 'bold' },
                bodyFont: { size: 13 },
                cornerRadius: 8,
                displayColors: false,
                callbacks: {
                  title: (c) => `Сегмент: ${c[0].label}`,
                  label: (c) => {
                    const row = rows[c.dataIndex];
                    const costs = Number(row.Costs || 0);
                    const revenue = Number(row.REVENUE_H1_2025 || 0);
                    const rpsc = costs > 0 ? revenue / costs : 0;
                    return [
                      `RPSC: ${fmt(rpsc, 2)}`,
                      `Выручка: ${fmt(revenue, 0)} ₽`,
                      `Затраты: ${fmt(costs, 0)} ₽`
                    ];
                  }
                }
              },
              datalabels: {
                anchor: 'end',
                align: 'right',
                color: cssVar('--text', '#333'),
                font: { size: 12, weight: 'bold' },
                formatter: (value) => fmt(value, 2)
              }
            },
            scales: {
              x: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Revenue per Sales Cost (RPSC)',
                  color: cssVar('--text', '#333'),
                  font: { size: 14, weight: 'bold' },
                  padding: { top: 10 }
                },
                grid: { color: 'rgba(0,0,0,0.1)', lineWidth: 1 },
                ticks: {
                  color: cssVar('--text', '#333'),
                  font: { size: 12 },
                  padding: 10,
                  callback: (value) => fmt(value, 2)
                },
                border: { color: cssVar('--border', '#ddd'), width: 2 }
              },
              y: {
                grid: { display: false },
                ticks: {
                  color: cssVar('--text', '#333'),
                  font: { size: 12 },
                  padding: 10
                },
                border: { color: cssVar('--border', '#ddd'), width: 2 }
              }
            },
            layout: {
              padding: { left: 10, right: 10, top: 20, bottom: 10 }
            }
          }
        });
      }
      return container;
    };

    const rpscModules = document.getElementById('rpscModules');
    rpscModules.innerHTML = '';
    rpscModules.appendChild(renderChart('Фронт-офис', frontOffice));
    rpscModules.appendChild(renderChart('Бэк-офис', backOffice));
  } catch (e) {
    document.getElementById('rpscModules').innerHTML = `<p style="color:var(--muted)">Ошибка загрузки данных: ${e.message}</p>`;
  }

  open();
}

// ========== SPCR Modal ==========
async function showSpcrModal() {
  const id = 'spcr-modal-overlay';
  document.getElementById(id)?.remove();

  const tpl = `
    <div class="metric-modal-overlay" id="${id}">
      <div class="metric-modal" style="width: min(96vw, 1000px);">
        <div class="metric-modal__header">
          <i data-lucide="percent" class="title--blue"></i>
          <div class="metric-modal__title title--blue">Доля затрат процессов продаж в выручке</div>
          <div class="metric-modal__subtitle">Sales Process Cost Ratio (SPCR)</div>
          <div class="metric-modal__actions">
            <button class="metric-close" id="spcrClose" aria-label="Закрыть"><i data-lucide="x"></i></button>
          </div>
        </div>
        <div class="metric-modal__body">
          <div class="rpsc-period">
            <label>Период:</label>
            <select id="spcrPeriodSelect">
              <option value="H1_2025">H1 2025</option>
            </select>
          </div>
          <div class="tabs">
            <div class="tab-buttons">
              <button class="tab-button active" data-tab="departments">Подразделения</button>
              <button class="tab-button" data-tab="processes">Процессы</button>
            </div>
            <div class="tab-content">
              <div class="tab-pane active" id="tab-departments-spcr">
                <div class="rpsc-modules" id="spcrModules"></div>
              </div>
              <div class="tab-pane" id="tab-processes-spcr">
                <p>Раздел "Процессы" в разработке. Данные будут добавлены позже.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', tpl);
  refreshIcons();

  const overlay = document.getElementById(id);
  const btnClose = document.getElementById('spcrClose');
  const tabButtons = overlay.querySelectorAll('.tab-button');
  const tabPanes = overlay.querySelectorAll('.tab-pane');

  function open() { setTimeout(() => overlay.classList.add('is-open'), 10); }
  function close() { overlay.classList.remove('is-open'); setTimeout(() => overlay.remove(), 180); }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  btnClose.addEventListener('click', close);

  // Tab switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      overlay.querySelector(`#tab-${tab}-spcr`).classList.add('active');
    });
  });

  // Load data for departments
  try {
    const data = await fetchData('BOLT_SPCR_H1_2025', '*');
    const frontOffice = data.filter(row => (row.sales || '').toLowerCase().includes('front') || (row.segment || '').toLowerCase().includes('front'));
    const backOffice = data.filter(row => (row.sales || '').toLowerCase().includes('back') || (row.segment || '').toLowerCase().includes('back'));

    const renderChart = (title, rows) => {
      const container = document.createElement('div');
      container.className = 'rpsc-module';
      container.innerHTML = `<h4>${title}</h4><canvas style="max-height: 300px;"></canvas>`;
      const canvas = container.querySelector('canvas');
      const labels = rows.map(row => row.segment || '-');
      const data = rows.map(row => {
        const costs = Number(row.Costs || 0);
        const revenue = Number(row.REVENUE_H1_2025 || 0);
        return revenue > 0 ? (costs / revenue) * 100 : 0;
      });
      if (window.Chart) {
        new Chart(canvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'SPCR',
              data,
              backgroundColor: 'rgba(74, 137, 243, 0.8)',
              borderColor: cssVar('--blue', '#4A89F3'),
              borderWidth: 2,
              borderRadius: 6,
              borderSkipped: false,
              hoverBackgroundColor: 'rgba(74, 137, 243, 1)',
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              duration: 1200,
              easing: 'easeOutQuart',
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(0,0,0,0.9)',
                titleColor: '#fff',
                bodyColor: '#fff',
                titleFont: { size: 14, weight: 'bold' },
                bodyFont: { size: 13 },
                cornerRadius: 8,
                displayColors: false,
                callbacks: {
                  title: (c) => `Сегмент: ${c[0].label}`,
                  label: (c) => {
                    const row = rows[c.dataIndex];
                    const costs = Number(row.Costs || 0);
                    const revenue = Number(row.REVENUE_H1_2025 || 0);
                    const spcr = revenue > 0 ? (costs / revenue) * 100 : 0;
                    return [
                      `SPCR: ${fmt(spcr, 1)}%`,
                      `Выручка: ${fmt(revenue, 0)} ₽`,
                      `Затраты: ${fmt(costs, 0)} ₽`
                    ];
                  }
                }
              },
              datalabels: {
                anchor: 'end',
                align: 'right',
                color: cssVar('--text', '#333'),
                font: { size: 12, weight: 'bold' },
                formatter: (value) => `${fmt(value, 1)}%`
              }
            },
            scales: {
              x: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Sales Process Cost Ratio (SPCR, %)',
                  color: cssVar('--text', '#333'),
                  font: { size: 14, weight: 'bold' },
                  padding: { top: 10 }
                },
                grid: { color: 'rgba(0,0,0,0.1)', lineWidth: 1 },
                ticks: {
                  color: cssVar('--text', '#333'),
                  font: { size: 12 },
                  padding: 10,
                  callback: (value) => `${fmt(value, 1)}%`
                },
                border: { color: cssVar('--border', '#ddd'), width: 2 }
              },
              y: {
                grid: { display: false },
                ticks: {
                  color: cssVar('--text', '#333'),
                  font: { size: 12 },
                  padding: 10
                },
                border: { color: cssVar('--border', '#ddd'), width: 2 }
              }
            },
            layout: {
              padding: { left: 10, right: 10, top: 20, bottom: 10 }
            }
          }
        });
      }
      return container;
    };

    const spcrModules = document.getElementById('spcrModules');
    spcrModules.innerHTML = '';
    spcrModules.appendChild(renderChart('Фронт-офис', frontOffice));
    spcrModules.appendChild(renderChart('Бэк-офис', backOffice));
  } catch (e) {
    document.getElementById('spcrModules').innerHTML = `<p style="color:var(--muted)">Ошибка загрузки данных: ${e.message}</p>`;
  }

  open();
}

// ========== RPSE Modal ==========
async function showRpseModal() {
  const id = 'rpse-modal-overlay';
  document.getElementById(id)?.remove();

  const tpl = `
    <div class="metric-modal-overlay" id="${id}">
      <div class="metric-modal" style="width: min(96vw, 1000px);">
        <div class="metric-modal__header">
          <i data-lucide="user" class="title--blue"></i>
          <div class="metric-modal__title title--blue">Выручка на одного сотрудника отдела продаж</div>
          <div class="metric-modal__subtitle">Revenue per Sales Employee</div>
          <div class="metric-modal__actions">
            <button class="metric-close" id="rpseClose" aria-label="Закрыть"><i data-lucide="x"></i></button>
          </div>
        </div>
        <div class="metric-modal__body">
          <div class="rpsc-period">
            <label>Период:</label>
            <select id="rpsePeriodSelect">
              <option value="H1_2025">H1 2025</option>
            </select>
          </div>
          <div class="tabs">
            <div class="tab-buttons">
              <button class="tab-button active" data-tab="departments">Подразделения</button>
              <button class="tab-button" data-tab="processes">Процессы</button>
            </div>
            <div class="tab-content">
              <div class="tab-pane active" id="tab-departments-rpse">
                <div class="rpsc-modules" id="rpseModules"></div>
              </div>
              <div class="tab-pane" id="tab-processes-rpse">
                <p>Раздел "Процессы" в разработке. Данные будут добавлены позже.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', tpl);
  refreshIcons();

  const overlay = document.getElementById(id);
  const btnClose = document.getElementById('rpseClose');
  const tabButtons = overlay.querySelectorAll('.tab-button');
  const tabPanes = overlay.querySelectorAll('.tab-pane');

  function open() { setTimeout(() => overlay.classList.add('is-open'), 10); }
  function close() { overlay.classList.remove('is-open'); setTimeout(() => overlay.remove(), 180); }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  btnClose.addEventListener('click', close);

  // Tab switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      overlay.querySelector(`#tab-${tab}-rpse`).classList.add('active');
    });
  });

  // Load data for departments
  try {
    const data = await fetchData('BOLT_SPCR_H1_2025', '*');
    const frontOffice = data.filter(row => (row.sales || '').toLowerCase().includes('front') || (row.segment || '').toLowerCase().includes('front'));
    const backOffice = data.filter(row => (row.sales || '').toLowerCase().includes('back') || (row.segment || '').toLowerCase().includes('back'));

    const renderChart = (title, rows) => {
      const container = document.createElement('div');
      container.className = 'rpsc-module';
      container.innerHTML = `<h4>${title}</h4><canvas style="max-height: 300px;"></canvas>`;
      const canvas = container.querySelector('canvas');
      const labels = rows.map(row => row.segment || '-');
      const data = rows.map(row => {
        const emp = Number(row['number of employees'] || 0);
        const revenue = Number(row.REVENUE_H1_2025 || 0);
        return emp > 0 ? (revenue / 1000) / emp : 0; // тыс. руб. на сотрудника
      });
      if (window.Chart) {
        new Chart(canvas.getContext('2d'), {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'RPSE',
              data,
              backgroundColor: 'rgba(74, 137, 243, 0.8)',
              borderColor: cssVar('--blue', '#4A89F3'),
              borderWidth: 2,
              borderRadius: 6,
              borderSkipped: false,
              hoverBackgroundColor: 'rgba(74, 137, 243, 1)',
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              duration: 1200,
              easing: 'easeOutQuart',
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(0,0,0,0.9)',
                titleColor: '#fff',
                bodyColor: '#fff',
                titleFont: { size: 14, weight: 'bold' },
                bodyFont: { size: 13 },
                cornerRadius: 8,
                displayColors: false,
                callbacks: {
                  title: (c) => `Сегмент: ${c[0].label}`,
                  label: (c) => {
                    const row = rows[c.dataIndex];
                    const emp = Number(row['number of employees'] || 0);
                    const revenue = Number(row.REVENUE_H1_2025 || 0);
                    const rpse = emp > 0 ? (revenue / 1000) / emp : 0;
                    return [
                      `RPSE: ${fmt(rpse, 0)} тыс. руб.`,
                      `Выручка: ${fmt(revenue / 1000, 0)} тыс. руб.`,
                      `Сотрудники: ${emp}`
                    ];
                  }
                }
              },
              datalabels: {
                anchor: 'end',
                align: 'right',
                color: cssVar('--text', '#333'),
                font: { size: 12, weight: 'bold' },
                formatter: (value) => `${fmt(value, 0)} тыс. руб.`
              }
            },
            scales: {
              x: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Revenue per Sales Employee (тыс. руб.)',
                  color: cssVar('--text', '#333'),
                  font: { size: 14, weight: 'bold' },
                  padding: { top: 10 }
                },
                grid: { color: 'rgba(0,0,0,0.1)', lineWidth: 1 },
                ticks: {
                  color: cssVar('--text', '#333'),
                  font: { size: 12 },
                  padding: 10,
                  callback: (value) => fmt(value, 0)
                },
                border: { color: cssVar('--border', '#ddd'), width: 2 }
              },
              y: {
                grid: { display: false },
                ticks: {
                  color: cssVar('--text', '#333'),
                  font: { size: 12 },
                  padding: 10
                },
                border: { color: cssVar('--border', '#ddd'), width: 2 }
              }
            },
            layout: {
              padding: { left: 10, right: 10, top: 20, bottom: 10 }
            }
          }
        });
      }
      return container;
    };

    const rpseModules = document.getElementById('rpseModules');
    rpseModules.innerHTML = '';
    rpseModules.appendChild(renderChart('Фронт-офис', frontOffice));
    rpseModules.appendChild(renderChart('Бэк-офис', backOffice));
  } catch (e) {
    document.getElementById('rpseModules').innerHTML = `<p style="color:var(--muted)">Ошибка загрузки данных: ${e.message}</p>`;
  }

  open();
}

// ========== Универсальный модал для остальных виджетов ==========
function showMetricModal({ icon = 'info', title = '', subtitle = '', html = '' }) {
  const id = 'metric-modal';
  document.getElementById(id)?.remove();

  const tpl = `
    <div class="metric-modal-overlay" id="${id}">
      <div class="metric-modal">
        <div class="metric-modal__header">
          <i data-lucide="${icon}"></i>
          <div class="metric-modal__title">${title}</div>
          <div class="metric-modal__subtitle">${subtitle}</div>
        </div>
        <div class="metric-modal__body">${html || '<p>Раздел в разработке. Метрика будет рассчитана на базе ABC (Activity Based Costing) и появится в ближайшем релизе.</p>'}</div>
        <div class="metric-modal__footer">
          <button class="metric-close" id="metric-modal-close"><i data-lucide="x"></i></button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', tpl);
  refreshIcons();
  const overlay = document.getElementById(id);
  setTimeout(() => overlay.classList.add('is-open'), 10);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.getElementById('metric-modal-close').addEventListener('click', close);
  function close() {
    overlay.classList.remove('is-open');
    setTimeout(() => overlay.remove(), 180);
  }
}

// ========== Рендеринг прочих карточек ==========
function renderStaticCard(el, { icon, title, subtitle, body = '' }, onClick) {
  el.classList.add('clickable-card');
  el.innerHTML = `
    <div class="analytics-chart__header">
      <i data-lucide="${icon}"></i>
      <div class="analytics-chart__title-block">
        <h3 class="analytics-chart__title">${title}</h3>
        <p class="analytics-header__subtitle">${subtitle}</p>
      </div>
    </div>
    ${body ? `<div class="metric-card__body">${body}</div>` : '' }
  `;
  el.addEventListener('click', onClick);
}

async function initMetricCards() {
  // 1) Затраты процессов (Total Activity Cost)
  const tac = document.getElementById('card-tac');
  if (tac) {
    renderStaticCard(
      tac,
      { icon: 'coins', title: 'Анализ затрат процессов', subtitle: 'Total Activity Cost' },
      () => showMetricModal({
        icon: 'coins',
        title: 'Затраты процессов',
        subtitle: 'Total Activity Cost',
        html: `<p>Итоговые затраты процессов за период по ABC. На детальном экране отобразим:</p>
               <ul>
                 <li>Топ‑10 самых дорогих процессов</li>
                 <li>Динамика по месяцам</li>
                 <li>Разбивка по ресурсным пулам</li>
               </ul>`
      })
    );
  }

  // 2) Выручка на одного сотрудника отдела продаж (Revenue per Sales Employee)
  const rpse = document.getElementById('card-rcd');
  if (rpse) {
    await createRpseWidget(rpse);
  }

  // 3) SPCR — доля затрат продаж в выручке
  const spcr = document.getElementById('card-spcr');
  if (spcr) {
    await createSpcrWidget(spcr);
  }

  // 4) RPSC — эффективность процессов продаж
  const rpsc = document.getElementById('card-rpsc');
  if (rpsc) {
    await createRpscWidget(rpsc);
  }

  refreshIcons();
}

// ========== Обновление виджетов при смене периода ==========
async function updateWidgets() {
  await initMetricCards();
  await createFteWidget(document.getElementById('card-fte'));
  await createVaWidget(document.getElementById('card-va'));
}

// ========== Точка входа ==========
export async function renderCostsPage(container) {
  // Библиотеки
  const ensureScript = (id, src) => {
    if (document.getElementById(id)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.id = id; s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  };
  await Promise.all([
    ensureScript('chart-js', 'https://cdn.jsdelivr.net/npm/chart.js'),
    ensureScript('chartjs-datalabels', 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2'),
    ensureScript('jspdf', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
    ensureScript('jspdf-autotable', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.23/jspdf.plugin.autotable.min.js'),
  ]);

  injectCostStyles();

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
        <div class="costs-period-selector">
          <label>Период:</label>
          <select id="costsPeriodSelect">
            <option value="H1_2025">H1 2025</option>
          </select>
        </div>
      </div>

      <div class="analytics-grid analytics-grid--1-1">
        <!-- Затраты процессов -->
        <div class="analytics-chart clickable-card" id="card-tac">
          <div class="analytics-chart__header">
            <i data-lucide="coins"></i>
            <div class="analytics-chart__title-block">
              <h3 class="analytics-chart__title">Затраты процессов</h3>
              <p class="analytics-header__subtitle">Total Activity Cost</p>
            </div>
          </div>
          <div class="metric-card__body">Нажмите, чтобы открыть подробности</div>
        </div>

        <!-- FTE -->
        <div class="analytics-chart clickable-card" id="card-fte"></div>

        <!-- Драйверы затрат ресурсов -->
        <div class="analytics-chart clickable-card" id="card-rcd"></div>

        <!-- VA vs NVA -->
        <div class="analytics-chart clickable-card" id="card-va"></div>

        <!-- SPCR -->
        <div class="analytics-chart clickable-card" id="card-spcr"></div>

        <!-- RPSC -->
        <div class="analytics-chart clickable-card" id="card-rpsc"></div>
      </div>
    </div>`;

  // Инициализация карточек
  await initMetricCards();

  // Специализированные виджеты
  await createFteWidget(document.getElementById('card-fte'));
  await createVaWidget(document.getElementById('card-va'));

  // Обработчик периода
  const periodSelect = document.getElementById('costsPeriodSelect');
  if (periodSelect) {
    periodSelect.addEventListener('change', async () => {
      await updateWidgets();
    });
  }

  refreshIcons();
}