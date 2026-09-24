/**
 * orchestrator.js
 * 
 * Agentic AI Closed-Loop Autonomous Workflow CLI
 * 
 * Features:
 * 1. Autonomous Closed-Loop: Resume Editor (LLM) ➔ Deterministic Verifier (Code) ➔ Fact Checker (LLM)
 * 2. Dynamic Agent Loading: Directly loads prompts from agents/ folder (Single Source of Truth)
 * 3. Real-time Closed-Loop Feedback: Automatically re-prompts LLM with exact metric deltas upon failure
 * 4. Zero external dependencies: Uses native Node.js fetch for Google Gemini API
 * 5. Graceful Fallback: Runs deterministic verification mode if API key is not provided
 * 
 * Usage:
 *   node tools/orchestrator.js [--input <file>] [--output <file>] [--key <apiKey>] [--model <modelName>]
 */

const fs = require('fs');
const path = require('path');
const {
  BANNED_PATTERNS,
  calculateBytes,
  findCliches
} = require('./verify_essay.js');

// Simple .env parser (Zero external dependencies)
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const CAUTION_PATTERNS = [
  { pattern: /이를\s*(?:해결하기\s*)?위해/g, maxAllowed: 1, label: '접속 클리셰 남발 ("이를 위해" ➔ 1회 이하 권장)' }
];

/**
 * Dynamically load agent persona instruction from agents/*.md
 * Preserves Single Source of Truth architecture.
 */
function loadAgentInstruction(fileName, fallback = '') {
  const agentPath = path.resolve(__dirname, `../agents/${fileName}`);
  if (fs.existsSync(agentPath)) {
    return fs.readFileSync(agentPath, 'utf-8');
  }
  return fallback;
}

function parseQuestionBlock(blockText) {
  const companyMatch = blockText.match(/\*\s*\*\*지원 기업\*\*:\s*(.*)/i);
  const jdMatch = blockText.match(/\*\s*\*\*지원\s*직무(?:\s*및\s*JD\s*요구역량)?\*\*:\s*(.*)/i) ||
                  blockText.match(/###\s*(?:공식\s*)?(?:직무기술서|JD|직무\s*요구사항)\s*\n([\s\S]*?)(?=\n###|\n```|$)/i);
  const questionMatch = blockText.match(/\*\s*\*\*문항 번호 \/ 제목\*\*:\s*(.*)/i);
  const limitMatch = blockText.match(/최대\s*([\d,]+)자/i);
  const minLimitMatch = blockText.match(/최소\s*([\d,]+)자/i);

  const company = companyMatch ? companyMatch[1].trim() : '미지정 기업';
  const jobDescription = jdMatch ? jdMatch[1].trim() : '';
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

  // Extract raw user prompt / thoughts
  let userIdea = '';
  const ideaMatch = blockText.match(/###\s*(?:지원자\s*)?(?:구술\s*)?(?:아이디어|메모|소재)\s*\n([\s\S]*?)(?=\n###|\n```|$)/i);
  if (ideaMatch) {
    userIdea = ideaMatch[1].trim();
  } else {
    userIdea = draftText || blockText;
  }

  return {
    company,
    jobDescription,
    question,
    maxLimit,
    minLimit,
    userIdea,
    draftText,
    rawContent: blockText
  };
}

function parseInputFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`입력 파일을 찾을 수 없습니다: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  if (content.includes('=== QUESTION ===')) {
    const parts = content.split('=== QUESTION ===').map(p => p.trim()).filter(p => p.length > 0);
    const questions = [];
    for (const part of parts) {
      if (part.includes('문항') || part.includes('```') || part.includes('지원 기업')) {
        questions.push(parseQuestionBlock(part));
      }
    }
    return { isMulti: true, questions };
  }

  return { isMulti: false, ...parseQuestionBlock(content) };
}

function measureDraft(text, limits) {
  const charWithSpaces = text.length;
  const charWithoutSpaces = text.replace(/\s/g, '').length;
  const bytesEucKr = calculateBytes(text, 'euckr');
  const bytesUtf8 = calculateBytes(text, 'utf8');

  const cliches = findCliches(text);

  const lengthPass = charWithSpaces <= limits.max && charWithSpaces >= limits.min;
  const clichePass = cliches.length === 0;

  const violations = [];
  if (charWithSpaces > limits.max) {
    violations.push(`최대 글자 수 초과: 현재 ${charWithSpaces}자 / 기준 ${limits.max}자 (${charWithSpaces - limits.max}자 초과)`);
  }
  if (charWithSpaces < limits.min) {
    violations.push(`최소 글자 수 미달: 현재 ${charWithSpaces}자 / 기준 ${limits.min}자 (${limits.min - charWithSpaces}자 부족)`);
  }
  if (cliches.length > 0) {
    cliches.forEach(c => violations.push(`금지 클리셰 검출: ${c.label} (${c.count}회)`));
  }
  for (const cp of CAUTION_PATTERNS) {
    const matches = (text.match(cp.pattern) || []).length;
    if (matches > cp.maxAllowed) {
      violations.push(`주의 패턴 감지: ${cp.label} (${matches}회 사용 / 최대 ${cp.maxAllowed}회 이하 준수)`);
    }
  }

  return {
    allPass: lengthPass && clichePass && violations.length === 0,
    lengthPass,
    clichePass,
    violations,
    metrics: {
      charWithSpaces,
      charWithoutSpaces,
      bytesEucKr,
      bytesUtf8,
      cliches
    },
    limits
  };
}

/**
 * Call Google Gemini REST API using native fetch
 */
async function callGeminiAPI(apiKey, prompt, systemInstruction, model = 'gemini-1.5-flash', jsonMode = false) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const generationConfig = {
    temperature: jsonMode ? 0.1 : 0.3,
    maxOutputTokens: 2048
  };
  if (jsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  const candidate = data.candidates && data.candidates[0];
  if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
    if (candidate && candidate.finishReason && candidate.finishReason !== 'STOP') {
      throw new Error(`Gemini API generation halted: finishReason = ${candidate.finishReason}`);
    }
    throw new Error('Gemini API returned empty response');
  }

  return candidate.content.parts[0].text.trim();
}

/**
 * Autonomous Closed-Loop: Resume Editor ➔ Verifier ➔ Fact Checker
 */
async function runAutonomousLoop(questionData, apiKey, model) {
  const maxRetries = 5;
  let attempt = 1;
  let currentDraft = questionData.draftText;
  let previousFeedback = '';
  const iterationLogs = [];

  // Load instructions dynamically from Single Source of Truth
  const resumeEditorInstruction = loadAgentInstruction(
    'resume_editor.md',
    '당신은 전문 기술 자기소개서 첨삭 에이전트입니다. STAR 구조와 두괄식, 정밀한 글자 수를 준수하여 작성하십시오.'
  );

  const factCheckerInstruction = loadAgentInstruction(
    'fact_checker.md',
    '당신은 엄격한 통합 팩트체커 감찰관입니다. 6대 감사 기준을 바탕으로 JSON 포맷으로만 응답하십시오.'
  );

  console.log(`\n====================================================================`);
  console.log(`🚀 [Autonomous Loop] Starting for: ${questionData.question}`);
  console.log(`   Target Limits: ${questionData.minLimit} ~ ${questionData.maxLimit} chars (with spaces)`);
  console.log(`====================================================================`);

  while (attempt <= maxRetries) {
    console.log(`\n🔄 [Attempt ${attempt}/${maxRetries}] Generating / Refining draft...`);

    // Step 1: Generate or Refine Draft using Resume Editor Agent
    let prompt = '';
    if (attempt === 1 && !currentDraft) {
      prompt = `
[지원 기업]: ${questionData.company}
[지원 직무 및 공식 JD 요구역량]: ${questionData.jobDescription || '상세 JD 미지정'}
[문항 제목]: ${questionData.question}
[글자 수 규격]: 공백 포함 최소 ${questionData.minLimit}자 ~ 최대 ${questionData.maxLimit}자 (목표: 약 ${Math.floor((questionData.minLimit + questionData.maxLimit) / 2)}자)
[지원자 메모 및 핵심 소재]:
${questionData.userIdea}

위 공식 JD 요구역량과 지원자 소재를 바탕으로, 지침에 맞춰 완벽한 자기소개서 본문을 작성하십시오. 마크다운 코드블록이나 불필요한 해설 없이 순수 본문 텍스트만 출력하십시오.
`;
    } else {
      prompt = `
[지원 기업]: ${questionData.company}
[지원 직무 및 공식 JD 요구역량]: ${questionData.jobDescription || '상세 JD 미지정'}
[문항 제목]: ${questionData.question}
[글자 수 규격]: 공백 포함 최소 ${questionData.minLimit}자 ~ 최대 ${questionData.maxLimit}자

[이전 작성 초안]:
${currentDraft}

[🚨 검증 엔진 및 감찰관 피드백 - 반드시 반영할 결함]:
${previousFeedback}

위 피드백을 정확히 반영하여, 딜레마와 공학적 판단을 유지하면서 글자 수(${questionData.minLimit}~${questionData.maxLimit}자)를 엄격히 맞추어 다시 작성하십시오. 순수 본문 텍스트만 출력하십시오.
`;
    }

    try {
      currentDraft = await callGeminiAPI(apiKey, prompt, resumeEditorInstruction, model, false);
      currentDraft = currentDraft.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '').trim();
    } catch (err) {
      console.error(`❌ [Agent Error] Resume Editor failed: ${err.message}`);
      break;
    }

    // Step 2: Deterministic Verification (verify_essay.js)
    const metrics = measureDraft(currentDraft, { min: questionData.minLimit, max: questionData.maxLimit });
    console.log(`⚙️ [Verifier] Measured: ${metrics.metrics.charWithSpaces} chars | Banned Clichés: ${metrics.metrics.cliches.length} | Status: ${metrics.allPass ? '✅ PASS' : '❌ FAIL'}`);

    if (!metrics.allPass) {
      const violationMsg = metrics.violations.join('\n');
      console.log(`⚠️ [Loop Action] Deterministic verification failed. Feeding delta back to Resume Editor...`);
      metrics.violations.forEach(v => console.log(`   - ${v}`));
      previousFeedback = `[규격 실측 실패 - 오차값 추출]\n${violationMsg}\n현재 글자 수: ${metrics.metrics.charWithSpaces}자 (목표: ${questionData.minLimit}~${questionData.maxLimit}자).\n★이미 통과한 좋은 문맥과 스토리 구조는 철저히 유지하고, 지적된 오차(글자 수/금지어)만 정밀하게 조정하십시오.`;
      iterationLogs.push({ attempt, phase: 'Verifier FAIL', charCount: metrics.metrics.charWithSpaces, feedback: violationMsg });
      attempt++;
      continue;
    }

    // Step 3: Semantic Audit (Fact Checker Agent)
    console.log(`🕵️ [Auditor] Calling Fact Checker Agent for 6-point semantic audit...`);
    let auditResult = { allPass: false, summary: '감찰 수행 중', critique: '감찰 결과 수신 대기' };
    try {
      const auditPrompt = `
[문항]: ${questionData.question}
[지원 기업]: ${questionData.company}
[지원 직무 및 공식 JD 요구역량]: ${questionData.jobDescription || '상세 JD 미지정'}
[글자 수 규격]: ${questionData.minLimit}~${questionData.maxLimit}자
[검토할 자소서 본문]:
${currentDraft}

위 본문을 [공식 JD 직무 정합성] 및 6대 고정 기준([JD 직무 정합성 및 지원자 원문 보존], [AI식 과도한 압축 및 문체 차단], [어렵고 추상적인 단어 배제], [논리 인과관계 및 개연성], [솔직한 공학적 어조], [사고의 과정 70% 이상])에 따라 엄격히 심사하고 JSON 포맷으로만 응답하십시오:
{
  "allPass": true 또는 false,
  "summary": "총평 요약",
  "critique": "탈락 시 수정해야 할 구체적 보완 지시사항 (통과 시 빈 문자열)"
}
`;
      const auditRaw = await callGeminiAPI(apiKey, auditPrompt, factCheckerInstruction, model, true);
      const jsonMatch = auditRaw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        auditResult = JSON.parse(jsonMatch[0]);
      } else {
        auditResult = { allPass: false, summary: 'JSON 파싱 실패', critique: '감찰 결과가 올바른 JSON 형식이 아닙니다.' };
      }
    } catch (err) {
      console.warn(`⚠️ [Audit Warning] Fact checker call failed: ${err.message}`);
      auditResult = { allPass: false, summary: '감찰 호출 에러', critique: `API 에러 또는 파싱 실패: ${err.message}` };
    }

    if (!auditResult.allPass) {
      console.log(`⚠️ [Loop Action] Fact Checker REJECTED: ${auditResult.critique}`);
      previousFeedback = `[감찰관 지적사항 - REJECT]\n${auditResult.critique}\n★수정해야 할 결함 부분만 집중 보완하고, 이미 검증 통과한 글자 수 규격(${questionData.minLimit}~${questionData.maxLimit}자)과 좋은 스토리라인은 철저히 유지하십시오.`;
      iterationLogs.push({ attempt, phase: 'FactChecker REJECT', charCount: metrics.metrics.charWithSpaces, feedback: auditResult.critique });
      attempt++;
      continue;
    }

    // Success: Both Verifier and Fact Checker Passed!
    console.log(`🎉 [Success] Autonomous Closed-Loop Converged on Attempt #${attempt}!`);
    return {
      success: true,
      draftText: currentDraft,
      metrics,
      auditResult,
      attempts: attempt,
      iterationLogs
    };
  }

  // Fallback if loop exceeded max retries
  console.warn(`⚠️ [Notice] Max retries reached. Outputting best available draft.`);
  const finalMetrics = measureDraft(currentDraft, { min: questionData.minLimit, max: questionData.maxLimit });
  return {
    success: finalMetrics.allPass,
    draftText: currentDraft,
    metrics: finalMetrics,
    auditResult: { allPass: false, summary: '최대 재시도 횟수 초과' },
    attempts: attempt,
    iterationLogs
  };
}

async function run() {
  const args = process.argv.slice(2);
  let inputPath = path.resolve(__dirname, '../draft_input.md');
  let outputPath = path.resolve(__dirname, '../draft_output.md');
  let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  let model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

  if (args.includes('--input') || args.includes('-i')) {
    const idx = args.indexOf('--input') !== -1 ? args.indexOf('--input') : args.indexOf('-i');
    inputPath = path.resolve(args[idx + 1]);
  }
  if (args.includes('--output') || args.includes('-o')) {
    const idx = args.indexOf('--output') !== -1 ? args.indexOf('--output') : args.indexOf('-o');
    outputPath = path.resolve(args[idx + 1]);
  }
  if (args.includes('--key') || args.includes('-k')) {
    const idx = args.indexOf('--key') !== -1 ? args.indexOf('--key') : args.indexOf('-k');
    apiKey = args[idx + 1];
  }
  if (args.includes('--model') || args.includes('-m')) {
    const idx = args.indexOf('--model') !== -1 ? args.indexOf('--model') : args.indexOf('-m');
    model = args[idx + 1];
  }

  if (!fs.existsSync(inputPath)) {
    const sampleInputPath = path.resolve(__dirname, '../samples/sample_input.md');
    if (fs.existsSync(sampleInputPath)) {
      console.log(`ℹ️ [Notice] 'draft_input.md' not found. Running on sample: '${sampleInputPath}'...\n`);
      inputPath = sampleInputPath;
    } else {
      console.log(`ℹ️ [Notice] Input file '${inputPath}' not found.`);
      process.exit(0);
    }
  }

  const parsed = parseInputFile(inputPath);
  const questionsToProcess = parsed.isMulti ? parsed.questions : [parsed];

  console.log('====================================================================');
  console.log('🤖 Resume-Helper-AgenticAI: Autonomous Closed-Loop Pipeline');
  console.log(`📁 Input : ${inputPath}`);
  console.log(`📄 Output: ${outputPath}`);
  console.log(`🔑 LLM API: ${apiKey ? `Enabled (Model: ${model})` : 'Disabled (Deterministic Verifier Mode)'}`);
  console.log('====================================================================');

  const results = [];

  for (const q of questionsToProcess) {
    if (apiKey) {
      // Full Autonomous Loop with Real LLM API Calls!
      const loopResult = await runAutonomousLoop(q, apiKey, model);
      results.push({ parsed: q, ...loopResult });
    } else {
      // Deterministic Verifier Mode without API key
      const measurement = measureDraft(q.draftText, { max: q.maxLimit, min: q.minLimit });
      results.push({
        parsed: q,
        success: measurement.allPass,
        draftText: q.draftText,
        metrics: measurement,
        auditResult: { allPass: measurement.allPass, summary: 'Offline verification mode' },
        attempts: 1,
        iterationLogs: []
      });
    }
  }

  // Format Output Markdown
  const outputSections = [];
  const allPassGlobal = results.every(r => r.success);

  outputSections.push(
    `# 📋 [자소서 검토본] ${results[0].parsed.company} (총 ${results.length}개 문항)`,
    '',
    `> **생성 일시**: ${new Date().toLocaleString()}`,
    `> **폐루프 상태**: ${allPassGlobal ? '🟢 자율 폐루프 수렴 완료 (규격 & 감찰 전원 합격)' : '🔴 일부 문항 보완 필요'}`,
    `> **실행 모드**: ${apiKey ? `🤖 Autonomous Agent Loop (${model})` : '⚙️ Offline Deterministic Verifier'}`,
    `> **★안내**: 본 문서는 지원자 검토용 파일입니다. 마스터 파일은 지원자의 최종 승인 후에만 반영됩니다.`,
    '',
    '---'
  );

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    outputSections.push(
      '',
      `## [문항 ${i + 1}] ${r.parsed.question}`,
      '',
      `> **상태**: ${r.success ? '🟢 ALL PASS' : '🔴 FAIL'} | **글자수**: **${r.metrics.metrics.charWithSpaces}자** (${r.parsed.minLimit}~${r.parsed.maxLimit}자) | **수렴 시도 회차**: ${r.attempts}회`,
      '',
      '### 1. 작성 본문',
      '',
      '```text',
      r.draftText,
      '```',
      '',
      '### 2. 규격 실측 데이터 (verify_essay)',
      `* **공백 포함 글자 수**: **${r.metrics.metrics.charWithSpaces}자** / 허용: ${r.parsed.minLimit}자 ~ ${r.parsed.maxLimit}자`,
      `* **공백 제외 글자 수**: ${r.metrics.metrics.charWithoutSpaces}자`,
      `* **EUC-KR 바이트**: ${r.metrics.metrics.bytesEucKr} Bytes`,
      `* **UTF-8 바이트**: ${r.metrics.metrics.bytesUtf8} Bytes`,
      `* **금지어 및 클리셰**: ${r.metrics.metrics.cliches.length === 0 ? '이상 없음 (0개 검출)' : r.metrics.metrics.cliches.map(c => `🚨 ${c.label}`).join(', ')}`,
      r.metrics.violations.length > 0 ? `* **🚨 정량 위반 내역**:\n${r.metrics.violations.map(v => `  - ${v}`).join('\n')}` : '',
      '',
      '### 3. 🔍 fact_checker 정성 감찰 판정',
      `* **감찰 판정**: ${r.auditResult.allPass ? '🏆 [APPROVED - 최종 통과]' : '❌ [REJECT - 보완 필요]'}`,
      `* **감찰 요약**: ${r.auditResult.summary || '정성 감찰 완료'}`,
      r.auditResult.critique ? `* **보완 지침**: ${r.auditResult.critique}` : '',
      '',
      '---'
    );
  }

  fs.writeFileSync(outputPath, outputSections.filter(s => s !== '').join('\n'), 'utf-8');

  console.log('\n====================================================================');
  console.log(`🎉 Pipeline Execution Finished: ${outputPath}`);
  console.log(`📊 Total Questions: ${results.length} | Passed: ${results.filter(r => r.success).length}/${results.length}`);
  console.log('====================================================================\n');
}

run().catch(err => {
  console.error('Fatal Pipeline Error:', err);
  process.exit(1);
});
