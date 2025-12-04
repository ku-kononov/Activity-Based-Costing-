// js/pages/analytics-tests.js
// Модульные тесты для analytics.js

// Импорт функций для тестирования
import { toMillions, toThousands, validateFinancialLogic, calculateRunRate, analyzeSeasonality } from './analytics.js';

// Тесты для унификации единиц
function testUnitConversion() {
  console.log('Testing unit conversion...');
  const testValue = 1000000; // 1 млн в тыс.
  const millions = toMillions(testValue);
  const backToThousands = toThousands(millions);

  if (millions === 1000 && backToThousands === testValue) {
    console.log('✅ Unit conversion tests passed');
  } else {
    console.error('❌ Unit conversion tests failed');
  }
}

// Тесты валидации
function testValidation() {
  console.log('Testing financial validation...');
  const validData = {
    revenue: 1000,
    gross: 300,
    ebitda: 200,
    operatingProfit: 150,
    netProfit: 100,
    depr: 50
  };

  const invalidData = {
    revenue: 1000,
    gross: 1500, // Gross > Revenue
    ebitda: 100,
    operatingProfit: 200, // EBITDA < Op Profit - Depr
    netProfit: 900, // Net > 80% Revenue
    depr: 50
  };

  const validWarnings = validateFinancialLogic(validData);
  const invalidWarnings = validateFinancialLogic(invalidData);

  if (validWarnings.length === 0 && invalidWarnings.length > 0) {
    console.log('✅ Validation tests passed');
  } else {
    console.error('❌ Validation tests failed');
  }
}

// Тесты run rate
function testRunRate() {
  console.log('Testing run rate calculations...');
  const monthlyValue = 100;
  const quarterlyValue = 300;
  const yearlyValue = 1200;

  const monthlyRunRate = calculateRunRate(monthlyValue, 'month');
  const quarterlyRunRate = calculateRunRate(quarterlyValue, 'quarter');
  const yearlyRunRate = calculateRunRate(yearlyValue, 'year');

  if (monthlyRunRate === 1200 && quarterlyRunRate === 1200 && yearlyRunRate === 1200) {
    console.log('✅ Run rate tests passed');
  } else {
    console.error('❌ Run rate tests failed');
  }
}

// Тесты сезонности
function testSeasonality() {
  console.log('Testing seasonality analysis...');
  const monthlyData = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210]; // 12 месяцев

  const seasonality = analyzeSeasonality(monthlyData);

  if (seasonality && seasonality.length === 12) {
    console.log('✅ Seasonality tests passed');
  } else {
    console.error('❌ Seasonality tests failed');
  }
}

// Запуск всех тестов
export function runAnalyticsTests() {
  console.log('🚀 Running analytics module tests...');
  testUnitConversion();
  testValidation();
  testRunRate();
  testSeasonality();
  console.log('🏁 Tests completed');
}

// Автоматический запуск в браузере
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    runAnalyticsTests();
  });
}