# План миграции ABC модуля в продакшн

## 1. ПРЕДВАРИТЕЛЬНЫЕ ТРЕБОВАНИЯ

### 1.1 Системные требования
- Supabase PostgreSQL 15+
- Node.js 18+ для deployment
- Доступ к Supabase dashboard

### 1.2 Доступы
- Admin доступ к Supabase project
- GitHub repository access
- VPN доступ к корпоративной сети (если требуется)

## 2. ПОДГОТОВКА ПРОДАКШН СРЕДЫ

### 2.1 Создание таблиц конфигурации
```sql
-- Выполнить в Supabase SQL Editor
\i sql_views_for_supabase.sql
```

### 2.2 Проверка создания объектов
```sql
-- Проверка таблиц
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'abc_%';

-- Проверка views
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public'
AND table_name LIKE 'vw_%';

-- Проверка функций
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE 'fn_%';
```

### 2.3 Настройка RLS политик
```sql
-- Включить RLS для таблиц конфигурации
ALTER TABLE abc_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE abc_feature_flags ENABLE ROW LEVEL SECURITY;

-- Политики для чтения (анонимные пользователи)
CREATE POLICY "Allow read access to abc_periods" ON abc_periods
FOR SELECT USING (is_active = true);

CREATE POLICY "Allow read access to abc_feature_flags" ON abc_feature_flags
FOR SELECT USING (true);
```

## 3. ДЕПЛОЙМЕНТ КОДА

### 3.1 Структура файлов для деплоя
```
production_files/
├── js/
│   ├── services/
│   │   └── abc-data.js
│   └── pages/
│       └── abc/
│           ├── processes.js
│           ├── pareto.js
│           ├── matrix.js
│           └── validation.js
├── sql/
│   └── views.sql (sql_views_for_supabase.sql)
└── styles/
    └── abc-styles.css (из costs.js)
```

### 3.2 Порядок обновления файлов
1. `js/services/abc-data.js` - новые функции
2. `js/pages/abc/*.js` - новые страницы
3. `js/pages/costs.js` - обновление модала
4. `styles.css` - новые стили

### 3.3 Проверка интеграции
- Проверить загрузку dashboard
- Проверить навигацию между страницами
- Проверить экспорт функций

## 4. КОНФИГУРАЦИЯ ПРОДАКШН

### 4.1 Feature Flags настройка
```sql
-- Включить основные функции
UPDATE abc_feature_flags
SET is_enabled = true, rollout_percentage = 100
WHERE feature_name IN (
  'abc_dashboard', 'abc_processes', 'abc_pareto',
  'abc_matrix', 'abc_validation', 'export_excel', 'export_pdf'
);

-- Отключить экспериментальные функции
UPDATE abc_feature_flags
SET is_enabled = false
WHERE feature_name IN ('period_selector', 'abc_departments', 'abc_cost_structure');
```

### 4.2 Периоды по умолчанию
```sql
-- Активировать H1_2025 как основной период
UPDATE abc_periods
SET is_active = true
WHERE period_code = 'H1_2025';
```

## 5. ТЕСТИРОВАНИЕ ПРОДАКШН

### 5.1 Функциональное тестирование
- [ ] Загрузка dashboard с KPI
- [ ] Открытие модала ABC
- [ ] Навигация к страницам анализа
- [ ] Фильтры и поиск на страницах
- [ ] Экспорт в Excel/PDF
- [ ] Мобильная адаптация

### 5.2 Производительность
- [ ] Время загрузки страниц < 3 сек
- [ ] API response time < 1 сек
- [ ] Память < 100MB при активном использовании

### 5.3 UAT сценарии
1. CFO просмотр dashboard
2. Аналитик drill-down по процессам
3. Экспорт отчета для презентации
4. Проверка на мобильном устройстве

## 6. МОНИТОРИНГ И ПОДДЕРЖКА

### 6.1 Метрики для мониторинга
```sql
-- Запросы для ежедневного мониторинга
SELECT
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as page_views
FROM abc_usage_logs
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;

-- Проверка ошибок API
SELECT
  error_type,
  COUNT(*) as count,
  MAX(created_at) as last_error
FROM abc_error_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_type;
```

### 6.2 План отката
1. Отключить feature flags
2. Восстановить предыдущую версию файлов
3. Очистить новые таблицы (опционально)

### 6.3 Поддержка пользователей
- Документация в Confluence
- FAQ по ABC анализу
- Контакты технической поддержки

## 7. РИСК-МЕНЕДЖМЕНТ

### 7.1 Риски и mitigation
| Риск | Вероятность | Mitigation |
|------|-------------|------------|
| Проблемы с данными | Средняя | Тестирование на staging, валидация данных |
| Производительность | Низкая | Кеширование, оптимизация запросов |
| UI/UX проблемы | Низкая | UAT тестирование |
| Браузерная совместимость | Низкая | Тестирование в Chrome/Edge |

### 7.2 Критические точки отказа
- Supabase downtime
- JavaScript errors в браузере
- Проблемы с экспортом файлов

## 8. ПОСЛЕДУЮЩИЕ ШАГИ

### 8.1 Неделя 1-2 после релиза
- Мониторинг использования
- Сбор обратной связи
- Исправление выявленных багов

### 8.2 Неделя 3-4
- Включение дополнительных модулей
- Добавление периодов
- Улучшение UX

### 8.3 Месяц 2
- Расширенная аналитика
- Интеграция с другими модулями
- API для внешних систем

---

**Подготовлено:** 2025-12-08
**Статус:** Ready for Production Deployment
**Контакт:** Команда разработки ABC