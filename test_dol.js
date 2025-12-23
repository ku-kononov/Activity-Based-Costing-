// Тестовый файл для проверки расчета DOL
// Запустите в браузере: node test_dol.js или вставьте в консоль браузера

// Тестовые данные (в тысячах рублей)
const testData = {
  revenue: 8600000,    // 8.6 млн руб
  variableCosts: 7500000, // 7.5 млн руб (COGS)
  fixedCosts: 770000,  // 0.77 млн руб
  operatingProfit: 320000, // 0.32 млн руб
};

function calculateDOL(revenue, variableCosts, operatingProfit) {
  const contributionMargin = revenue - variableCosts;
  const dol = contributionMargin / operatingProfit;

  console.log(`Revenue: ${(revenue/1000).toFixed(1)} млн руб`);
  console.log(`Variable Costs: ${(variableCosts/1000).toFixed(1)} млн руб`);
  console.log(`Contribution Margin: ${(contributionMargin/1000).toFixed(1)} млн руб`);
  console.log(`Operating Profit: ${(operatingProfit/1000).toFixed(1)} млн руб`);
  console.log(`DOL = ${contributionMargin} / ${operatingProfit} = ${dol.toFixed(2)}x`);

  return dol;
}

// Тест с нормальными данными
console.log('=== ТЕСТ С НОРМАЛЬНЫМИ ДАННЫМИ ===');
const dol1 = calculateDOL(testData.revenue, testData.variableCosts, testData.operatingProfit);

// Тест с маленьким operating profit
console.log('\n=== ТЕСТ С МАЛЕНЬКИМ OPERATING PROFIT ===');
const dol2 = calculateDOL(testData.revenue, testData.variableCosts, 10000); // 10 тыс руб

// Тест с нулевыми переменными затратами (fallback на COGS)
console.log('\n=== ТЕСТ С НУЛЕВЫМИ ПЕРЕМЕННЫМИ ЗАТРАТАМИ ===');
const dol3 = calculateDOL(testData.revenue, 0, testData.operatingProfit);

// Тест с отрицательным operating profit
console.log('\n=== ТЕСТ С ОТРИЦАТЕЛЬНЫМ OPERATING PROFIT ===');
const dol4 = calculateDOL(testData.revenue, testData.variableCosts, -100000);




