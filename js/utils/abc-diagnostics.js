// js/utils/abc-diagnostics.js
// Diagnostic tool for ABC data retrieval testing

import { getAbcProcesses, getProcessDetails, getAbcSummary, getValidationData } from '../services/abc-data.js';
import { supabase } from '../api.js';

export class AbcDiagnostics {
  constructor() {
    this.results = [];
    this.errors = [];
  }

  async runAllTests() {
    console.log('🔍 Запуск диагностики ABC модуля...');
    console.log('=' .repeat(50));
    
    await this.testSupabaseConnection();
    await this.testDatabaseFunctions();
    await this.testDataRetrieval();
    await this.testProcessDetails();
    await this.testValidationData();
    
    this.printReport();
  }

  async testSupabaseConnection() {
    console.log('\n📡 Тестирование подключения к Supabase...');
    try {
      const { data, error } = await supabase.from('abc_feature_flags').select('feature_name').limit(1);
      if (error) {
        this.addResult('Supabase Connection', false, error.message);
      } else {
        this.addResult('Supabase Connection', true, 'Подключение успешно');
      }
    } catch (err) {
      this.addResult('Supabase Connection', false, err.message);
    }
  }

  async testDatabaseFunctions() {
    console.log('\n🔧 Тестирование database функций...');
    
    // Test fn_get_abc_summary
    try {
      const summary = await getAbcSummary();
      this.addResult('fn_get_abc_summary', true, `Получено ${summary.length} записей`);
    } catch (err) {
      this.addResult('fn_get_abc_summary', false, err.message);
    }

    // Test search function
    try {
      const searchResults = await this.testSearch('тест');
      this.addResult('fn_search_processes', true, `Найдено ${searchResults.length} результатов`);
    } catch (err) {
      this.addResult('fn_search_processes', false, err.message);
    }
  }

  async testDataRetrieval() {
    console.log('\n📊 Тестирование получения данных...');
    
    // Test ABC processes
    try {
      const processes = await getAbcProcesses();
      this.addResult('getAbcProcesses()', true, `Загружено ${processes.length} процессов`);
      
      if (processes.length > 0) {
        console.log('📋 Пример процесса:', {
          id: processes[0].process_id,
          name: processes[0].process_name,
          cost: processes[0].total_cost,
          class: processes[0].abc_class
        });
      }
    } catch (err) {
      this.addResult('getAbcProcesses()', false, err.message);
    }

    // Test with filters
    try {
      const filteredProcesses = await getAbcProcesses({ abcClass: 'A', limit: 10 });
      this.addResult('getAbcProcesses(filters)', true, `Найдено ${filteredProcesses.length} процессов класса A`);
    } catch (err) {
      this.addResult('getAbcProcesses(filters)', false, err.message);
    }
  }

  async testProcessDetails() {
    console.log('\n🔍 Тестирование деталей процессов...');
    
    try {
      // Get first process ID
      const processes = await getAbcProcesses({ limit: 1 });
      if (processes.length === 0) {
        this.addResult('getProcessDetails', false, 'Нет доступных процессов');
        return;
      }

      const processId = processes[0].process_id;
      const details = await getProcessDetails(processId);
      
      this.addResult('getProcessDetails()', true, `Получено ${details.length} записей деталей для ${processId}`);
      
      if (details.length > 0) {
        console.log('📋 Пример детали:', {
          dept: details[0].out_dept_name,
          allocated: details[0].out_allocated_total,
          rate: details[0].out_allocation_rate
        });
      }
    } catch (err) {
      this.addResult('getProcessDetails()', false, err.message);
    }
  }

  async testValidationData() {
    console.log('\n✅ Тестирование валидации данных...');
    
    try {
      const validation = await getValidationData();
      this.addResult('getValidationData()', true, `Получено ${validation.length} проверок`);
      
      // Check for critical issues
      const deptTotal = validation.find(v => v.check_name === 'Departments Total');
      const allocatedTotal = validation.find(v => v.check_name === 'Allocated Total');
      
      if (deptTotal && allocatedTotal) {
        const difference = Math.abs(deptTotal.amount - allocatedTotal.amount);
        const pctDiff = (difference / deptTotal.amount * 100).toFixed(2);
        
        if (difference > deptTotal.amount * 0.05) {
          this.addResult('Data Consistency', false, `Разница ${pctDiff}% превышает 5%`);
        } else {
          this.addResult('Data Consistency', true, `Разница ${pctDiff}% в пределах нормы`);
        }
      }
    } catch (err) {
      this.addResult('getValidationData()', false, err.message);
    }
  }

  async testSearch(searchTerm) {
    try {
      const { data, error } = await supabase.rpc('fn_search_processes', {
        p_search_term: searchTerm,
        p_limit: 10
      });
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      throw err;
    }
  }

  addResult(testName, success, message) {
    this.results.push({ testName, success, message });
    const status = success ? '✅' : '❌';
    console.log(`${status} ${testName}: ${message}`);
    
    if (!success) {
      this.errors.push({ testName, message });
    }
  }

  printReport() {
    console.log('\n' + '=' .repeat(50));
    console.log('📋 ОТЧЕТ ПО ДИАГНОСТИКЕ');
    console.log('=' .repeat(50));
    
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`\n📊 Общая статистика:`);
    console.log(`   Всего тестов: ${totalTests}`);
    console.log(`   Успешно: ${passedTests} ✅`);
    console.log(`   Ошибки: ${failedTests} ❌`);
    console.log(`   Процент успеха: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (this.errors.length > 0) {
      console.log(`\n❌ Обнаруженные проблемы:`);
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.testName}: ${error.message}`);
      });
      
      console.log(`\n🔧 Рекомендации по исправлению:`);
      console.log(`   1. Проверьте подключение к Supabase`);
      console.log(`   2. Убедитесь, что все views и функции созданы в базе данных`);
      console.log(`   3. Проверьте права доступа к таблицам`);
      console.log(`   4. Запустите SQL скрипт для создания views и функций`);
    } else {
      console.log(`\n✅ Все тесты пройдены успешно! ABC модуль работает корректно.`);
    }
    
    console.log('\n🔍 Для запуска диагностики используйте:');
    console.log('   import { AbcDiagnostics } from "./utils/abc-diagnostics.js"');
    console.log('   const diag = new AbcDiagnostics();');
    console.log('   await diag.runAllTests();');
  }
}

// Автоматический запуск диагностики при импорте (только в development)
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  // Задержка для загрузки всех модулей
  setTimeout(async () => {
    console.log('🧪 Автоматический запуск ABC диагностики...');
    const diag = new AbcDiagnostics();
    await diag.runAllTests();
  }, 2000);
}