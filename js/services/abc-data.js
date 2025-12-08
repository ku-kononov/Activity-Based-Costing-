// js/services/abc-data.js
import { fetchData } from '../api.js';

// Caching system
const dataCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(table, filters = {}) {
  return `${table}_${JSON.stringify(filters)}`;
}

function getCachedData(key) {
  const cached = dataCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedData(key, data) {
  dataCache.set(key, { data, timestamp: Date.now() });
}

// Feature flags cache
let featureFlagsCache = null;
let featureFlagsTimestamp = 0;
const FEATURE_FLAGS_TTL = 5 * 60 * 1000; // 5 minutes

// Check if feature is enabled
export async function isFeatureEnabled(featureName) {
  try {
    const now = Date.now();
    if (!featureFlagsCache || (now - featureFlagsTimestamp) > FEATURE_FLAGS_TTL) {
      const flags = await fetchData('abc_feature_flags', '*');
      featureFlagsCache = {};
      flags.forEach(flag => {
        featureFlagsCache[flag.feature_name] = flag.is_enabled;
      });
      featureFlagsTimestamp = now;
    }
    return featureFlagsCache[featureName] || false;
  } catch (error) {
    console.warn('Feature flags check failed:', error);
    // Default to enabled for critical features
    return ['abc_dashboard', 'abc_processes', 'abc_pareto', 'abc_matrix', 'abc_validation'].includes(featureName);
  }
}

// Get available periods
export async function getAvailablePeriods() {
  try {
    const periods = await fetchData('abc_periods', '*', 'is_active', 'eq', 'true');
    return periods.map(p => ({
      code: p.period_code,
      name: p.period_name,
      startDate: p.start_date,
      endDate: p.end_date
    }));
  } catch (error) {
    console.warn('Failed to load periods:', error);
    return [{ code: 'H1_2025', name: 'H1 2025' }];
  }
}

// Получение KPI для dashboard
export async function getAbcKpis() {
  const cacheKey = 'abc_kpis';
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  try {
    const [summary, validation] = await Promise.all([
      fetchData('vw_process_costs_summary', 'COUNT(*) as process_count, SUM(total_cost) as total_cost'),
      fetchData('vw_data_validation', '*')
    ]);

    const processCount = summary[0]?.process_count || 0;
    const totalCost = summary[0]?.total_cost || 0;

    // Расчет полноты распределения
    const deptTotal = validation.find(v => v.check_name === 'Departments Total')?.amount || 0;
    const allocatedTotal = validation.find(v => v.check_name === 'Allocated Total')?.amount || 0;
    const completeness = deptTotal > 0 ? (allocatedTotal / deptTotal * 100) : 0;

    const result = {
      totalCosts: totalCost,
      processCount: processCount,
      departmentCount: 23, // hardcoded for now
      allocationCompleteness: Math.round(completeness * 10) / 10
    };

    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error fetching ABC KPIs:', error);
    return {
      totalCosts: 0,
      processCount: 0,
      departmentCount: 0,
      allocationCompleteness: 0
    };
  }
}

// Получение данных для модулей dashboard
export async function getAbcModulesData() {
  try {
    const [abcSummary, topProcesses, validation] = await Promise.all([
      fetchData('fn_get_abc_summary()', '*'),
      fetchData('fn_get_top_processes(10)', '*'),
      fetchData('vw_data_validation', '*')
    ]);

    return {
      processes: {
        metrics: abcSummary.map(cls => ({
          label: `Класс ${cls.out_abc_class}`,
          value: `${cls.out_process_count} (${cls.out_pct_of_total}%)`
        }))
      },
      pareto: {
        metrics: [
          { label: 'Top-10', value: `${topProcesses.slice(0, 10).reduce((sum, p) => sum + p.out_pct_of_total, 0).toFixed(1)}% затрат` }
        ]
      },
      validation: {
        metrics: [
          { label: 'Warnings', value: validation.filter(v => v.amount > 0 && v.check_name.includes('Difference')).length.toString() },
          { label: 'Errors', value: '0' }
        ]
      }
    };
  } catch (error) {
    console.error('Error fetching ABC modules data:', error);
    return {
      processes: { metrics: [] },
      pareto: { metrics: [] },
      validation: { metrics: [] }
    };
  }
}

// Получение данных для ABC-классификации
export async function getAbcProcesses(filters = {}) {
  try {
    let query = 'vw_abc_classification';
    let conditions = [];

    if (filters.abcClass) {
      conditions.push(`abc_class = '${filters.abcClass}'`);
    }
    if (filters.search) {
      conditions.push(`(process_name ILIKE '%${filters.search}%' OR pcf_code ILIKE '%${filters.search}%')`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    // Поддержка сортировки
    const sortBy = filters.sortBy || 'total_cost DESC';
    query += ` ORDER BY ${sortBy} LIMIT 100`;

    return await fetchData(query, '*');
  } catch (error) {
    console.error('Error fetching ABC processes:', error);
    return [];
  }
}

// Получение данных для Парето
export async function getParetoData(topCount = 20) {
  try {
    return await fetchData(`fn_get_top_processes(${topCount})`, '*');
  } catch (error) {
    console.error('Error fetching Pareto data:', error);
    return [];
  }
}

// Получение деталей процесса
export async function getProcessDetails(processId) {
  try {
    return await fetchData(`fn_get_process_cost_details('${processId}')`, '*');
  } catch (error) {
    console.error('Error fetching process details:', error);
    return [];
  }
}

// Получение данных валидации
export async function getValidationData() {
  try {
    return await fetchData('vw_data_validation', '*');
  } catch (error) {
    console.error('Error fetching validation data:', error);
    return [];
  }
}

// Получение данных для матрицы распределения
export async function getMatrixData(deptLimit = 20, processLimit = 20) {
  try {
    // Получаем топ подразделений по затратам
    const deptQuery = `vw_dept_costs ORDER BY total_cost DESC LIMIT ${deptLimit}`;
    const departments = await fetchData(deptQuery, '*');

    // Получаем топ процессов по затратам
    const processQuery = `vw_abc_classification ORDER BY total_cost DESC LIMIT ${processLimit}`;
    const processes = await fetchData(processQuery, '*');

    // Получаем матрицу затрат
    const deptIds = departments.map(d => `'${d.dept_id}'`).join(',');
    const processIds = processes.map(p => `'${p.process_id}'`).join(',');

    if (!deptIds || !processIds) {
      return { departments: [], processes: [], matrix: [], summary: { totalCells: 0, filledCells: 0, totalValue: 0, avgValue: 0 } };
    }

    const matrixQuery = `
      SELECT dept_id, process_id, total_cost
      FROM vw_dept_process_costs
      WHERE dept_id IN (${deptIds}) AND process_id IN (${processIds})
    `;
    const matrixData = await fetchData(matrixQuery, '*');

    // Создаем матрицу
    const matrix = [];
    let maxValue = 0;

    departments.forEach((dept, deptIndex) => {
      matrix[deptIndex] = [];
      processes.forEach((proc, procIndex) => {
        const cell = matrixData.find(m => m.dept_id === dept.dept_id && m.process_id === proc.process_id);
        const value = cell ? cell.total_cost : 0;
        matrix[deptIndex][procIndex] = value;
        if (value > maxValue) maxValue = value;
      });
    });

    // Рассчитываем сводку
    const totalCells = departments.length * processes.length;
    const filledCells = matrixData.length;
    const totalValue = matrixData.reduce((sum, m) => sum + m.total_cost, 0);
    const avgValue = filledCells > 0 ? totalValue / filledCells : 0;

    return {
      departments,
      processes,
      matrix,
      maxValue,
      summary: {
        totalCells,
        filledCells,
        totalValue,
        avgValue
      }
    };
  } catch (error) {
    console.error('Error fetching matrix data:', error);
    return { departments: [], processes: [], matrix: [], summary: { totalCells: 0, filledCells: 0, totalValue: 0, avgValue: 0 } };
  }
}