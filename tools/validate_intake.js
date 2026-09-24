/**
 * validate_intake.js
 * 
 * Step 1: Input Contract & Requirement Gatekeeper
 * 
 * Ensures that the Autonomous Closed-Loop writing pipeline NEVER starts
 * without all 5 mandatory engineering inputs. Eliminates hallucination at the source.
 * 
 * 5 Mandatory Inputs:
 * 1. company        : Target company name
 * 2. job_description: Official JD text, requirements, or verified JD file path
 * 3. question       : Essay prompt / question title
 * 4. char_limit     : Strict character limits (max limit required, min optional defaults to 85~90%)
 * 5. user_experience: Authentic factual experiences / technical actions from candidate
 * 
 * Usage:
 *   node tools/validate_intake.js --file <input.md>
 *   node tools/validate_intake.js --company "..." --jd "..." --question "..." --max 500 --exp "..."
 */

const fs = require('fs');
const path = require('path');

const MANDATORY_FIELDS = [
  { key: 'company', label: '지원 기업명 (Company)', description: '어느 기업에 지원하는지 명시' },
  { key: 'job_description', label: '공식 직무기술서/JD (Job Description)', description: '공식 공고문의 직무 역할 및 요구역량' },
  { key: 'question', label: '문항 번호 및 질문 (Question Prompt)', description: '기업에서 제시한 공식 자기소개서 질문' },
  { key: 'char_limit', label: '글자 수 한도 (Character Limits)', description: '최대 글자 수 (예: 최대 500자)' },
  { key: 'user_experience', label: '지원자 실제 경험/소재 (Candidate Experience)', description: '지원자가 실제로 수행한 공학적 행동 및 팩트' }
];

function parseInputFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`입력 파일을 찾을 수 없습니다: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Regex extractors for Markdown formatted inputs
  const companyMatch = content.match(/(?:\*|\-)?\s*\*\*지원\s*기업\*\*:\s*(.*)/i) ||
                       content.match(/#+\s*(?:지원\s*)?기업명?:\s*(.*)/i);
  
  const jdMatch = content.match(/(?:\*|\-)?\s*\*\*지원\s*직무(?:\s*및\s*JD\s*요구역량)?\*\*:\s*(.*)/i) ||
                  content.match(/#+\s*(?:공식\s*)?(?:직무기술서|JD|직무\s*요구사항)\s*\n([\s\S]*?)(?=\n#+|$)/i);

  const questionMatch = content.match(/(?:\*|\-)?\s*\*\*문항\s*(?:번호\s*\/)?\s*제목\*\*:\s*(.*)/i) ||
                        content.match(/#+\s*(?:문항|질문|Question)\s*:\s*(.*)/i) ||
                        content.match(/(?:\*|\-)?\s*문항\s*\d+\s*:\s*(.*)/i);

  const limitMatch = content.match(/최대\s*([\d,]+)\s*자/i) ||
                     content.match(/한도\s*:\s*([\d,]+)\s*자/i);

  const expMatch = content.match(/#+\s*(?:지원자\s*)?(?:실제\s*)?(?:경험|소재|연구\s*자산|메모|구술)\s*\n([\s\S]*?)(?=\n#+|$)/i) ||
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

function run() {
  const args = process.argv.slice(2);
  let parsedData = {};

  if (args.includes('--file') || args.includes('-f')) {
    const idx = args.indexOf('--file') !== -1 ? args.indexOf('--file') : args.indexOf('-f');
    const filePath = path.resolve(args[idx + 1]);
    parsedData = parseInputFile(filePath).data;
  } else {
    parsedData = parseCliArgs(args);
  }

  const validation = validateIntake(parsedData);

  console.log('====================================================');
  console.log('🛡️ [Input Contract Gatekeeper: validate_intake]');
  console.log('====================================================');

  if (validation.isValid) {
    console.log('🟢 [CONTRACT VALIDATED] 모든 필수 입력이 완벽히 충족되었습니다.');
    console.log(`• 지원 기업: ${validation.data.company}`);
    console.log(`• 공식 직무: ${validation.data.job_description.slice(0, 50)}...`);
    console.log(`• 대상 문항: ${validation.data.question}`);
    console.log(`• 글자 규격: 최대 ${validation.data.char_limit.max}자 (목표: ${validation.data.char_limit.min}~${validation.data.char_limit.max}자)`);
    console.log(`• 지원자 소재: ${validation.data.user_experience.slice(0, 50)}...`);
    console.log('----------------------------------------------------');
    console.log('🚀 Step 2: resume_editor 초안 생성으로 진입을 승인합니다.');
    console.log('====================================================');
    process.exit(0);
  } else {
    console.log('🔴 [CONTRACT REJECTED] 필수 입력 정보가 누락되어 초안 생성을 차단합니다.');
    console.log('★ AI의 임의 추측 및 할루시네이션을 방지하기 위해 아래 항목이 반드시 필요합니다:\n');
    validation.missing.forEach((m, idx) => {
      console.log(`   ${idx + 1}. ❌ ${m.label}`);
      console.log(`      └─ 설명: ${m.description}`);
    });
    console.log('\n----------------------------------------------------');
    console.log('⚠️ [Action Required] 위 누락 항목을 사용자로부터 먼저 입력받은 뒤 다시 실행하십시오.');
    console.log('====================================================');
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = {
  MANDATORY_FIELDS,
  validateIntake,
  parseInputFile
};
