/**
 * test_hard_vs_heuristic.js
 * 
 * Hard Constraints vs Heuristic Signals 직교성 및 경계 조건(Boundary Conditions) 회귀 테스트 스위트
 * 
 * [Part 1: 직교성 검증 (TC01 ~ TC06)]
 * TC01: 글자수 초과 ➔ FAIL
 * TC02: 바이트 초과 ➔ FAIL
 * TC03: 금지/클리셰 표현만 존재 ➔ PASS + WARNING
 * TC04: 문장 길이 균일성만 존재 ➔ PASS + WARNING
 * TC05: 글자수 초과 + 클리셰 ➔ FAIL + WARNING (핵심 직교성)
 * TC06: Hard Constraint 모두 통과 ➔ PASS + warningCount 0
 * 
 * [Part 2: 경계 조건(Boundary Conditions) 정밀 검증 (BC01 ~ BC06)]
 * BC01: 상한 경계값 정합 (Exact Max Bound: 500자 / max 500) ➔ PASS
 * BC02: 상한 1자 초과 경계 결함 (Off-by-One Max Violation: 501자 / max 500) ➔ FAIL
 * BC03: 하한 경계값 정합 (Exact Min Bound: 300자 / min 300) ➔ PASS
 * BC04: 하한 1자 미달 경계 결함 (Off-by-One Min Violation: 299자 / min 300) ➔ FAIL
 * BC05: 상한 경계값 정합 + 클리셰 검출 결합 (500자 / max 500 + '시너지') ➔ PASS + WARNING
 * BC06: 실제 인코딩 기준 바이트 경계값 정밀 검증 (EUC-KR & UTF-8 Buffer.byteLength)
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const scriptPath = fs.existsSync(path.resolve(__dirname, 'verify_essay.js'))
  ? path.resolve(__dirname, 'verify_essay.js')
  : path.resolve(__dirname, '../tools/verify_essay.js');

function runVerifier(args) {
  try {
    const cmd = `node "${scriptPath}" ${args} --json`;
    const stdout = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { exitCode: 0, json: JSON.parse(stdout) };
  } catch (err) {
    let json = null;
    try {
      json = JSON.parse(err.stdout);
    } catch (_) {}
    return { exitCode: err.status || 1, json };
  }
}

console.log('================================================================');
console.log('🧪 Hard Constraints vs Heuristic Signals & Boundary Regression Suite');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(tcId, name, condition, details) {
  if (condition) {
    console.log(`✅ [${tcId}] ${name}: PASS`);
    passCount++;
  } else {
    console.error(`❌ [${tcId}] ${name}: FAIL`);
    console.error('   상세:', details);
    failCount++;
  }
}

// ====================================================================
// [Part 1: 직교성 검증 (Orthogonality Tests)]
// ====================================================================
console.log('--- [Part 1: Hard vs Heuristic 직교성 검증] ---');

// TC01: 글자수 초과 ➔ FAIL
{
  const text = '가'.repeat(150); // 150자
  const res = runVerifier(`--text "${text}" --max 100`);
  assert(
    'TC01',
    '글자수 초과 ➔ FAIL',
    res.exitCode === 1 && res.json.status === 'FAIL' && res.json.hard_constraints.passed === false && res.json.hard_constraints.violationCount > 0,
    res
  );
}

// TC02: 바이트 초과 ➔ FAIL
{
  const text = '가나다라마바사아자차'; // 한글 10자 = EUC-KR 20 바이트
  const res = runVerifier(`--text "${text}" --max 15 --type byte`);
  assert(
    'TC02',
    '바이트 초과 ➔ FAIL',
    res.exitCode === 1 && res.json.status === 'FAIL' && res.json.hard_constraints.passed === false,
    res
  );
}

// TC03: 금지/클리셰 표현만 존재 ➔ PASS + WARNING
{
  const text = '저희는 팀원들과 시너지를 발휘하여 프로젝트를 성공적으로 완수했습니다.'; // 39자, '시너지' 포함
  const res = runVerifier(`--text "${text}" --max 100`);
  assert(
    'TC03',
    '금지/클리셰 표현만 존재 ➔ PASS + WARNING',
    res.exitCode === 0 && res.json.status === 'PASS' && res.json.hard_constraints.passed === true && res.json.quality_signals.warningCount > 0 && res.json.quality_signals.warnings.some(w => w.type === 'CLICHE'),
    res
  );
}

// TC04: 문장 길이 균일성만 존재 ➔ PASS + WARNING
{
  const s1 = '소프트웨어 엔지니어로서 네트워크 시스템의 안정성을 확보하기 위해 다양한 테스트를 수행했습니다.'.slice(0, 50);
  const s2 = '운영체제 커널의 프로세스 동기화 메커니즘을 분석하고 동시성 병목을 체계적으로 해결했습니다.'.slice(0, 50);
  const s3 = '분산 환경에서 발생하는 패킷 손실을 방지하기 위해 재전송 알고리즘과 타이머를 최적화했습니다.'.slice(0, 50);
  const s4 = '체계적인 로그 분석을 통해 예기치 못한 런타임 오류의 근본 원인을 파악하고 정상화했습니다.'.slice(0, 50);
  const text = `${s1}. ${s2}. ${s3}. ${s4}.`;
  const res = runVerifier(`--text "${text}" --max 500`);
  assert(
    'TC04',
    '문장 길이 균일성만 존재 ➔ PASS + WARNING',
    res.exitCode === 0 && res.json.status === 'PASS' && res.json.hard_constraints.passed === true && res.json.quality_signals.warnings.some(w => w.type === 'SENTENCE_VARIANCE'),
    res
  );
}

// TC05: 글자수 초과 + 클리셰 ➔ FAIL + WARNING (직교성 핵심 증명!)
{
  const text = '시너지를 창출하며 '.repeat(10); // 100자 이상 + '시너지' 다수
  const res = runVerifier(`--text "${text}" --max 50`);
  assert(
    'TC05',
    '글자수 초과 + 클리셰 ➔ FAIL + WARNING',
    res.exitCode === 1 && res.json.status === 'FAIL' && res.json.hard_constraints.passed === false && res.json.quality_signals.warningCount > 0,
    res
  );
}

// TC06: Hard Constraint 모두 통과 (클리셰/단조로움 제로) ➔ PASS + warningCount 0
{
  const text = '단문입니다. 네트워크 통신 패킷 전송을 위해 리눅스 소켓 프로그래밍을 활용하여 서버 파이프라인을 구축했습니다.';
  const res = runVerifier(`--text "${text}" --max 200`);
  assert(
    'TC06',
    'Hard Constraint 모두 통과 ➔ PASS + warningCount 0',
    res.exitCode === 0 && res.json.status === 'PASS' && res.json.hard_constraints.passed === true && res.json.quality_signals.warningCount === 0,
    res
  );
}

// ====================================================================
// [Part 2: 경계 조건(Boundary Conditions) 정밀 검증]
// ====================================================================
console.log('\n--- [Part 2: 경계 조건(Boundary Conditions) 정밀 검증] ---');

// BC01: 상한 경계값 정합 (Exact Max Bound: 500자 / max 500) ➔ PASS
{
  const text = 'a'.repeat(500);
  const res = runVerifier(`--text "${text}" --max 500`);
  assert(
    'BC01',
    '상한 경계값 정합 (Exact 500 / Max 500) ➔ PASS',
    res.exitCode === 0 && res.json.status === 'PASS' && res.json.metrics.charWithSpaces === 500 && res.json.hard_constraints.passed === true,
    res
  );
}

// BC02: 상한 1자 초과 경계 결함 (Off-by-One Max Violation: 501자 / max 500) ➔ FAIL
{
  const text = 'a'.repeat(501);
  const res = runVerifier(`--text "${text}" --max 500`);
  const hasExpectedViolation = res.json && res.json.hard_constraints.violations.some(v => v.includes('1 초과'));
  assert(
    'BC02',
    '상한 1자 초과 경계 결함 (Off-by-One: 501 / Max 500) ➔ FAIL (Delta: +1)',
    res.exitCode === 1 && res.json.status === 'FAIL' && res.json.metrics.charWithSpaces === 501 && hasExpectedViolation,
    res
  );
}

// BC03: 하한 경계값 정합 (Exact Min Bound: 300자 / min 300) ➔ PASS
{
  const text = 'b'.repeat(300);
  const res = runVerifier(`--text "${text}" --min 300 --max 500`);
  assert(
    'BC03',
    '하한 경계값 정합 (Exact 300 / Min 300) ➔ PASS',
    res.exitCode === 0 && res.json.status === 'PASS' && res.json.metrics.charWithSpaces === 300 && res.json.hard_constraints.passed === true,
    res
  );
}

// BC04: 하한 1자 미달 경계 결함 (Off-by-One Min Violation: 299자 / min 300) ➔ FAIL
{
  const text = 'b'.repeat(299);
  const res = runVerifier(`--text "${text}" --min 300 --max 500`);
  const hasMinViolation = res.json && res.json.hard_constraints.violations.some(v => v.includes('최소 기준 미달'));
  assert(
    'BC04',
    '하한 1자 미달 경계 결함 (Off-by-One: 299 / Min 300) ➔ FAIL',
    res.exitCode === 1 && res.json.status === 'FAIL' && res.json.metrics.charWithSpaces === 299 && hasMinViolation,
    res
  );
}

// BC05: 상한 경계값 정합 + 클리셰 검출 결합 (500자 / max 500 + '시너지') ➔ PASS + WARNING
{
  // 500자 텍스트 중 '시너지' 단어 포함
  const filler = '가'.repeat(497);
  const text = `${filler}시너지`; // 정확히 500자
  const res = runVerifier(`--text "${text}" --max 500`);
  assert(
    'BC05',
    '상한 경계값 정합(500자) + 클리셰 감지 결합 ➔ PASS + WARNING',
    res.exitCode === 0 && res.json.status === 'PASS' && res.json.metrics.charWithSpaces === 500 && res.json.hard_constraints.passed === true && res.json.quality_signals.warningCount > 0,
    res
  );
}

// BC06: 실제 인코딩 기준 바이트 경계값 정밀 검증 (EUC-KR 및 UTF-8 Buffer.byteLength)
{
  // EUC-KR: 한글 50자 = 100 바이트
  const hangul50 = '한'.repeat(50);
  const resEucKrPass = runVerifier(`--text "${hangul50}" --max 100 --type byte`);
  const resEucKrFail = runVerifier(`--text "${hangul50}a" --max 100 --type byte`); // 101바이트

  // UTF-8: Buffer.byteLength 검증 (한글 10자 = 30바이트, ASCII 10자 = 10바이트 ➔ 총 40바이트)
  const mixedStr = '가나다라마바사아자차1234567890';
  const resUtf8Pass = runVerifier(`--text "${mixedStr}" --max 40 --type utf8`);
  const resUtf8Fail = runVerifier(`--text "${mixedStr}x" --max 40 --type utf8`); // 41바이트

  const isEucKrBoundaryCorrect = resEucKrPass.exitCode === 0 && resEucKrPass.json.metrics.bytesEucKr === 100 && resEucKrFail.exitCode === 1 && resEucKrFail.json.metrics.bytesEucKr === 101;
  const isUtf8BoundaryCorrect = resUtf8Pass.exitCode === 0 && resUtf8Pass.json.metrics.bytesUtf8 === 40 && resUtf8Fail.exitCode === 1 && resUtf8Fail.json.metrics.bytesUtf8 === 41;

  assert(
    'BC06',
    '실제 인코딩 기준 바이트 경계값 정밀 검증 (EUC-KR & UTF-8)',
    isEucKrBoundaryCorrect && isUtf8BoundaryCorrect,
    { resEucKrPass, resEucKrFail, resUtf8Pass, resUtf8Fail }
  );
}

// ====================================================================
// [종합 통계 리포트]
// ====================================================================
console.log('\n================================================================');
console.log(`📊 테스트 결과: 총 ${passCount + failCount}개 | 통과: ${passCount}개 | 실패: ${failCount}개`);
console.log(`🎯 패스율: ${Math.round((passCount / (passCount + failCount)) * 100)}%`);
console.log('================================================================');

if (failCount > 0) {
  process.exit(1);
}
