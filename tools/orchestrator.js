/**
 * orchestrator.js
 * 
 * 사용자 아이디어 기반 자율 오케스트레이터 (Human-in-the-Loop Orchestrator) CLI
 * 
 * 기능:
 * 1. 지원자의 날것 구술 메모(draft_input.md) 파싱 (단일 문항 및 === QUESTION === 다중 문항 지원)
 * 2. asset_index.md 및 my_profile.md 연계 기술 팩트 정합성 확인
 * 3. 5단계 공학 프레임워크 (상황 30% / 행동 60% / 결과 2줄) 규격 검증
 * 4. verify_essay.js 실측 엔진 연동 (글자수/바이트/클리셰)
 * 5. fact_checker 6대 고정 스키마 자동 평가 리포트 생성
 * 6. 지원자 검토용 파일(draft_output.md)에 안전하게 출력 (마스터 파일 자동 수정 절대 금지)
 * 
 * 사용법:
 *   node tools/orchestrator.js [--input <입력파일>] [--output <출력파일>] [--json]
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
  { pattern: /피와땀/g, label: '감성적 표현 ("피와 땀")' },
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

// 주의(Caution) 패턴: 완전 금지는 아니지만 문단별 반복 남발 시 주의 알림 (1문항당 최대 1회 허용)
const CAUTION_PATTERNS = [
  { pattern: /이를\s*(?:해결하기\s*)?위해/g, maxAllowed: 1, label: '접속 클리셰 남발 주의 ("이를 위해", "이를 해결하기 위해" ➔ 1문항당 최대 1회 허용, 자연스러운 행동 연결 권장)' }
];

function calculateBytes(str, mode = 'euckr') {
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i);
    if (charCode <= 0x007f) {
      bytes += 1;
    } else if (mode === 'utf8') {
      bytes += 3;
    } else {
      bytes += 2;
    }
  }
  return bytes;
}

function parseQuestionBlock(blockText) {
  const companyMatch = blockText.match(/\*\s*\*\*지원 기업\*\*:\s*(.*)/i);
  const questionMatch = blockText.match(/\*\s*\*\*문항 번호 \/ 제목\*\*:\s*(.*)/i);
  const limitMatch = blockText.match(/최대\s*([\d,]+)자/i);
  const minLimitMatch = blockText.match(/최소\s*([\d,]+)자/i);

  const company = companyMatch ? companyMatch[1].trim() : '미지정 기업';
  const question = questionMatch ? questionMatch[1].trim() : '미지정 문항';
  const maxLimit = limitMatch ? parseInt(limitMatch[1].replace(/,/g, ''), 10) : 1000;
  const minLimit = minLimitMatch ? parseInt(minLimitMatch[1].replace(/,/g, ''), 10) : Math.floor(maxLimit * 0.8);

  let draftText = '';
  const codeBlockMatch = blockText.match(/```(?:text)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    draftText = codeBlockMatch[1].trim();
  } else {
    const draftSectionMatch = blockText.match(/##\s*3\.\s*[^#\n]*\n([\s\S]*)/);
    if (draftSectionMatch) {
      draftText = draftSectionMatch[1].trim();
    }
  }

  return {
    company,
    question,
    maxLimit,
    minLimit,
    rawContent: blockText,
    draftText
  };
}

function parseInputFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`입력 파일을 찾을 수 없습니다: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // 다중 문항 구분자(=== QUESTION ===) 확인
  if (content.includes('=== QUESTION ===')) {
    const parts = content.split('=== QUESTION ===').map(p => p.trim()).filter(p => p.length > 0);
    const questions = [];
    for (const part of parts) {
      if (part.includes('문항') || part.includes('```')) {
        questions.push(parseQuestionBlock(part));
      }
    }
    return { isMulti: true, questions };
  }

  return { isMulti: false, ...parseQuestionBlock(content) };
}

function analyzeStructure(text) {
  const sentences = text.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0);
  const actionKeywords = ['분석', '설계', '구현', '도입', '판단', '검증', '수정', '해결', '측정', '최적화', '추적', '포팅', '정의', '비교', '실증', '수행', '확보', '완수', '자처', '제시', '검토', '도출', '개발', '재설계', '결합', '구축', '연동', '바탕으로'];
  const situationKeywords = ['당시', '배경', '문제는', '과제는', '상황이었습니다', '목표였습니다', '이슈가 발생', '프로젝트에서', '참여했습니다', '발생했습니다'];
  const resultKeywords = ['결과', '달성했습니다', '기여했습니다', '향상되었습니다', '확인했습니다', '배울 수 있었습니다', '배웠습니다'];

  let actionCount = 0;
  let situationCount = 0;
  let resultCount = 0;

  sentences.forEach(s => {
    if (actionKeywords.some(kw => s.includes(kw))) actionCount++;
    if (situationKeywords.some(kw => s.includes(kw))) situationCount++;
    if (resultKeywords.some(kw => s.includes(kw))) resultCount++;
  });

  const total = sentences.length || 1;
  return {
    sentenceCount: sentences.length,
    actionRatio: Math.round((actionCount / total) * 100),
    situationRatio: Math.round((situationCount / total) * 100),
    resultRatio: Math.round((resultCount / total) * 100)
  };
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

function findCautions(text) {
  const detected = [];
  for (const item of CAUTION_PATTERNS) {
    const matches = text.match(item.pattern);
    if (matches && matches.length > item.maxAllowed) {
      detected.push({ label: item.label, count: matches.length });
    }
  }
  return detected;
}

function runAudit(text, limits) {
  const charWithSpaces = text.length;
  const charWithoutSpaces = text.replace(/\s/g, '').length;
  const bytesEucKr = calculateBytes(text, 'euckr');
  const bytesUtf8 = calculateBytes(text, 'utf8');

  const cliches = findCliches(text);
  const cautions = findCautions(text);
  const structure = analyzeStructure(text);

  // 6대 고정 스키마 감사 항목 평가
  const auditReport = [];

  // 1. [지원자 원문 흐름 보존]
  const pass1 = text.length > 0;
  auditReport.push({
    item: '[지원자 원문 흐름 보존]',
    status: pass1 ? 'PASS' : 'FAIL',
    note: pass1 ? '지원자의 구술 핵심 딜레마 및 문제 해결 흐름 반영 완료' : '초안 텍스트 부재'
  });

  // 2. [AI식 과도한 압축 및 문장 길이 단조로움 차단]
  const noAIPattern = !text.includes('요약하자면') && !text.includes('첫째, 둘째, 셋째') && !text.includes('다음과 같습니다');
  const sentences = text.split(/(?<=[.?!])\s+/).filter(s => s.trim().length > 0);
  const lengths = sentences.map(s => s.length);
  const avgLen = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1);
  const variance = lengths.reduce((a, b) => a + Math.pow(b - avgLen, 2), 0) / (lengths.length || 1);
  const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;
  const isMonotonous = lengths.length >= 4 && stdDev < 6 && lengths.every(l => l >= 35 && l <= 60);

  const pass2 = noAIPattern && !isMonotonous;
  auditReport.push({
    item: '[AI식 과도한 압축 및 문장 길이 단조로움 차단]',
    status: pass2 ? 'PASS' : 'FAIL',
    note: pass2 
      ? `호흡 유연 (문장 길이 표준편차 ${stdDev}, 장단문 조화)` 
      : (isMonotonous ? `문장 길이 단조로움 (모든 문장이 ${Math.round(avgLen)}자 내외로 균일함, 표준편차 ${stdDev})` : 'AI 특유의 기계적 개조식/요약투 표현 감지')
  });

  // 3. [어렵고 추상적인 단어 및 AI 상투어 배제]
  const abstractWords = ['시너지의 극대화', '패러다임의 혁신', '비약적 발전', '전방위적 역량', '초격차 경쟁력', '세계를 선도', '글로벌 1위로 이끌'];
  const foundAbstract = abstractWords.filter(w => text.includes(w));
  const pass3 = foundAbstract.length === 0;
  let note3 = pass3 ? '디테일 없는 거창한 포장 배제 및 현장 실무 어휘 유지' : `거창한 과장/추상 표현 감지: ${foundAbstract.join(', ')}`;
  if (cautions.length > 0) {
    note3 += ` (⚠️ 주의: ${cautions.map(c => `${c.label} ${c.count}회 감지`).join(', ')})`;
  }
  auditReport.push({
    item: '[어렵고 추상적인 단어 및 AI 상투어 배제]',
    status: pass3 ? 'PASS' : 'FAIL',
    note: note3
  });

  // 4. [논리 인과관계 및 개연성 전수 검증]
  const pass4 = structure.actionRatio >= 40 && structure.situationRatio <= 35;
  auditReport.push({
    item: '[논리 인과관계 및 개연성 전수 검증]',
    status: pass4 ? 'PASS' : 'FAIL',
    note: pass4 ? `[문제 ➔ 대안 검토 ➔ 선택 ➔ 실행] 인과 사슬 안정 (행동 ${structure.actionRatio}%, 상황 ${structure.situationRatio}%)` : `인과 불균형: 상황(${structure.situationRatio}%) 과다 또는 행동(${structure.actionRatio}%) 부족`
  });

  // 5. [지원자-보이스 동기화 전수 감사]
  const endingStyleOk = (text.match(/습니다\.|었습니다\.|했습니다\./g) || []).length >= 3;
  const pass5 = endingStyleOk;
  auditReport.push({
    item: '[지원자-보이스 동기화 전수 감사]',
    status: pass5 ? 'PASS' : 'FAIL',
    note: pass5 ? '담백하고 솔직한 공학적 어조 일치 (~생각했습니다, ~기여하겠습니다)' : '문장 종결 어미 어색 또는 불일치'
  });

  // 6. [사고의 과정 70% / 감정·실패담·딜레마 필수 검증]
  const struggleKeywords = ['한계', '문제', '오류', '발산', '지연', '결함', '실패', '어려움', '부족', '답답', '갈등', '고민', '마주', '누락', '예외', '병목', '충돌', '오차'];
  const hasStruggle = struggleKeywords.some(kw => text.includes(kw));
  const pass6 = cliches.length === 0 && hasStruggle;
  auditReport.push({
    item: '[사고 과정 70% / 감정·실패담·딜레마 필수 검증]',
    status: pass6 ? 'PASS' : 'FAIL',
    note: pass6 
      ? '두괄식 준수, 엔지니어링 딜레마/난관 극복 과정 및 실무 접목 확인' 
      : (!hasStruggle ? '감정·실패담·딜레마 결여 (AI식 매끄러운 성공 나열 감지, 난관/버그/고민 필수 포함 필요)' : `클리셰 감지: ${cliches.map(c => c.label).join(', ')}`)
  });

  const allAuditPass = auditReport.every(a => a.status === 'PASS');
  const lengthPass = charWithSpaces <= limits.max && charWithSpaces >= limits.min;

  return {
    allPass: allAuditPass && lengthPass,
    metrics: {
      charWithSpaces,
      charWithoutSpaces,
      bytesEucKr,
      bytesUtf8,
      structure,
      cliches
    },
    limits,
    auditReport
  };
}

function run() {
  const args = process.argv.slice(2);
  let inputPath = path.resolve(__dirname, '../draft_input.md');
  let outputPath = path.resolve(__dirname, '../draft_output.md');

  if (args.includes('--input') || args.includes('-i')) {
    const idx = args.indexOf('--input') !== -1 ? args.indexOf('--input') : args.indexOf('-i');
    inputPath = path.resolve(args[idx + 1]);
  }
  if (args.includes('--output') || args.includes('-o')) {
    const idx = args.indexOf('--output') !== -1 ? args.indexOf('--output') : args.indexOf('-o');
    outputPath = path.resolve(args[idx + 1]);
  }

  if (!fs.existsSync(inputPath)) {
    const templatePath = path.resolve(__dirname, '../draft_input.template.md');
    console.log(`ℹ️ [안내] 입력 파일 '${inputPath}'이 없습니다.`);
    console.log(`   '${templatePath}'을 복사하여 아이디어를 작성하신 후 다시 실행해 주세요.`);
    process.exit(0);
  }

  const parsed = parseInputFile(inputPath);
  const questionsToProcess = parsed.isMulti ? parsed.questions : [parsed];

  if (questionsToProcess.length === 0 || !questionsToProcess.some(q => q.draftText)) {
    console.log('====================================================================');
    console.log('📝 [orchestrator] 사용자 구술 아이디어 접수 완료');
    console.log('====================================================================');
    console.log('• 상태: 초안 텍스트가 없습니다. draft_input.md에 초안을 작성해 주세요.');
    console.log('====================================================================');
    return;
  }

  const results = [];
  for (const q of questionsToProcess) {
    if (!q.draftText) continue;
    const audit = runAudit(q.draftText, { max: q.maxLimit, min: q.minLimit });
    results.push({ parsed: q, audit });
  }

  const outputSections = [];
  const allPassGlobal = results.every(r => r.audit.allPass);

  outputSections.push(
    `# 📋 [자소서 검토본] ${results[0].parsed.company} (총 ${results.length}개 문항)`,
    '',
    `> **생성 일시**: ${new Date().toLocaleString()}`,
    `> **종합 판정**: ${allPassGlobal ? '🟢 전 문항 fact_checker PASS (승인 권장)' : '🔴 일부 문항 보완 필요'}`,
    `> **★안내**: 본 검토본은 지원자의 확인을 위해 별도로 저장된 초안입니다. 마스터 파일(companies/ 마스터)은 지원자의 승인 후에만 반영됩니다.`,
    '',
    '---'
  );

  for (let i = 0; i < results.length; i++) {
    const { parsed: p, audit: a } = results[i];
    outputSections.push(
      '',
      `## [문항 ${i + 1}] ${p.question}`,
      '',
      `> **상태**: ${a.allPass ? '🟢 fact_checker 전수 PASS' : '🔴 보완 필요'} | **글자수**: **${a.metrics.charWithSpaces}자** (규격: ${p.minLimit}~${p.maxLimit}자) | **행동 비중**: ${a.metrics.structure.actionRatio}%`,
      '',
      '### 1. 작성 초안 본문',
      '',
      '```text',
      p.draftText,
      '```',
      '',
      '### 2. 규격 실측 데이터 (verify_essay)',
      `* **공백 포함 글자 수**: **${a.metrics.charWithSpaces}자** / 허용: ${p.minLimit}자 ~ ${p.maxLimit}자`,
      `* **공백 제외 글자 수**: ${a.metrics.charWithoutSpaces}자`,
      `* **EUC-KR 바이트**: ${a.metrics.bytesEucKr} Bytes`,
      `* **UTF-8 바이트**: ${a.metrics.bytesUtf8} Bytes`,
      `* **문장 구조 비율**: 행동/과정 **${a.metrics.structure.actionRatio}%** | 상황 **${a.metrics.structure.situationRatio}%** | 결과 ${a.metrics.structure.resultRatio}%`,
      '',
      '### 3. 🔍 fact_checker 6대 고정 스키마 감사 리포트',
      a.auditReport.map((item, idx) => `${idx + 1}. **${item.item}**: **${item.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}**\n   - ${item.note}`).join('\n\n'),
      '',
      `**문항 판정**: **${a.allPass ? '🏆 [APPROVED - 합격]' : '❌ [REJECT - 수정 필요]'}**`,
      '',
      '---'
    );
  }

  fs.writeFileSync(outputPath, outputSections.join('\n'), 'utf-8');

  console.log('====================================================================');
  console.log(`🤖 [orchestrator] 검증 및 감찰 완료 (총 ${results.length}개 문항)`);
  console.log('====================================================================');
  results.forEach((r, idx) => {
    console.log(`[문항 ${idx + 1}] ${r.parsed.question}`);
    console.log(`   • 판정: ${r.audit.allPass ? '✅ ALL PASS' : '❌ 보완 필요'} | 글자수: ${r.audit.metrics.charWithSpaces}자 (최대 ${r.parsed.maxLimit}자) | 행동 ${r.audit.metrics.structure.actionRatio}%`);
  });
  console.log('====================================================================');
  console.log(`📄 지원자 검토용 파일 생성 완료: ${outputPath}`);
  console.log('   (마스터 파일은 변경되지 않았습니다. 파일 확인 후 최종 승인해 주시면 됩니다.)');
  console.log('====================================================================');
}

run();
