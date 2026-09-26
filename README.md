# 🚀 Agentic AI 취업 지원 & 자기소개서 무결성 검증 시스템 (v2.0)

> **"검증 로직을 구현하는 것에 그치지 않고, Hard Constraint와 Heuristic Quality Signal이 서로 다른 의미를 갖도록 분리 정의하고 Regression Test로 그 계약을 고정했습니다."**

본 프로젝트는 컴퓨터공학 석사 연구 자산을 바탕으로 대기업 공채에 지원하는 과정을 총괄하는 **멀티 에이전트 기반 취업 준비 및 자소서 무결성 검증 자동화 시스템**입니다.  
LLM 특유의 환각(Hallucination), 상투어 남발, 글자 수 오차, 문장 길이 단조로움을 차단하기 위해 **결정론적 규칙 검증(Deterministic Rule Verification)**과 **에이전틱 상태 머신(Agentic State Machine)**을 결합했습니다.

---

## 🏗️ 시스템 핵심 아키텍처

```mermaid
flowchart TD
    User["지원자 (지원자)"] -->|원문 경험 / 아이디어 구술| Gate1["[Gate 1] tools/validate_intake.js<br>(5대 입력 계약 검증)"]
    
    Gate1 -->|PASS| Editor["자소서 첨삭가<br>(resume_editor)"]
    Gate1 -->|FAIL: 누락 항목 발생| Block1["작성 차단 및 입력 보완 요청"]
    
    Editor -->|초안 생성 (STAR + 행동 60%)| Gate2["[Gate 2] tools/verify_essay.js<br>(결정론적 규격 & 품질 신호 검증)"]
    
    Gate2 -->|Hard Violations: 글자수/바이트 초과| DeltaFeedback["Metric Delta 피드백<br>(send_message 미세 수정)"]
    DeltaFeedback --> Editor
    
    Gate2 -->|Hard PASS (Heuristic Warnings 허용)| Gate3["[Gate 3] fact_checker<br>(6대 무결성 블라인드 감사)"]
    
    Gate3 -->|FAIL: CS 날조 / 원문 왜곡| RejectLoop["사실 수정 피드백"]
    RejectLoop --> Editor
    
    Gate3 -->|APPROVED / APPROVED WITH WARNINGS| FinalPass["최종 승인 & 마스터 파일 동기화<br>(companies/<기업명>.md)"]
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

## 📁 디렉터리 구조 (Clean Architecture)

```text
job_prep/
├── GEMINI.md                  # [거버넌스] 메인 오케스트레이터 및 8단계 폐루프 절대 규칙
├── my_profile.md              # [단일 진실 공급원] 지원자 연구 자산 및 논문/프로젝트 팩트
├── my_cover_letters.md        # [마스터 아카이브] 승인/제출 완료된 자소서 보관함
├── schedule.md                # [일정] 25개 대기업 전형 일정 및 D-Day 현황
├── README.md                  # 시스템 아키텍처 및 안내서 (현재 파일)
├── agents/                    # [7대 전문 에이전트 시스템 명세]
│   ├── job_analyst.md         # 공식 채용 공고(PDF) 해체 및 최신 산업/기업 분석
│   ├── fact_checker.md        # 6대 무결성 블라인드 감사관 (Hard vs Heuristic 분리)
│   ├── resume_editor.md       # STAR 구조화 및 공학적 사고 과정 중심 첨삭가
│   ├── coding_test_coach.md   # 프로그래머스 Lv.2~3 특화 소크라테스식 코칭
│   ├── aptitude_trainer.md    # GSAT/NCS 수리·추리 어림셈 테크닉 훈련
│   ├── mock_interviewer.md    # 1:1 실시간 기술/임원 심층 모의 면접관
│   └── schedule_manager.md    # 전형 일정 역산 및 마감 알림 매니저
├── companies/                 # [1기업 1마스터 원칙] 기업별 분석 + 작성본 단일 마스터
│   ├── hd_hyundai_marine_solution.md
│   ├── lguplus.md
│   ├── hyundai_motor.md
│   └── ...
└── tools/                     # [결정론적 표준 검증 도구]
    ├── verify_essay.js        # 글자수/바이트/클리셰/문장분산 통합 검증 CLI
    ├── test_hard_vs_heuristic.js # 12대 직교성 및 경계조건 회귀 테스트 스위트
    ├── validate_intake.js     # 5대 입력 계약 사전 검증 도구
    ├── verify_all_user_drafts.js # 전체 마스터 자소서 일괄 검증기
    ├── sync_schedule.js       # D-Day 역산 및 일정 동기화 스크립트
    ├── run_benchmarks.js      # 4대 벤치마킹 테스트 러너
    └── sync_github.js         # GitHub 안전 동기화 스크립트
```

---

## 🛠️ CLI 사용법

### 1. 자기소개서 정밀 검증 (`verify_essay.js`)
```bash
# 파일 내 특정 문항 검증 (공백 포함 최대 500자)
node tools/verify_essay.js --file companies/lguplus.md --section "1번" --max 500

# EUC-KR 바이트 기준 검증 (최대 1000바이트)
node tools/verify_essay.js --file companies/lguplus.md --section "1번" --max 1000 --type byte

# 직접 텍스트 검증 (JSON 출력 모드)
node tools/verify_essay.js --text "검증할 자소서 본문 내용..." --max 500 --json
```

### 2. 직교성 및 경계 조건 회귀 테스트 실행 (`test_hard_vs_heuristic.js`)
```bash
node tools/test_hard_vs_heuristic.js
```
*출력 예시:*
```text
================================================================
🧪 Hard Constraints vs Heuristic Signals & Boundary Regression Suite
================================================================
--- [Part 1: Hard vs Heuristic 직교성 검증] ---
✅ [TC01] 글자수 초과 ➔ FAIL: PASS
✅ [TC02] 바이트 초과 ➔ FAIL: PASS
✅ [TC03] 금지/클리셰 표현만 존재 ➔ PASS + WARNING: PASS
✅ [TC04] 문장 길이 균일성만 존재 ➔ PASS + WARNING: PASS
✅ [TC05] 글자수 초과 + 클리셰 ➔ FAIL + WARNING: PASS
✅ [TC06] Hard Constraint 모두 통과 ➔ PASS + warningCount 0: PASS

--- [Part 2: 경계 조건(Boundary Conditions) 정밀 검증] ---
✅ [BC01] 상한 경계값 정합 (Exact 500 / Max 500) ➔ PASS: PASS
✅ [BC02] 상한 1자 초과 경계 결함 (Off-by-One: 501 / Max 500) ➔ FAIL (Delta: +1): PASS
✅ [BC03] 하한 경계값 정합 (Exact 300 / Min 300) ➔ PASS: PASS
✅ [BC04] 하한 1자 미달 경계 결함 (Off-by-One: 299 / Min 300) ➔ FAIL: PASS
✅ [BC05] 상한 경계값 정합(500자) + 클리셰 감지 결합 ➔ PASS + WARNING: PASS
✅ [BC06] 실제 인코딩 기준 바이트 경계값 정밀 검증 (EUC-KR & UTF-8): PASS
================================================================
📊 테스트 결과: 총 12개 | 통과: 12개 | 실패: 0개 (패스율: 100%)
================================================================
```

---

## 🏆 면접 및 기술 어필 포인트
- **신뢰할 수 있는 LLM 파이프라인 구축**: 단순 프롬프트 엔지니어링에 의존하지 않고, 코드로 강제되는 결정론적 게이트웨이(`verify_essay.js`)와 블라인드 감사 에이전트(`fact_checker`)를 계층화하여 결과물의 무결성을 실현.
- **오차값 기반 폐루프 미세 피드백**: 초과/미달 발생 시 전체를 다시 작성하는 비효율을 방지하고, 오차값(`Metric Delta`)만큼만 집중 미세 수술(Delta Revision)하도록 제어.
- **직교 검증 철학**: 경계값(Hard)과 문체 품질(Heuristic)을 명확히 분리하여 불필요한 재작성 루프를 차단하고 사람다운 자연스러운 글의 호흡 보존.
