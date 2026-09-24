/**
 * run_tests.js
 * 
 * Automated Test Runner for Resume-Helper-AgenticAI
 * Executes regression tests against tests/test_cases.json
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testCasesPath = path.resolve(__dirname, 'test_cases.json');
const verifyToolPath = path.resolve(__dirname, '../tools/verify_essay.js');
const tempFilePath = path.resolve(__dirname, '.temp_test_input.txt');

if (!fs.existsSync(testCasesPath)) {
  console.error(`[Error] Test suite not found at: ${testCasesPath}`);
  process.exit(1);
}

const testCases = JSON.parse(fs.readFileSync(testCasesPath, 'utf-8'));

console.log('====================================================');
console.log('🧪 Running Resume-Helper-AgenticAI Test Suite');
console.log(`📁 Loaded ${testCases.length} test cases from tests/test_cases.json`);
console.log('====================================================\n');

let passedCount = 0;
let failedCount = 0;

testCases.forEach((tc, idx) => {
  console.log(`[Test ${idx + 1}/${testCases.length}] ID: ${tc.id} (${tc.domain})`);
  console.log(`• Question: ${tc.question}`);
  console.log(`• Limits  : Max ${tc.constraint.max} | Min ${tc.constraint.min} (${tc.constraint.type})`);

  try {
    fs.writeFileSync(tempFilePath, tc.sample_input, 'utf-8');
    const cmd = `node "${verifyToolPath}" --file "${tempFilePath}" --max ${tc.constraint.max} --min ${tc.constraint.min} --json`;
    const stdout = execSync(cmd, { encoding: 'utf-8' });
    const result = JSON.parse(stdout);

    if (result.status === tc.expected_status) {
      console.log(`👉 Result: ✅ PASS (Chars: ${result.metrics.charWithSpaces}, EUC-KR: ${result.metrics.bytesEucKr}B, Clichés: ${result.cliches.length})`);
      passedCount++;
    } else {
      console.log(`👉 Result: ❌ FAIL (Expected: ${tc.expected_status}, Got: ${result.status})`);
      result.violations.forEach(v => console.log(`   - Violation: ${v}`));
      failedCount++;
    }
  } catch (err) {
    console.log(`👉 Result: ❌ ERROR (${err.message})`);
    failedCount++;
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
  console.log('----------------------------------------------------');
});

console.log('\n====================================================');
console.log(`📊 Test Suite Summary: Total ${testCases.length} | Passed ${passedCount} | Failed ${failedCount}`);
console.log(`🎯 Pass Rate: ${Math.round((passedCount / testCases.length) * 100)}%`);
console.log('====================================================');

if (failedCount > 0) {
  process.exit(1);
}
