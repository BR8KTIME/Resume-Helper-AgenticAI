/**
 * verify_essay.js
 * 
 * 통합 자기소개서 글자 수, 바이트, 규격 및 안티-클리셰 정밀 검증 CLI 도구
 * 
 * 사용법:
 *   node verify_essay.js --file <경로> [--section <문항번호|키워드>] [--max <최대글자수>] [--min <최소글자수>] [--type <char|byte|euckr|utf8>] [--json]
 *   node verify_essay.js --text "검증할 본문 내용..." [--max <최대글자수>]
 */

const fs = require('fs');
const path = require('path');

// 금지어 및 AI 상투적 클리셰 리스트
const BANNED_PATTERNS = [
  { pattern: /열정을 다해/g, label: '진부한 열정 클리셰 ("열정을 다해")' },
  { pattern: /최선을 다해 밤을/g, label: '진부한 밤샘 클리셰 ("최선을 다해 밤을")' },
  { pattern: /100% 일치/g, label: '과장 수식어 ("100% 일치")' },
  { pattern: /치트키/g, label: '감정적/비공학적 비유 ("치트키")' },
  { pattern: /사기 캐릭터/g, label: '과장된 수식어 ("사기 캐릭터")' },
  { pattern: /적수가 없는/g, label: '과장된 수식어 ("적수가 없는")' },
  { pattern: /완벽하게 들어맞/g, label: '과장된 수식어 ("완벽하게 들어맞")' },
  { pattern: /피와 땀/g, label: '감성적 표현 ("피와 땀")' },
  { pattern: /뼈를 묻/g, label: '진부한 충성 클리셰 ("뼈를 묻")' },
  { pattern: /귀사/g, label: 'AI 전형 상투어 ("귀사" ➔ 사명 직접 명시 또는 생략)' },
  { pattern: /시너지/g, label: 'AI 전형 상투어 ("시너지" ➔ 구체적 보완/협업/정합성 대체)' },
  { pattern: /역량을 함양/g, label: 'AI 전형 상투어 ("역량을 함양" ➔ 배웠습니다/익혔습니다 대체)' },
  { pattern: /기여하고 싶습니다/g, label: 'AI 전형 종결 상투어 ("기여하고 싶습니다" ➔ 구체적 엔지니어링 행동/성장 종결)' },
  { pattern: /·/g, label: 'AI 특유 가운뎃점 ("·" ➔ "및", "와/과", 쉼표 대체)' },
  { pattern: /게이트키퍼/g, label: 'AI 번역투 어휘 ("게이트키퍼" ➔ 검증/디버깅 전담으로 대체)' },
  { pattern: /뼈대\s*코드|뼈대/g, label: 'AI 번역투 어휘 ("뼈대" ➔ 기본 틀/프로토타입으로 대체)' },
  { pattern: /폐루프/g, label: 'AI 과장 어휘 ("폐루프" ➔ 자동 검증 파이프라인으로 대체)' },
  { pattern: /개발\s*신뢰도/g, label: 'AI 억지 명사 압축 ("개발 신뢰도" ➔ 신뢰할 수 있는 소프트웨어로 대체)' },
  { pattern: /데이터\s*무결성/g, label: 'AI 억지 명사 압축 ("데이터 무결성" ➔ 정확한 결과/신뢰성으로 대체)' },
  { pattern: /미사여구/g, label: '어색한 문학적 어휘 ("미사여구" ➔ 과장된 표현/상투어로 대체)' }
];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    file: null,
    section: null,
    text: null,
    max: null,
    min: null,
    type: 'char', // 'char' (공백포함 글자수), 'nospace', 'byte' (euckr), 'utf8'
    json: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--file':
      case '-f':
        options.file = args[++i];
        break;
      case '--section':
      case '-s':
        options.section = args[++i];
        break;
      case '--text':
      case '-t':
        options.text = args[++i];
        break;
      case '--max':
      case '-m':
        options.max = parseInt(args[++i], 10);
        break;
      case '--min':
        options.min = parseInt(args[++i], 10);
        break;
      case '--type':
        options.type = args[++i];
        break;
      case '--json':
        options.json = true;
        break;
    }
  }

  return options;
}

function extractSectionContent(fullContent, sectionQuery) {
  if (!sectionQuery) return fullContent;

  const lines = fullContent.split('\n');
  const sectionLines = [];
  let capturing = false;
  let captureLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);

    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();

      if (capturing) {
        // 동일 레벨 이상의 새로운 헤더를 만나면 캡처 종료
        if (level <= captureLevel) {
          break;
        }
      }

      if (title.includes(sectionQuery) || (sectionQuery.match(/^\d+$/) && title.includes(`${sectionQuery}번`))) {
        capturing = true;
        captureLevel = level;
        continue;
      }
    }

    if (capturing) {
      sectionLines.push(line);
    }
  }

  if (sectionLines.length === 0) {
    throw new Error(`섹션 '${sectionQuery}'을(를) 파일에서 찾을 수 없습니다.`);
  }

  return sectionLines.join('\n').trim();
}

function calculateBytes(str, mode = 'euckr') {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    if (charCode <= 0x007f) {
      bytes += 1;
    } else if (mode === 'utf8') {
      bytes += 3;
    } else {
      // euckr 기준 한글/특수문자 2바이트
      bytes += 2;
    }
  }
  return bytes;
}

function findCliches(text) {
  const detected = [];
  for (const item of BANNED_PATTERNS) {
    const matches = text.match(item.pattern);
    if (matches) {
      detected.push({ label: item.label, count: matches.length });
    }
  }
  return detected;
}

function run() {
  const options = parseArgs();

  let targetText = '';

  if (options.text) {
    targetText = options.text;
  } else if (options.file) {
    const filePath = path.resolve(options.file);
    if (!fs.existsSync(filePath)) {
      console.error(`[오류] 파일을 찾을 수 없습니다: ${filePath}`);
      process.exit(1);
    }
    const rawContent = fs.readFileSync(filePath, 'utf-8');
    targetText = extractSectionContent(rawContent, options.section);
  } else {
    console.error('사용법: node verify_essay.js --file <경로> [--section <문항>] [--max <글자수>]');
    process.exit(1);
  }

  // 앞뒤 마크다운 코드블록이나 불필요한 공백 제거
  targetText = targetText.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '').trim();

  // 글자 수 및 바이트 계산
  const charWithSpaces = targetText.length;
  const charWithoutSpaces = targetText.replace(/\s/g, '').length;
  const bytesEucKr = calculateBytes(targetText, 'euckr');
  const bytesUtf8 = calculateBytes(targetText, 'utf8');

  // 클리셰 분석
  const detectedCliches = findCliches(targetText);

  // 규격 검증
  let pass = true;
  const violations = [];

  let primaryCount = charWithSpaces;
  let primaryUnit = '자(공백포함)';

  if (options.type === 'nospace') {
    primaryCount = charWithoutSpaces;
    primaryUnit = '자(공백제외)';
  } else if (options.type === 'byte' || options.type === 'euckr') {
    primaryCount = bytesEucKr;
    primaryUnit = 'Bytes (EUC-KR)';
  } else if (options.type === 'utf8') {
    primaryCount = bytesUtf8;
    primaryUnit = 'Bytes (UTF-8)';
  }

  if (options.max !== null) {
    if (primaryCount > options.max) {
      pass = false;
      violations.push(`최대 한도 초과: 현재 ${primaryCount} ${primaryUnit} / 기준 ${options.max} ${primaryUnit} (${primaryCount - options.max} 초과)`);
    }
  }

  if (options.min !== null) {
    if (primaryCount < options.min) {
      pass = false;
      violations.push(`최소 기준 미달: 현재 ${primaryCount} ${primaryUnit} / 기준 ${options.min} ${primaryUnit}`);
    }
  }

  if (detectedCliches.length > 0) {
    pass = false;
    detectedCliches.forEach(c => violations.push(`금지어/클리셰 검출: ${c.label} (${c.count}회)`));
  }

  // 문장별 길이 및 균일성(Variance) 정밀 분석
  const rawSentences = targetText
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const sentenceLengths = rawSentences.map(s => s.length);
  const minLen = sentenceLengths.length > 0 ? Math.min(...sentenceLengths) : 0;
  const maxLen = sentenceLengths.length > 0 ? Math.max(...sentenceLengths) : 0;
  const avgLen = sentenceLengths.length > 0 ? Math.round(sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length) : 0;

  // 문장 길이가 40~60자 사이에 90% 이상 갇혀있고 min/max 차이가 20자 미만이면 AI 단조로움 경고
  let isMonotonous = false;
  if (sentenceLengths.length >= 4 && (maxLen - minLen) <= 20 && avgLen >= 40 && avgLen <= 60) {
    isMonotonous = true;
    pass = false;
    violations.push(`🚨 AI식 기계적 문장 단조로움 적발: 모든 문장이 ${minLen}~${maxLen}자(평균 ${avgLen}자)로 지나치게 일관된 길이입니다. 단문(20~35자)과 복문(70~90자)의 호흡 완급을 조절하세요.`);
  }

  const result = {
    status: pass ? 'PASS' : 'FAIL',
    file: options.file || 'DIRECT_TEXT',
    section: options.section || 'ALL',
    metrics: {
      charWithSpaces,
      charWithoutSpaces,
      bytesEucKr,
      bytesUtf8
    },
    limits: {
      max: options.max,
      min: options.min,
      type: options.type
    },
    cliches: detectedCliches,
    violations
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // 콘솔 포맷 출력
  console.log('====================================================');
  console.log(`🔍 [verify_essay] 검증 결과: ${pass ? '✅ PASS' : '❌ FAIL'}`);
  console.log('====================================================');
  console.log(`• 파일/섹션: ${result.file} [${result.section}]`);
  console.log(`• 공백 포함 글자수: ${charWithSpaces.toLocaleString()} 자`);
  console.log(`• 공백 제외 글자수: ${charWithoutSpaces.toLocaleString()} 자`);
  console.log(`• 바이트수 (EUC-KR 2byte): ${bytesEucKr.toLocaleString()} Bytes`);
  console.log(`• 바이트수 (UTF-8 3byte) : ${bytesUtf8.toLocaleString()} Bytes`);
  
  if (detectedCliches.length > 0) {
    console.log('🚨 금지 표현 감지:');
    detectedCliches.forEach(c => console.log(`   - ${c.label} (${c.count}회)`));
  } else {
    console.log('• 금지어/클리셰: 이상 없음 (Clean)');
  }

  // 문장별 리듬감(호흡) 통계 출력
  console.log(`• 문장 호흡/리듬감: 총 ${rawSentences.length}개 문장 (최단 ${minLen}자 ~ 최장 ${maxLen}자 / 평균 ${avgLen}자) ${isMonotonous ? '❌ AI 단조로움' : '✅ 양호'}`);
  console.log(`  - 문장별 길이: [${sentenceLengths.map(l => l + '자').join(', ')}]`);

  if (violations.length > 0) {
    console.log('----------------------------------------------------');
    console.log('❌ 위반 및 보완 항목:');
    violations.forEach(v => console.log(`   - ${v}`));
  }
  console.log('====================================================');

  if (!pass) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  run();
}

module.exports = {
  BANNED_PATTERNS,
  calculateBytes,
  findCliches,
  run
};
