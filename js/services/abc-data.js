// js/services/abc-data.js
import { fetchData, fetchAbcData } from '../api.js';
import { supabase } from '../api.js';

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
    const periods = await fetchData('abc_periods', '*');
    const activePeriods = periods.filter(p => p.is_active);
    return activePeriods.map(p => ({
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
    // Получаем данные через RPC функции
    const [summary, validation] = await Promise.all([
      getAbcSummary(),
      getValidationData()
    ]);

    const processCount = summary.reduce((sum, cls) => sum + (cls.out_process_count || 0), 0);
    const totalCost = summary.reduce((sum, cls) => sum + (cls.out_total_cost || 0), 0);

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
      getAbcSummary(),
      getParetoData(10),
      getValidationData()
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
          { label: 'Top-10', value: `${topProcesses.slice(0, 10).reduce((sum, p) => sum + (p.out_pct_of_total || 0), 0).toFixed(1)}% затрат` }
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
    const options = {
      noCache: false,
      limit: 100
    };

    // Преобразуем фильтры в формат для fetchAbcData
    const apiFilters = [];
    
    if (filters.abcClass) {
      apiFilters.push({
        column: 'abc_class',
        operator: 'eq',
        value: filters.abcClass
      });
    }
    
    if (filters.search) {
      // Для текстового поиска используем RPC функцию
      return await getProcessSearch(filters.search, 100);
    }

    options.filters = apiFilters;
    options.sortBy = filters.sortBy || 'total_cost DESC';

    return await fetchAbcData('vw_abc_classification', options);
  } catch (error) {
    console.error('Error fetching ABC processes:', error);
    return [];
  }
}

// Поиск процессов
async function getProcessSearch(searchTerm, limit = 50) {
  try {
    const { data, error } = await supabase.rpc('fn_search_processes', {
      p_search_term: searchTerm,
      p_limit: limit
    });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error in process search:', error);
    return [];
  }
}

// Получение данных для Парето
export async function getParetoData(topCount = 20) {
  try {
    // Прямой вызов функции через RPC
    const { data, error } = await supabase.rpc('fn_get_top_processes', {
      top_count: topCount
    });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching Pareto data:', error);
    return [];
  }
}

// Получение деталей процесса
export async function getProcessDetails(processId) {
  try {
    if (!processId) {
      console.warn('Process ID is required for getProcessDetails');
      return [];
    }
    
    // Прямой вызов функции через RPC
    const { data, error } = await supabase.rpc('fn_get_process_cost_details', {
      p_process_id: processId
    });
    
    if (error) {
      console.error('RPC Error:', error);
      throw error;
    }
    
    return data || [];
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

// Получение ABC сводки через RPC
export async function getAbcSummary() {
  try {
    const { data, error } = await supabase.rpc('fn_get_abc_summary');
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching ABC summary:', error);
    return [];
  }
}

// Получение данных для матрицы распределения
export async function getMatrixData(deptLimit = 20, processLimit = 20) {
  try {
    // Получаем топ подразделений по затратам
    const departments = await fetchAbcData('vw_department_costs_summary', {
      limit: deptLimit,
      sortBy: 'dept_allocated_costs DESC'
    });

    // Получаем топ процессов по затратам
    const processes = await fetchAbcData('vw_abc_classification', {
      limit: processLimit,
      sortBy: 'total_cost DESC'
    });

    // Получаем матрицу затрат
    const deptIds = departments.map(d => `'${d.dept_id}'`).join(',');
    const processIds = processes.map(p => `'${p.process_id}'`).join(',');

    if (!deptIds || !processIds) {
      return { departments: [], processes: [], matrix: [], summary: { totalCells: 0, filledCells: 0, totalValue: 0, avgValue: 0 } };
    }

    // Используем view для матрицы
    const matrixData = await fetchAbcData('vw_department_process_matrix', {
      filters: [
        {
          column: 'dept_id',
          operator: 'in',
          value: `(${deptIds})`
        }
      ]
    });

    // Создаем матрицу (упрощенная версия)
    const matrix = departments.map(dept => 
      processes.map(proc => {
        const deptProcData = matrixData.find(m => m.dept_id === dept.dept_id && m.process_id === proc.process_id);
        return deptProcData ? deptProcData.total_cost || 0 : 0;
      })
    );

    const totalCells = departments.length * processes.length;
    const filledCells = matrixData.length;
    const totalValue = matrixData.reduce((sum, m) => sum + (m.total_cost || 0), 0);
    const avgValue = filledCells > 0 ? totalValue / filledCells : 0;
    const maxValue = Math.max(...matrix.flat());

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