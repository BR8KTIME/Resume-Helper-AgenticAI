# 🚀 Resume-Helper-AgenticAI (v2.0)

> **"검증 로직을 구현하는 것에 그치지 않고, Hard Constraint와 Heuristic Quality Signal이 서로 다른 의미를 갖도록 분리 정의하고 Regression Test로 그 계약을 고정했습니다."**

본 프로젝트는 LLM 특유의 환각(Hallucination), 상투어 남발, 글자 수 오차, 문장 길이 단조로움을 차단하기 위해 **결정론적 규칙 검증(Deterministic Rule Verification)**과 **에이전틱 상태 머신(Agentic State Machine)**을 결합한 자소서 무결성 검증 자동화 시스템입니다.

---

## 🏗️ 시스템 핵심 아키텍처

```text
[입력 단계] 지원자 원문 경험 / 날것의 아이디어
   │
   ▼
[Gate 1] tools/validate_intake.js ➔ 5대 필수 입력 계약 사전 검증 (누락 시 즉시 차단)
   │
   ▼
[생성 단계] agents/resume_editor.md ➔ STAR 구조 및 Action 60% 중심 초안 생성
   │
   ▼
[Gate 2] tools/verify_essay.js ➔ 결정론적 규격 & 품질 신호 검증
   ├─► [Hard Violations] 글자수/바이트 초과 ➔ Metric Delta 기반 미세 수정 피드백
   └─► [Hard PASS] ➔ Heuristic 품질 경고(Warning)를 포함하여 Gate 3으로 전달
   │
   ▼
[Gate 3] agents/fact_checker.md ➔ 6대 무결성 블라인드 감사
   ├─► [Hard Factual Violation] 기술 날조 / 원문 왜곡 ➔ REJECT 및 사실 수정 강제
   └─► [APPROVED / APPROVED WITH WARNINGS] ➔ 최종 승인 및 마스터 저장소 동기화
```

---

## 🎯 3대 핵심 엔지니어링 철학

### 1. Hard Constraints vs Heuristic Signals의 철저한 직교성 (Orthogonality)
- **Hard Constraints (`FAIL` ➔ 무조건 수정 강제)**:
  - 공백 포함/제외 글자 수 상한 및 하한 위반 (Exact Boundary Checking)
  - 실제 인코딩 기준 바이트 수 초과 (`Buffer.byteLength(str, 'utf8')`, EUC-KR 코드포인트 계산)
  - 과거 연구/CS 기술 용어 날조, 사명/직무 오기재, 타 기업 에피소드 잔존
- **Heuristic Quality Signals (`PASS + WARNING` ➔ 품질 개선 권고)**:
  - AI 상투어 및 클리셰 감지 (`귀사`, `시너지`, `역량을 함양`, `열정을 다해` 등)
  - 문장 길이 균일성 분석 (Sentence Variance: 모든 문장이 40~55자로 일정한 기계적 단조로움 감지)
  - 낯선 학술 단어 완화 및 두괄식 구조 전개 권고
  - *품질 신호는 첨삭가에게 피드백으로 전달되되, 단독으로 시스템 실패(FAIL)나 무한 루프를 발생시키지 않습니다.*

### 2. 경계 조건(Boundary Conditions) 중심의 회귀 테스트 스위트
- 검증 엔진(`verify_essay.js`)은 총 12개 테스트 케이스(패스율 100%)로 계약을 영구 보증합니다:
  - **BC01**: 500자 상한 정합 (Exact 500 / Max 500) ➔ `PASS`
  - **BC02**: 501자 1자 초과 (Off-by-One Violation) ➔ `FAIL` (`Delta: +1` 정확히 추출)
  - **BC03**: 300자 하한 정합 (Exact 300 / Min 300) ➔ `PASS`
  - **BC04**: 299자 1자 미달 (Off-by-One Violation) ➔ `FAIL`
  - **BC05**: 상한 500자 정합 + 클리셰 검출 결합 ➔ `PASS + WARNING` (직교성 증명)
  - **BC06**: EUC-KR(100바이트 경계) 및 UTF-8 실제 인코딩 바이트 경계 검증 ➔ `PASS/FAIL`

### 3. 단일 세션 유지 & 에이전틱 상태 머신 (Agentic State Machine)
- 매 피드백마다 서브에이전트를 새로 생성하지 않고, **최초 1회 인스턴스 생성 후 `send_message` 도구로 동일 세션을 유지**하여 이전 시도 내역과 컨텍스트 유실을 방지합니다.
- `EssayState` 인터페이스를 통해 입력, 정량 검증(`quantitativeCheck`), 정성 감사(`qualitativeCheck`) 상태를 엄격히 추적합니다.

---

## 📁 깃허브 저장소 구조

```text
Resume-Helper-AgenticAI/
├── .env.example               # 환경 설정 예시
├── .gitignore                 # 개인정보 및 로컬 파일 보호 규칙
├── AGENTS.md                  # 멀티 에이전트 폐루프 세부 명세서
├── LICENSE                    # MIT License
├── package.json               # 프로젝트 의존성 및 테스트 스크립트
├── README.md                  # 시스템 안내서 (현재 파일)
├── draft_input.template.md    # 지원자 날것 구술 아이디어 입력 템플릿
├── agents/                    # 3대 핵심 전문 서브에이전트
│   ├── fact_checker.md        # 6대 무결성 블라인드 감사관 (Hard vs Heuristic 분리)
│   ├── job_analyst.md         # 채용공고 해체 및 직무 분석가
│   └── resume_editor.md       # STAR 구조화 및 자소서 첨삭가
├── samples/                   # 오픈소스 시연용 샘플 데이터
│   ├── sample_input.md        # 샘플 입력 프롬프트
│   ├── sample_output.md       # 검증 완료된 샘플 자소서 및 감사 보고서
│   └── sample_profile.md      # 샘플 지원자 프로필
├── tests/                     # 자동화 회귀 테스트 스위트
│   ├── run_tests.js           # 벤치마크 테스트 러너
│   ├── test_cases.json        # 표준 평가 데이터셋
│   └── test_hard_vs_heuristic.js # 직교성 및 경계조건 회귀 테스트
└── tools/                     # 결정론적 검증 CLI 도구
    ├── test_hard_vs_heuristic.js # 경계조건 회귀 테스트 스위트
    ├── validate_intake.js     # Gate 1: 5대 입력 계약 검증기
    └── verify_essay.js        # Gate 2: 글자수/바이트/클리셰/문장분산 통합 검증 CLI
```

---

## 🛠️ CLI 사용법

### 1. 직교성 및 경계 조건 회귀 테스트 실행
```bash
node tools/test_hard_vs_heuristic.js
```

### 2. 벤치마크 테스트 스위트 실행
```bash
npm test
```

### 3. 자기소개서 정밀 검증 (`verify_essay.js`)
```bash
# 직접 텍스트 검증 (공백 포함 최대 500자)
node tools/verify_essay.js --text "검증할 본문 내용..." --max 500

# JSON 출력 모드 (CI/CD 및 에이전트 자동 파싱용)
node tools/verify_essay.js --text "검증할 본문 내용..." --max 500 --json

# 샘플 파일 검증
node tools/verify_essay.js --file samples/sample_output.md --max 800
```
