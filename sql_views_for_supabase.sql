-- =============================================================================
-- SQL VIEWS FOR ABC ANALYSIS DASHBOARD
-- Создание оптимизированных представлений в Supabase
-- Версия: 3.0 (с периодами и feature flags)
-- Дата: 2025-12-08
-- =============================================================================

-- =============================================================================
-- TABLES FOR ABC SYSTEM CONFIGURATION
-- =============================================================================

-- Таблица периодов анализа
CREATE TABLE IF NOT EXISTS abc_periods (
  period_code VARCHAR PRIMARY KEY,
  period_name VARCHAR NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индекс для активных периодов
CREATE INDEX IF NOT EXISTS idx_abc_periods_active ON abc_periods(is_active) WHERE is_active = true;

-- Вставка тестовых данных периодов
INSERT INTO abc_periods (period_code, period_name, start_date, end_date, is_active)
VALUES
  ('H1_2025', 'Первое полугодие 2025', '2025-01-01', '2025-06-30', true),
  ('H2_2024', 'Второе полугодие 2024', '2024-07-01', '2024-12-31', false),
  ('FY_2024', 'Финансовый год 2024', '2024-01-01', '2024-12-31', false)
ON CONFLICT (period_code) DO NOTHING;

-- Таблица feature flags для поэтапного включения модулей
CREATE TABLE IF NOT EXISTS abc_feature_flags (
  feature_name VARCHAR PRIMARY KEY,
  is_enabled BOOLEAN DEFAULT false,
  description TEXT,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Вставка feature flags
INSERT INTO abc_feature_flags (feature_name, is_enabled, description, rollout_percentage)
VALUES
  ('abc_dashboard', true, 'Главная страница ABC анализа', 100),
  ('abc_processes', true, 'Страница классификации процессов', 100),
  ('abc_pareto', true, 'Анализ Парето (топ-процессы)', 100),
  ('abc_matrix', true, 'Матрица распределения', 100),
  ('abc_validation', true, 'Валидация данных', 100),
  ('abc_departments', false, 'Анализ по подразделениям', 0),
  ('abc_cost_structure', false, 'Структура затрат', 0),
  ('export_excel', true, 'Экспорт в Excel', 100),
  ('export_pdf', true, 'Экспорт в PDF', 100),
  ('period_selector', false, 'Выбор периода анализа', 0)
ON CONFLICT (feature_name) DO NOTHING;

-- Функция проверки feature flag
CREATE OR REPLACE FUNCTION is_feature_enabled(feature_name_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  feature_enabled BOOLEAN;
  rollout_pct INTEGER;
  random_val INTEGER;
BEGIN
  SELECT is_enabled, rollout_percentage INTO feature_enabled, rollout_pct
  FROM abc_feature_flags
  WHERE feature_name = feature_name_param;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF NOT feature_enabled THEN
    RETURN false;
  END IF;

  IF rollout_pct = 100 THEN
    RETURN true;
  END IF;

  -- Простая рандомизация для rollout (в продакшене использовать user_id)
  random_val := (EXTRACT(epoch FROM NOW())::INTEGER % 100) + 1;
  RETURN random_val <= rollout_pct;
END;
$$;

COMMENT ON FUNCTION is_feature_enabled IS 'Проверка включения feature flag с учётом rollout percentage';

-- =============================================================================
-- ИНДЕКСЫ НА БАЗОВЫХ ТАБЛИЦАХ (выполнить первыми для производительности)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_costs_driver_process_id 
  ON "Costs_Driver_by_BI"("Process ID");

CREATE INDEX IF NOT EXISTS idx_costs_driver_dept_id 
  ON "Costs_Driver_by_BI"("Department ID");

CREATE INDEX IF NOT EXISTS idx_costs_driver_cost_driver 
  ON "Costs_Driver_by_BI"("Cost_Driver") 
  WHERE "Cost_Driver" IS NOT NULL AND "Cost_Driver" > 0;

CREATE INDEX IF NOT EXISTS idx_costs_driver_process_group 
  ON "Costs_Driver_by_BI"(process_group);

CREATE INDEX IF NOT EXISTS idx_dept_costs_dept_id 
  ON "BOLT_Затраты_подразделений_H12025"("Department_ID");

-- =============================================================================
-- VIEW 1: vw_process_costs
-- Детальные затраты по каждому процессу-подразделению
-- =============================================================================

DROP VIEW IF EXISTS vw_department_process_matrix CASCADE;
DROP VIEW IF EXISTS vw_data_validation CASCADE;
DROP VIEW IF EXISTS vw_cost_structure_by_type CASCADE;
DROP VIEW IF EXISTS vw_abc_classification CASCADE;
DROP VIEW IF EXISTS vw_department_costs_summary CASCADE;
DROP VIEW IF EXISTS vw_process_group_summary CASCADE;
DROP VIEW IF EXISTS vw_process_costs_summary CASCADE;
DROP VIEW IF EXISTS vw_process_costs CASCADE;

CREATE VIEW vw_process_costs AS
SELECT
  'H1_2025'::TEXT as period_code,
  cd."KEY" as record_key,
  cd."Process ID" as process_id,
  cd.process_group,
  cd."PCF Code" as pcf_code,
  cd."Process Name" as process_name,
  cd."Department ID" as dept_id,
  cd."Department Name" as dept_name,
  
  -- Определение уровня PCF по количеству точек в коде
  COALESCE(
    LENGTH(cd."PCF Code") - LENGTH(REPLACE(cd."PCF Code", '.', '')) + 1,
    1
  ) as pcf_level,
  
  -- Cost_Driver в формате доли (0-1)
  cd."Cost_Driver" as allocation_rate,
  
  -- Затраты подразделения (с защитой от NULL)
  COALESCE(d.number_of_employees, 0) as number_of_employees,
  COALESCE(d.payroll_costs, 0) as payroll_costs,
  COALESCE(d.workspace_costs, 0) as workspace_costs,
  COALESCE(d.other_costs, 0) as other_costs,
  COALESCE(d.total_costs, 0) as dept_total_costs,
  
  -- Распределённые затраты (ГЛАВНАЯ ФОРМУЛА)
  ROUND((COALESCE(d.payroll_costs, 0) * cd."Cost_Driver")::NUMERIC, 0)::BIGINT as allocated_payroll,
  ROUND((COALESCE(d.workspace_costs, 0) * cd."Cost_Driver")::NUMERIC, 0)::BIGINT as allocated_workspace,
  ROUND((COALESCE(d.other_costs, 0) * cd."Cost_Driver")::NUMERIC, 0)::BIGINT as allocated_other,
  ROUND((COALESCE(d.total_costs, 0) * cd."Cost_Driver")::NUMERIC, 0)::BIGINT as allocated_total

FROM "Costs_Driver_by_BI" cd
LEFT JOIN "BOLT_Затраты_подразделений_H12025" d 
  ON cd."Department ID" = d."Department_ID"
WHERE cd."Cost_Driver" IS NOT NULL 
  AND cd."Cost_Driver" > 0;

COMMENT ON VIEW vw_process_costs IS 
  'Детальные затраты по каждому процессу-подразделению с расчётом распределения по Cost_Driver';

-- =============================================================================
-- VIEW 2: vw_process_costs_summary
-- Сводные данные по процессам с ABC-классификацией
-- =============================================================================

CREATE VIEW vw_process_costs_summary AS
WITH process_totals AS (
  SELECT 
    process_id,
    process_group,
    pcf_code,
    process_name,
    pcf_level,
    COUNT(DISTINCT dept_id) as contributing_depts,
    SUM(allocated_payroll)::BIGINT as total_payroll,
    SUM(allocated_workspace)::BIGINT as total_workspace,
    SUM(allocated_other)::BIGINT as total_other,
    SUM(allocated_total)::BIGINT as total_cost
  FROM vw_process_costs
  GROUP BY process_id, process_group, pcf_code, process_name, pcf_level
),
grand_total AS (
  SELECT SUM(total_cost)::NUMERIC as grand_sum FROM process_totals
),
ranked AS (
  SELECT 
    pt.*,
    ROUND(pt.total_cost / NULLIF(gt.grand_sum, 0) * 100, 2) as pct_of_total,
    ROW_NUMBER() OVER (ORDER BY pt.total_cost DESC) as cost_rank,
    SUM(pt.total_cost) OVER (ORDER BY pt.total_cost DESC ROWS UNBOUNDED PRECEDING) as running_total,
    gt.grand_sum
  FROM process_totals pt
  CROSS JOIN grand_total gt
)
SELECT 
  process_id,
  process_group,
  pcf_code,
  process_name,
  pcf_level,
  contributing_depts,
  total_payroll,
  total_workspace,
  total_other,
  total_cost,
  pct_of_total,
  cost_rank::INTEGER,
  ROUND(running_total / NULLIF(grand_sum, 0) * 100, 2) as cumulative_pct
FROM ranked;

COMMENT ON VIEW vw_process_costs_summary IS 
  'Сводка по процессам с ABC-классификацией и cumulative_pct для анализа 80/20';

-- =============================================================================
-- VIEW 3: vw_process_group_summary
-- Сводка по группам процессов
-- =============================================================================

CREATE VIEW vw_process_group_summary AS
WITH group_totals AS (
  SELECT 
    process_group,
    COUNT(DISTINCT process_id) as process_count,
    COUNT(DISTINCT dept_id) as dept_count,
    SUM(allocated_payroll)::BIGINT as total_payroll,
    SUM(allocated_workspace)::BIGINT as total_workspace,
    SUM(allocated_other)::BIGINT as total_other,
    SUM(allocated_total)::BIGINT as total_cost
  FROM vw_process_costs
  GROUP BY process_group
),
grand_total AS (
  SELECT SUM(total_cost)::NUMERIC as grand_sum FROM group_totals
)
SELECT 
  gt.process_group,
  gt.process_count,
  gt.dept_count,
  gt.total_payroll,
  gt.total_workspace,
  gt.total_other,
  gt.total_cost,
  ROUND(gt.total_cost / NULLIF(grt.grand_sum, 0) * 100, 2) as pct_of_total
FROM group_totals gt
CROSS JOIN grand_total grt;

COMMENT ON VIEW vw_process_group_summary IS 
  'Сводка по группам процессов с долей от общих затрат';

-- =============================================================================
-- VIEW 4: vw_department_costs_summary
-- Сводка по подразделениям
-- =============================================================================

CREATE VIEW vw_department_costs_summary AS
SELECT 
  dept_id,
  dept_name,
  MAX(number_of_employees)::INTEGER as employees,
  MAX(dept_total_costs)::BIGINT as dept_original_costs,
  SUM(allocated_total)::BIGINT as dept_allocated_costs,
  COUNT(DISTINCT process_id)::INTEGER as process_count,
  -- Проверка полноты распределения
  ROUND(
    SUM(allocated_total)::NUMERIC / NULLIF(MAX(dept_total_costs), 0) * 100, 
    1
  ) as allocation_completeness_pct
FROM vw_process_costs
GROUP BY dept_id, dept_name;

COMMENT ON VIEW vw_department_costs_summary IS 
  'Сводка по подразделениям с проверкой полноты распределения затрат';

-- =============================================================================
-- VIEW 5: vw_abc_classification
-- ABC классификация по процессам
-- =============================================================================

CREATE VIEW vw_abc_classification AS
SELECT 
  process_id,
  process_name,
  process_group,
  pcf_code,
  total_cost,
  pct_of_total,
  cumulative_pct,
  -- ABC Класс по правилу Парето 80/20
  CASE 
    WHEN cumulative_pct <= 80 THEN 'A'
    WHEN cumulative_pct <= 95 THEN 'B'
    ELSE 'C'
  END as abc_class,
  cost_rank
FROM vw_process_costs_summary
ORDER BY total_cost DESC;

COMMENT ON VIEW vw_abc_classification IS 
  'ABC классификация процессов по правилу Парето: A≤80%, B≤95%, C>95%';

-- =============================================================================
-- VIEW 6: vw_cost_structure_by_type
-- Структура затрат по типам (Payroll/Workspace/Other)
-- =============================================================================

CREATE VIEW vw_cost_structure_by_type AS
WITH totals AS (
  SELECT 
    SUM(total_payroll)::BIGINT as sum_payroll,
    SUM(total_workspace)::BIGINT as sum_workspace,
    SUM(total_other)::BIGINT as sum_other
  FROM vw_process_costs_summary
),
with_grand AS (
  SELECT 
    sum_payroll,
    sum_workspace,
    sum_other,
    (sum_payroll + sum_workspace + sum_other)::NUMERIC as grand_total
  FROM totals
)
SELECT 
  'Зарплаты'::TEXT as cost_type,
  sum_payroll as total_amount,
  ROUND(sum_payroll / NULLIF(grand_total, 0) * 100, 2) as percentage,
  1 as sort_order
FROM with_grand

UNION ALL

SELECT 
  'Помещения'::TEXT as cost_type,
  sum_workspace as total_amount,
  ROUND(sum_workspace / NULLIF(grand_total, 0) * 100, 2) as percentage,
  2 as sort_order
FROM with_grand

UNION ALL

SELECT 
  'Прочие'::TEXT as cost_type,
  sum_other as total_amount,
  ROUND(sum_other / NULLIF(grand_total, 0) * 100, 2) as percentage,
  3 as sort_order
FROM with_grand

ORDER BY sort_order;

COMMENT ON VIEW vw_cost_structure_by_type IS 
  'Структура общих затрат по типам: Зарплаты, Помещения, Прочие';

-- =============================================================================
-- VIEW 7: vw_department_process_matrix
-- Матрица распределения затрат: подразделения × процессы
-- =============================================================================

CREATE VIEW vw_department_process_matrix AS
WITH process_group_costs AS (
  SELECT 
    dept_id,
    process_group,
    SUM(allocated_total)::BIGINT as group_allocated_total
  FROM vw_process_costs
  WHERE process_group IS NOT NULL
  GROUP BY dept_id, process_group
)
SELECT 
  dc.dept_id,
  dc.dept_name,
  dc.employees,
  dc.dept_original_costs,
  dc.dept_allocated_costs,
  dc.process_count,
  dc.allocation_completeness_pct,
  -- Список групп процессов с затратами
  ARRAY_AGG(
    DISTINCT pgc.process_group || ': ' || pgc.group_allocated_total::TEXT
    ORDER BY pgc.process_group || ': ' || pgc.group_allocated_total::TEXT
  ) FILTER (WHERE pgc.process_group IS NOT NULL) as process_group_distribution
FROM vw_department_costs_summary dc
LEFT JOIN process_group_costs pgc ON dc.dept_id = pgc.dept_id
GROUP BY 
  dc.dept_id, 
  dc.dept_name, 
  dc.employees, 
  dc.dept_original_costs, 
  dc.dept_allocated_costs, 
  dc.process_count, 
  dc.allocation_completeness_pct;

COMMENT ON VIEW vw_department_process_matrix IS 
  'Матрица распределения затрат подразделений по группам процессов';

-- =============================================================================
-- VIEW 8: vw_data_validation
-- Проверка качества данных и консистентности
-- =============================================================================

CREATE VIEW vw_data_validation AS
-- Общие затраты подразделений (исходные данные)
SELECT 
  'Departments Total'::TEXT as check_name, 
  SUM(total_costs)::NUMERIC as amount,
  'BOLT_Затраты_подразделений_H12025'::TEXT as source_table,
  1 as sort_order
FROM "BOLT_Затраты_подразделений_H12025"

UNION ALL

-- Распределённые затраты (результат)
SELECT 
  'Allocated Total'::TEXT as check_name, 
  SUM(allocated_total)::NUMERIC as amount,
  'vw_process_costs'::TEXT as source_table,
  2 as sort_order
FROM vw_process_costs

UNION ALL

-- Разница (для проверки полноты распределения)
SELECT 
  'Allocation Difference'::TEXT as check_name,
  (SELECT SUM(total_costs) FROM "BOLT_Затраты_подразделений_H12025") - 
  (SELECT SUM(allocated_total) FROM vw_process_costs) as amount,
  'calculated'::TEXT as source_table,
  3 as sort_order

UNION ALL

-- Количество активных драйверов затрат
SELECT 
  'Active Cost Drivers'::TEXT as check_name, 
  COUNT(*)::NUMERIC as amount,
  'Costs_Driver_by_BI'::TEXT as source_table,
  4 as sort_order
FROM "Costs_Driver_by_BI"
WHERE "Cost_Driver" IS NOT NULL AND "Cost_Driver" > 0

UNION ALL

-- Процессы без группы
SELECT 
  'Processes Without Group'::TEXT as check_name, 
  COUNT(*)::NUMERIC as amount,
  'Costs_Driver_by_BI'::TEXT as source_table,
  5 as sort_order
FROM "Costs_Driver_by_BI"
WHERE (process_group IS NULL OR process_group = '')
  AND "Cost_Driver" > 0

UNION ALL

-- Количество уникальных процессов
SELECT 
  'Unique Processes'::TEXT as check_name,
  COUNT(DISTINCT "Process ID")::NUMERIC as amount,
  'Costs_Driver_by_BI'::TEXT as source_table,
  6 as sort_order
FROM "Costs_Driver_by_BI"
WHERE "Cost_Driver" > 0

UNION ALL

-- Количество уникальных подразделений
SELECT 
  'Unique Departments'::TEXT as check_name,
  COUNT(DISTINCT "Department ID")::NUMERIC as amount,
  'Costs_Driver_by_BI'::TEXT as source_table,
  7 as sort_order
FROM "Costs_Driver_by_BI"
WHERE "Cost_Driver" > 0

UNION ALL

-- Дубликаты Process-Department
SELECT 
  'Duplicate Process-Dept Pairs'::TEXT as check_name,
  COALESCE(
    (SELECT COUNT(*) FROM (
      SELECT "Process ID", "Department ID"
      FROM "Costs_Driver_by_BI"
      WHERE "Cost_Driver" > 0
      GROUP BY "Process ID", "Department ID"
      HAVING COUNT(*) > 1
    ) dup),
    0
  )::NUMERIC as amount,
  'Costs_Driver_by_BI'::TEXT as source_table,
  8 as sort_order

ORDER BY sort_order;

COMMENT ON VIEW vw_data_validation IS 
  'Проверка качества данных: сверка итогов, поиск дубликатов и пропусков';

-- =============================================================================
-- ФУНКЦИЯ: fn_get_top_processes
-- Получение ТОП-N процессов по затратам
-- =============================================================================

DROP FUNCTION IF EXISTS fn_get_top_processes(INTEGER);

CREATE FUNCTION fn_get_top_processes(top_count INTEGER DEFAULT 10)
RETURNS TABLE (
  out_process_id TEXT,
  out_process_name TEXT,
  out_process_group TEXT,
  out_pcf_code TEXT,
  out_total_cost BIGINT,
  out_pct_of_total NUMERIC,
  out_cumulative_pct NUMERIC,
  out_abc_class TEXT,
  out_cost_rank INTEGER
) 
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.process_id,
    v.process_name,
    v.process_group,
    v.pcf_code,
    v.total_cost,
    v.pct_of_total,
    v.cumulative_pct,
    v.abc_class,
    v.cost_rank
  FROM vw_abc_classification v
  ORDER BY v.total_cost DESC
  LIMIT top_count;
END;
$$;

COMMENT ON FUNCTION fn_get_top_processes IS 
  'Возвращает ТОП-N процессов по затратам с ABC-классификацией';

-- =============================================================================
-- ФУНКЦИЯ: fn_get_process_cost_details
-- Детализация затрат конкретного процесса по подразделениям
-- =============================================================================

DROP FUNCTION IF EXISTS fn_get_process_cost_details(TEXT);

CREATE FUNCTION fn_get_process_cost_details(p_process_id TEXT)
RETURNS TABLE (
  out_dept_id TEXT,
  out_dept_name TEXT,
  out_allocation_rate NUMERIC,
  out_allocated_payroll BIGINT,
  out_allocated_workspace BIGINT,
  out_allocated_other BIGINT,
  out_allocated_total BIGINT,
  out_dept_employees INTEGER,
  out_pct_of_process NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_process_total BIGINT;
BEGIN
  -- Получаем общую сумму по процессу для расчёта долей
  SELECT SUM(allocated_total) INTO v_process_total
  FROM vw_process_costs
  WHERE process_id = p_process_id;

  RETURN QUERY
  SELECT 
    pc.dept_id,
    pc.dept_name,
    pc.allocation_rate::NUMERIC,
    pc.allocated_payroll,
    pc.allocated_workspace,
    pc.allocated_other,
    pc.allocated_total,
    pc.number_of_employees::INTEGER,
    ROUND(pc.allocated_total::NUMERIC / NULLIF(v_process_total, 0) * 100, 2)
  FROM vw_process_costs pc
  WHERE pc.process_id = p_process_id
  ORDER BY pc.allocated_total DESC;
END;
$$;

COMMENT ON FUNCTION fn_get_process_cost_details IS 
  'Возвращает детализацию затрат процесса по подразделениям';

-- =============================================================================
-- ФУНКЦИЯ: fn_get_abc_summary
-- Сводка по ABC-классам
-- =============================================================================

DROP FUNCTION IF EXISTS fn_get_abc_summary();

CREATE FUNCTION fn_get_abc_summary()
RETURNS TABLE (
  out_abc_class TEXT,
  out_process_count INTEGER,
  out_total_cost BIGINT,
  out_pct_of_total NUMERIC,
  out_avg_cost_per_process BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_grand_total BIGINT;
BEGIN
  SELECT SUM(total_cost) INTO v_grand_total FROM vw_abc_classification;

  RETURN QUERY
  SELECT 
    abc_class,
    COUNT(*)::INTEGER,
    SUM(total_cost)::BIGINT,
    ROUND(SUM(total_cost)::NUMERIC / NULLIF(v_grand_total, 0) * 100, 2),
    (SUM(total_cost) / NULLIF(COUNT(*), 0))::BIGINT
  FROM vw_abc_classification
  GROUP BY abc_class
  ORDER BY 
    CASE abc_class 
      WHEN 'A' THEN 1 
      WHEN 'B' THEN 2 
      ELSE 3 
    END;
END;
$$;

COMMENT ON FUNCTION fn_get_abc_summary IS 
  'Возвращает сводку по ABC-классам: количество процессов и суммы затрат';

-- =============================================================================
-- ФУНКЦИЯ: fn_search_processes
-- Поиск процессов по имени или коду
-- =============================================================================

DROP FUNCTION IF EXISTS fn_search_processes(TEXT, INTEGER);

CREATE FUNCTION fn_search_processes(
  p_search_term TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  out_process_id TEXT,
  out_process_name TEXT,
  out_process_group TEXT,
  out_pcf_code TEXT,
  out_total_cost BIGINT,
  out_abc_class TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.process_id,
    v.process_name,
    v.process_group,
    v.pcf_code,
    v.total_cost,
    v.abc_class
  FROM vw_abc_classification v
  WHERE 
    v.process_name ILIKE '%' || p_search_term || '%'
    OR v.pcf_code ILIKE '%' || p_search_term || '%'
    OR v.process_id ILIKE '%' || p_search_term || '%'
  ORDER BY v.total_cost DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION fn_search_processes IS 
  'Поиск процессов по имени, PCF-коду или ID';

-- =============================================================================
-- ПРОФИЛИРОВАНИЕ ЗАПРОСОВ (Phase 0.3)
-- Цель: время ответа < 500ms для 127 процессов
-- =============================================================================

-- Проверка производительности основных views:
-- EXPLAIN ANALYZE SELECT * FROM vw_abc_classification LIMIT 10;
-- EXPLAIN ANALYZE SELECT * FROM vw_process_costs_summary;
-- EXPLAIN ANALYZE SELECT * FROM fn_get_top_processes(20);

-- =============================================================================
-- ПРОВЕРОЧНЫЙ ЗАПРОС (выполнить после создания всех объектов)
-- =============================================================================

-- Раскомментируйте для проверки:
/*
-- Проверка VIEW
SELECT 'vw_process_costs' as view_name, COUNT(*) as row_count FROM vw_process_costs
UNION ALL
SELECT 'vw_process_costs_summary', COUNT(*) FROM vw_process_costs_summary
UNION ALL
SELECT 'vw_process_group_summary', COUNT(*) FROM vw_process_group_summary
UNION ALL
SELECT 'vw_department_costs_summary', COUNT(*) FROM vw_department_costs_summary
UNION ALL
SELECT 'vw_abc_classification', COUNT(*) FROM vw_abc_classification
UNION ALL
SELECT 'vw_cost_structure_by_type', COUNT(*) FROM vw_cost_structure_by_type
UNION ALL
SELECT 'vw_department_process_matrix', COUNT(*) FROM vw_department_process_matrix
UNION ALL
SELECT 'vw_data_validation', COUNT(*) FROM vw_data_validation;

-- Проверка валидации данных
SELECT * FROM vw_data_validation ORDER BY sort_order;

-- Проверка ABC распределения
SELECT * FROM fn_get_abc_summary();

-- Топ-5 процессов
SELECT * FROM fn_get_top_processes(5);
*/

-- =============================================================================
-- ПРАВА ДОСТУПА (раскомментировать и настроить под вашу схему)
-- =============================================================================

/*
-- Для authenticated пользователей Supabase
GRANT SELECT ON vw_process_costs TO authenticated;
GRANT SELECT ON vw_process_costs_summary TO authenticated;
GRANT SELECT ON vw_process_group_summary TO authenticated;
GRANT SELECT ON vw_department_costs_summary TO authenticated;
GRANT SELECT ON vw_abc_classification TO authenticated;
GRANT SELECT ON vw_cost_structure_by_type TO authenticated;
GRANT SELECT ON vw_department_process_matrix TO authenticated;
GRANT SELECT ON vw_data_validation TO authenticated;

GRANT EXECUTE ON FUNCTION fn_get_top_processes TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_process_cost_details TO authenticated;
GRANT EXECUTE ON FUNCTION fn_get_abc_summary TO authenticated;
GRANT EXECUTE ON FUNCTION fn_search_processes TO authenticated;

-- Для анонимных пользователей (если нужен публичный доступ)
-- GRANT SELECT ON vw_abc_classification TO anon;
*/

-- =============================================================================
-- КОНЕЦ ФАЙЛА
-- =============================================================================