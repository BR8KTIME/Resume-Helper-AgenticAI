const fs = require('fs');
const path = require('path');

/**
 * validate_intake.js
 * 
 * [Gate 1: Input Contract Gatekeeper]
 * 자기소개서 작성 시작 전 5대 필수 입력(Input Contract) 충족 여부를 코드로 사전 검증.
 * 단 하나라도 누락 시 Exit Code 1로 차단하여 AI의 임의 추측 및 날조를 원천 차단.
 */

const MANDATORY_FIELDS = [
  { key: 'company', name: '지원 기업명 (Target Company)', desc: '지원 대상 기업의 공식 명칭' },
  { key: 'job_description', name: '공식 JD 및 요구역량 (Job Description)', desc: '공식 채용 공고에 명시된 직무 역할 및 필수/우대 역량' },
  { key: 'question', name: '문항 번호 및 질문 (Question Prompt)', desc: '작성할 자기소개서 문항 내용' },
  { key: 'char_limit', name: '최대 글자 수 한도 (Char/Byte Limit)', desc: '공백 포함/제외 최대 글자 수 또는 바이트 한도' },
  { key: 'user_experience', name: '지원자 실제 경험/소재 (Candidate Experience)', desc: '지원자가 실제로 수행한 공학적 행동 및 팩트' }
];

function parseInputFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Regex extractors for Markdown formatted inputs
  const companyMatch = content.match(/(?:\*|\-)?\s*\*\*(?:지원\s*)?기업(?:\s*명)?\*\*:\s*(.*)/i) ||
                       content.match(/(?:\*|\-)?\s*\*\*Target\s*(?:Company|Organization)\*\*:\s*(.*)/i) ||
                       content.match(/#+\s*(?:지원\s*)?기업명?:\s*(.*)/i);
  
  const jdMatch = content.match(/(?:\*|\-)?\s*\*\*(?:지원\s*)?직무(?:\s*및\s*JD\s*요구역량)?\*\*:\s*(.*)/i) ||
                  content.match(/(?:\*|\-)?\s*\*\*Target\s*Role\*\*:\s*(.*)/i) ||
                  content.match(/#+\s*(?:공식\s*)?(?:직무기술서|JD|직무\s*요구사항)\s*\n([\s\S]*?)(?=\n#+|$)/i);

  const questionMatch = content.match(/(?:\*|\-)?\s*\*\*문항\s*(?:번호\s*\/)?\s*제목\*\*:\s*(.*)/i) ||
                        content.match(/(?:\*|\-)?\s*\*\*Question(?:\s*Prompt)?\*\*:\s*(.*)/i) ||
                        content.match(/#+\s*(?:문항|질문|Question)\s*:\s*(.*)/i) ||
                        content.match(/(?:\*|\-)?\s*문항\s*\d+\s*:\s*(.*)/i);

  const limitMatch = content.match(/최대\s*([\d,]+)\s*(?:자|bytes?)/i) ||
                     content.match(/한도\s*:\s*([\d,]+)\s*(?:자|bytes?)/i) ||
                     content.match(/Max\s*([\d,]+)\s*(?:chars?|characters?|bytes?)/i);

  const expMatch = content.match(/#+\s*(?:[0-9]+[.)]\s*)?(?:지원자|후보자|Candidate)?\s*(?:의\s*)?(?:실제\s*|핵심\s*|날것\s*|Core\s*|Raw\s*)?(?:경험|소재|연구\s*자산|메모|구술|노트|Notes|Experience|Dilemma)[\s\S]*?\n([\s\S]*?)(?=\n#+|$)/i) ||
                   content.match(/(?:\*|\-)?\s*\*\*(?:핵심\s*)?소재\*\*:\s*(.*)/i);

  const data = {};
  if (companyMatch && companyMatch[1].trim()) data.company = companyMatch[1].trim();
  if (jdMatch && jdMatch[1].trim()) data.job_description = jdMatch[1].trim();
  if (questionMatch && questionMatch[1].trim()) data.question = questionMatch[1].trim();
  if (limitMatch && limitMatch[1].trim()) {
    data.char_limit = {
      max: parseInt(limitMatch[1].replace(/,/g, ''), 10),
      min: Math.floor(parseInt(limitMatch[1].replace(/,/g, ''), 10) * 0.88)
    };
  }
  if (expMatch && expMatch[1].trim()) data.user_experience = expMatch[1].trim();

  return { rawContent: content, data };
}

function parseCliArgs(args) {
  const data = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--company' && args[i + 1]) data.company = args[++i];
    if (args[i] === '--jd' && args[i + 1]) data.job_description = args[++i];
    if (args[i] === '--question' && args[i + 1]) data.question = args[++i];
    if (args[i] === '--max' && args[i + 1]) {
      const max = parseInt(args[++i], 10);
      data.char_limit = { max, min: Math.floor(max * 0.88) };
    }
    if (args[i] === '--exp' && args[i + 1]) data.user_experience = args[++i];
  }
  return data;
}

function validateIntake(data) {
  const missing = [];
  for (const field of MANDATORY_FIELDS) {
    if (!data[field.key]) {
      missing.push(field);
    }
  }

  const isValid = missing.length === 0;

  return {
    isValid,
    missing,
    data
  };
}

function main() {
  const args = process.argv.slice(2);
  let inputData = {};

  const fileArgIdx = args.indexOf('--file');
  if (fileArgIdx !== -1 && args[fileArgIdx + 1]) {
    try {
      const parsed = parseInputFile(args[fileArgIdx + 1]);
      inputData = parsed.data;
    } catch (e) {
      console.error(`[Error] ${e.message}`);
      process.exit(1);
    }
  } else {
    inputData = parseCliArgs(args);
  }

  const result = validateIntake(inputData);

  console.log('====================================================');
  console.log('🛡️ [Input Contract Gatekeeper: validate_intake]');
  console.log('====================================================');

  if (result.isValid) {
    console.log('🟢 [CONTRACT VALIDATED] 모든 필수 입력이 완벽히 충족되었습니다.');
    console.log(`• 지원 기업: ${result.data.company}`);
    console.log(`• 공식 직무: ${result.data.job_description.substring(0, 40)}...`);
    console.log(`• 대상 문항: ${result.data.question}`);
    console.log(`• 글자 규격: 최대 ${result.data.char_limit.max}자 (목표: ${result.data.char_limit.min}~${result.data.char_limit.max}자)`);
    console.log(`• 지원자 소재: ${result.data.user_experience.substring(0, 50)}...`);
    console.log('----------------------------------------------------');
    console.log('🚀 Step 2: resume_editor 초안 생성으로 진입을 승인합니다.');
    console.log('====================================================');
    process.exit(0);
  } else {
    console.log('🔴 [CONTRACT REJECTED] 필수 입력 정보가 누락되어 초안 생성을 차단합니다.');
    console.log('★ AI의 임의 추측 및 할루시네이션을 방지하기 위해 아래 항목이 반드시 필요합니다:\n');
    result.missing.forEach((m, idx) => {
      console.log(`   ${idx + 1}. ❌ ${m.name}`);
      console.log(`      └─ 설명: ${m.desc}`);
    });
    console.log('\n----------------------------------------------------');
    console.log('⚠️ [Action Required] 위 누락 항목을 사용자로부터 먼저 입력받은 뒤 다시 실행하십시오.');
    console.log('====================================================');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validateIntake,
  parseInputFile,
  MANDATORY_FIELDS
};
