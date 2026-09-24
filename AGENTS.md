# 🤖 Agentic Document Orchestrator: Multi-Agent Closed-Loop Specification (AGENTS.md)

이 문서는 **결정론적 가드레일 도구와 LLM 서브에이전트가 상호 보완하는 자율 문서 생성 및 검증 폐루프(Evaluator-Optimizer Pattern)**의 표준 아키텍처 명세서입니다.

---

## 1. 아키텍처 개요 (Architecture Overview)

* **핵심 철학**: LLM에게 비결정론적 작업(글자 수 계산, 사실 검증, 규격 준수)을 맡기지 않는다. 비결정론적 AI 생성 앞뒤에 **결정론적 코드 게이트(Deterministic Code Gates)**를 배치하여 무결점을 보장한다.
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
│ [Gate 2] tools/verify_essay.js (정량 실측 검증)        │ ➔ 실패 시 오차 델타 피드백 ➔ Step 2
└────────────────────────────────────────────────────────┘
           │ (글자수/바이트/금지어/문장분산 PASS)
           ▼
┌────────────────────────────────────────────────────────┐
│ [Step 5] invoke_subagent(fact_checker) (정성 감사)     │ ➔ 반려 시 결함 피드백 ➔ Step 2
└────────────────────────────────────────────────────────┘
           │ (6대 무결성 기준 ALL PASS)
           ▼
     [최종 무결점 산출물 반환]
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

2. **`verify_essay.js` (정량 계측 도구)**:
   - **역할**: 생성된 텍스트의 물리적 수치를 0.1의 오차 없이 실측.
   - **검증 항목**: 공백 포함/제외 글자 수, EUC-KR(2byte)/UTF-8 바이트, 정규식 금지어/상투어 감지, 문장별 글자 수 분산(단문 20~35자, 복문 70~90자).

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
