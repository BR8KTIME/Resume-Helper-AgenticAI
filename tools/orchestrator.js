/**
 * orchestrator.js
 * 
 * Pipeline Orchestrator for Resume-Helper-AgenticAI
 * 
 * Usage:
 *   node tools/orchestrator.js
 */

function run() {
  console.log('====================================================');
  console.log('🚀 Resume-Helper-AgenticAI Pipeline Entrypoint');
  console.log('====================================================');
  console.log('Use "npm test" to run regression tests across tests/test_cases.json');
  console.log('Use "node tools/verify_essay.js --text <content>" to verify essays.');
  console.log('====================================================');
}

run();
