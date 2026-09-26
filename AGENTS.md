# 🤖 Agentic Document Orchestrator: Multi-Agent Closed-Loop Specification (AGENTS.md)

이 문서는 **검증 코드와 LLM 서브에이전트가 상호 보완하는 자율 문서 생성 및 검증 폐루프(Evaluator-Optimizer Pattern)**의 표준 아키텍처 명세서입니다.

---

## 1. 아키텍처 개요 (Architecture Overview)

* **핵심 철학**: LLM에게 정확한 수치 계산이나 형식 준수 판정을 맡기지 않는다. 생성 결과의 객관적으로 판정 가능한 조건은 **검증 코드(Hard Constraints)**로 강제하고, 문체·상투어처럼 정답을 단정하기 어려운 요소는 **품질 신호(Heuristic Quality Signals)**로 분리한다.
* **구조**: `1 Main Orchestrator` + `3 Specialist Subagents` + `2 Deterministic Code Tools`

```text
[사용자 요청: "자소서 작성해줘"]
           │
           ▼
┌────────────────────────────────────────────────────────┐
│ [Gate 1] tools/validate_intake.js (입력 계약 검증)     │ ➔ 누락 시 즉시 차단 & 입력 요구
└────────────────────────────────────────────────────────┘
           │ (5대 필수 입력 100% 충족 승인)
           ▼
┌────────────────────────────────────────────────────────┐
│ [Step 2] invoke_subagent(resume_editor)                │ ➔ STAR 구조 초안 생성
└────────────────────────────────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────────────────────┐
│ [Gate 2] tools/verify_essay.js (제약 조건 & 품질 신호) │ ➔ HARD FAIL 시 delta 피드백 ➔ Step 2
└────────────────────────────────────────────────────────┘
           │ (Hard Constraints PASS / Heuristic WARNING 전달 가능)
           ▼
┌────────────────────────────────────────────────────────┐
│ [Step 5] invoke_subagent(fact_checker) (정성 감사)     │ ➔ 반려 시 결함 피드백 ➔ Step 2
└────────────────────────────────────────────────────────┘
           │ (Hard Constraints PASS + fact_checker APPROVED)
           ▼
     [최종 검증 완료 산출물 반환]
```

---

## 2. 참여 주체 명세 (Agents & Tools)

### 👑 메인 오케스트레이터 (Main Orchestrator)
* **역할**: 직접 글을 창작하지 않으며, 아래 2개 도구와 3개 서브에이전트를 순차 호출하고 피드백 루프를 총괄 관리하는 지휘자.

---

### 🛡️ 2대 결정론적 코드 도구 (Deterministic Code Tools)

1. **`validate_intake.js` (입력 계약 게이트키퍼)**:
   - **역할**: 작성을 시작하기 전, 아래 **5대 필수 입력(Input Contract)**이 완비되었는지 코드로 사전 검증.
     1) `company`: 지원 기업명
     2) `job_description`: 공식 JD 및 직무 필수 요구역량
     3) `question`: 문항 번호 및 질문
     4) `char_limit`: 최대 글자 수 한도
     5) `user_experience`: 지원자의 실제 공학적 경험/행동 팩트
   - **원칙**: 단 하나라도 누락 시 `Exit Code 1`로 차단하며, 사용자에게 누락 항목을 요청할 때까지 작성을 일절 개시하지 않음.

2. **`verify_essay.js` (검증 및 품질 신호 도구)**:
   - **역할**: 생성된 텍스트의 객관적 제약 조건을 측정하고, 주관적 품질 요소는 heuristic signal로 별도 보고한다.
   - **Hard Constraints**:
     * 공백 포함/제외 글자 수
     * EUC-KR/UTF-8 바이트 수
     * 지정된 최소/최대 글자 수
     * 필수 형식 조건
   - **Heuristic Quality Signals**:
     * 정규식 기반 상투어/클리셰 감지
     * 문장 길이 균일성 분석
   - **원칙**: Hard Constraint 위반만 `FAIL`로 처리한다. Heuristic 탐지는 `WARNING`으로 보고하며 단독으로 `FAIL`을 발생시키지 않는다.

---

### 👥 3대 전문 서브에이전트 (Specialist Subagents)

1. **`job_analyst` (기업/직무 분석가)**:
   - **역할**: 공식 채용 공고문(PDF) 원문 해체, 3년 이내 최신 산업 동향 팩트 리서치, 직무 요구역량 추출.
   - **위임 시점**: 사용자가 직무 분석이나 JD 요구역량 정리를 요청할 때.

2. **`resume_editor` (자소서 작성 및 첨삭가)**:
   - **역할**: 두괄식 구조 선언, STAR 플롯, 행동(Action) 60% 비중, 지원자 친화적 실무 공학 언어로 본문 작성 및 피드백 반영 재작성.
   - **위임 시점**: `validate_intake.js` 통과 후 초안 작성 및 피드백 수정 시.

3. **`fact_checker` (무결성 감찰관)**:
   - **역할**: 메인 에이전트와 독립된 블라인드 시각에서 6대 무결성 기준(JD 정합성, 연구 사실 날조 적발, AI 단조로움, 추상어 배제 등) 전수 감사.
   - **위임 시점**: `verify_essay.js` 정량 실측 통과 직후.

---

## 3. 표준 8단계 자율 실행 프로토콜 (The 8-Step Closed-Loop Protocol)

```text
[Step 1] tools/validate_intake.js 실행 (5대 입력 계약 검증)
   │     ├─ FAIL ➔ 사용자에게 누락 정보 요청 후 대기
   │     └─ PASS ➔ Step 2 진입
   ▼
[Step 2] invoke_subagent(resume_editor) ➔ 초안 생성
   │
   ▼
[Step 3] tools/verify_essay.js 실행 ➔ 정량 실측
   │     ├─ FAIL ➔ 오차 델타(초과 글자수, 금지어) 추출
   │     │          ★기존 통과 문맥 유지 지시와 함께 [Step 2] 재호출
   │     └─ PASS ➔ Step 5 진입
   ▼
[Step 5] invoke_subagent(fact_checker) 호출 ➔ 6대 정성 감사
   │     ├─ REJECT ➔ 결함 critique 추출
   │     │            ★결함 부분만 집중 보완 지시와 함께 [Step 2] 재호출
   │     └─ APPROVED ➔ Step 7 진입
   ▼
[Step 7] 모든 검증 통과 (ALL PASS) ➔ 최종 결과 사용자 반환
   │
[Step 8] maxRetries(5회) 초과 시 ➔ 무한 루프 차단 및 실패 상태/원인 리포트 반환
```
