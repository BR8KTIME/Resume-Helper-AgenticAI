# 🚀 Resume-Helper-AgenticAI (v2.0)

[![Tests](https://img.shields.io/badge/tests-12%20passed-brightgreen.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-blue.svg)]()
[![Architecture](https://img.shields.io/badge/architecture-Deterministic%20Agentic%20Loop-orange.svg)]()

> **"Beyond simple prompt engineering: Decoupling Hard Constraints from Heuristic Quality Signals, enforced by a deterministic verification engine and verified with regression tests."**

An enterprise-grade, multi-agent AI system designed for high-stakes employment applications and technical essays. It prevents hallucinations, eliminates corporate clichés, guarantees strict character/byte constraints, and preserves authentic candidate voice through an **autonomous closed-loop verification pipeline**.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    User["Candidate / Engineer"] -->|Raw Experience & Dilemma| Gate1["[Gate 1] tools/validate_intake.js<br>(Mandatory 5-Field Input Contract)"]
    
    Gate1 -->|PASS| Editor["Resume Editor Subagent<br>(resume_editor)"]
    Gate1 -->|FAIL: Missing field| Block1["Strict Halt & Input Request"]
    
    Editor -->|Generates Draft (STAR + Action 60%)| Gate2["[Gate 2] tools/verify_essay.js<br>(Deterministic Rule Engine)"]
    
    Gate2 -->|Hard Violations: Char/Byte Overrun| DeltaFeedback["Metric Delta Feedback<br>(send_message session revision)"]
    DeltaFeedback --> Editor
    
    Gate2 -->|Hard PASS (Heuristic Warnings Allowed)| Gate3["[Gate 3] fact_checker<br>(Blind 6-Point Integrity Audit)"]
    
    Gate3 -->|FAIL: Hallucinated CS/Job mismatch| RejectLoop["Factual Correction Feedback"]
    RejectLoop --> Editor
    
    Gate3 -->|APPROVED / APPROVED WITH WARNINGS| FinalPass["Master Document Sync & Complete"]
```

---

## 🎯 3 Core Engineering Pillars

### 1. Orthogonality: Hard Constraints vs. Heuristic Quality Signals
- **Hard Constraints (`FAIL` ➔ Mandatory Automated Correction)**:
  - Exact character limits (with/without spaces).
  - Deterministic byte bounds (`Buffer.byteLength(str, 'utf8')` for UTF-8, exact code-point calculation for EUC-KR/CP949).
  - Factual integrity: Hallucinated algorithms, fabricated metrics, or company name mismatches.
- **Heuristic Quality Signals (`PASS + WARNING` ➔ Advisory Improvements)**:
  - Corporate clichés & buzzwords (`synergy`, `passionately worked overnight`, etc.).
  - Sentence length uniformity / monotony analysis (`Sentence Variance`).
  - Phrasing and flow suggestions.
  - *Heuristic warnings are fed back to the editor, but DO NOT artificially fail a draft or cause infinite loops.*

### 2. Boundary-Condition Regression Test Suite
Enforces exact contracts with 12 regression tests across both orthogonality and boundary conditions:
- **BC01 (Exact Max Bound)**: 500 characters / max 500 ➔ `PASS`
- **BC02 (Off-by-One Violation)**: 501 characters / max 500 ➔ `FAIL` (`Delta: +1`)
- **BC03 (Exact Min Bound)**: 300 characters / min 300 ➔ `PASS`
- **BC04 (Off-by-One Violation)**: 299 characters / min 300 ➔ `FAIL` (`Delta: -1`)
- **BC05 (Orthogonality)**: Exact 500 characters + Cliché detected ➔ `PASS + WARNING`
- **BC06 (Byte Boundaries)**: Precise EUC-KR (100B boundary) & UTF-8 `Buffer.byteLength` ➔ `PASS/FAIL`

### 3. Single-Session Subagent Lifecycle & Agentic State Machine
- Preserves conversation context and eliminates zombie agent processes by maintaining a persistent session (`send_message`) instead of spawning redundant instances.
- State transitions are strictly governed by the `EssayState` interface:
  `INPUT_REQUIRED` ➔ `DRAFTING` ➔ `QUANTITATIVE_REVIEW` ➔ `QUALITATIVE_REVIEW` ➔ `COMPLETED`.

---

## 📂 Repository Structure

```text
Resume-Helper-AgenticAI/
├── README.md                  # Project overview & technical specification
├── AGENTS.md                  # Multi-Agent Closed-Loop Specification
├── package.json               # Scripts & project metadata
├── LICENSE                    # MIT License
├── .gitignore                 # Privacy safeguards
├── draft_input.template.md    # Starter input intake template
├── agents/                    # Subagent system prompts & behavioral rules
│   ├── job_analyst.md         # JD deconstruction & skill extraction
│   ├── resume_editor.md       # STAR draft generator & minimal-invasive optimizer
│   └── fact_checker.md        # Blind 6-point integrity audit gatekeeper
├── tools/                     # Deterministic verification tools (Node.js)
│   ├── validate_intake.js     # Gate 1: Mandatory input contract gatekeeper
│   ├── verify_essay.js        # Gate 2: Deterministic char/byte/cliché validator
│   └── test_hard_vs_heuristic.js # 12-case regression test suite
├── tests/                     # Automated regression test suite
│   ├── run_tests.js           # Multi-case test runner
│   ├── test_cases.json        # Standard benchmark cases
│   └── test_hard_vs_heuristic.js # Boundary regression suite
└── samples/                   # Sample demonstration data
    ├── sample_profile.md      # Mock candidate profile
    ├── sample_input.md        # Pre-configured input notes
    └── sample_output.md       # Verified sample essay & audit report
```

---

## 🛠️ CLI Usage & Quickstart

```bash
# 1. Run the boundary condition regression suite
node tools/test_hard_vs_heuristic.js

# 2. Run the full benchmark suite
npm test

# 3. Verify an essay draft against hard and heuristic constraints
node tools/verify_essay.js --text "Your essay content..." --max 500 --json
```

---

## 📜 License
MIT License. Free for personal and commercial adaptation.
