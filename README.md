# Resume-Helper-AgenticAI

[![Google Antigravity](https://img.shields.io/badge/Powered%20by-Google%20Antigravity-4285F4.svg)]()
[![Node.js Version](https://img.shields.io/badge/node.js-18%2B-green.svg)](https://nodejs.org/)
[![Multi-Agent Architecture](https://img.shields.io/badge/architecture-Multi--Agent%20Closed--Loop-blue.svg)]()
[![Exact Verification](https://img.shields.io/badge/verification-Exact%20Byte%20%26%20Char-orange.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **A Google Antigravity-native Multi-Agent Document Orchestration Workflow Template with Deterministic Verification Gates & Autonomous Quality Audits.**

---

## 📌 Overview

Writing technical and corporate application essays requires meeting **strict, unforgiving constraints**:
* **Exact character limits** (with/without spaces).
* **Multi-byte encoding limits** (EUC-KR 2-byte, UTF-8 3-byte systems).
* **Zero AI clichés & monotony** (filtering out generic buzzwords like "synergy", uniform sentence cadences, and fabricated claims).

Large Language Models (LLMs) struggle with deterministic math, character counting, and consistent self-auditing. 

**Resume-Helper-AgenticAI** solves this by leveraging **Google Antigravity's native multi-agent orchestration**. Instead of relying on brittle external API scripts, Antigravity's **Main Agent** acts as the orchestrator, collaborating with specialized subagents (`job_analyst`, `resume_editor`, `fact_checker`) and enforcing **deterministic code gates** (`validate_intake.js`, `verify_essay.js`) in an autonomous closed loop (Evaluator-Optimizer Pattern).

---

## 🏗️ System Architecture & Multi-Agent Closed-Loop

The system decouples drafting from deterministic verification to eliminate AI hallucinations and ensure quantitative compliance:

```mermaid
flowchart TD
    subgraph User["User Request in Antigravity Chat"]
        Req["'Write / refine my essay for Company X'"]
    end

    subgraph Gate1["Gate 1: Input Contract Verification (Deterministic Code)"]
        VIntake["tools/validate_intake.js<br/>(Verifies 5 Mandatory Inputs)"]
    end

    subgraph MainAgent["Antigravity Main Agent (Orchestrator)"]
        Orch["Orchestrator<br/>(Coordinates Subagents & Gate Tools)"]
    end

    subgraph DraftingAgent["Subagent: Drafting & Optimization"]
        Editor["resume_editor<br/>(STAR Plot, Action 60%, Bottom-Line First)"]
    end

    subgraph Gate2["Gate 2: Quantitative Measurement (Deterministic Code)"]
        VEssay["tools/verify_essay.js<br/>(Exact Chars, EUC-KR Bytes, Clichés, Sentence Variance)"]
    end

    subgraph AuditAgent["Subagent: Qualitative Audit"]
        Checker["fact_checker<br/>(Independent 6-Point Fact & Integrity Audit)"]
    end

    subgraph Result["Final Output"]
        Done["Verified Zero-Defect Essay"]
    end

    Req --> Orch
    Orch --> VIntake
    VIntake -- "FAIL (Missing Input)" --> UserPrompt["Block & Request Missing Information"] --> User
    VIntake -- "PASS" --> Editor
    Editor --> VEssay
    VEssay -- "FAIL (Limits / Clichés / Monotony)" --> |Feed Delta Feedback| Editor
    VEssay -- "PASS" --> Checker
    Checker -- "REJECT (Vague buzzwords / Flow breaks)" --> |Feed Critique Feedback| Editor
    Checker -- "APPROVED" --> Done

    style User fill:#f8f9fa,stroke:#adb5bd,stroke-width:1px
    style Gate1 fill:#ffe3e3,stroke:#e03131,stroke-width:2px
    style MainAgent fill:#e7f5ff,stroke:#1971c2,stroke-width:2px
    style DraftingAgent fill:#d0ebff,stroke:#339af0,stroke-width:2px
    style Gate2 fill:#fff3bf,stroke:#f59f00,stroke-width:2px
    style AuditAgent fill:#e6fcf5,stroke:#20c997,stroke-width:2px
    style Result fill:#d3f9d8,stroke:#2b8a3e,stroke-width:2px
```

---

## 🚀 Key Components

### 1. 🛡️ 2 Deterministic Code Tools (`tools/`)
* **Gate 1: Input Contract Gatekeeper (`tools/validate_intake.js`)**:
  - Enforces the **5-point intake contract** before drafting begins:
    1. `company`: Target company name
    2. `job_description`: Official job description & required skills
    3. `question`: Essay prompt and number
    4. `char_limit`: Character / byte constraint
    5. `user_experience`: Raw engineering facts and actions taken
  - Returns `Exit Code 1` on missing inputs, prompting the user for complete data and preventing AI fabrication from thin air.
* **Gate 2: Exact Quantitative Verifier (`tools/verify_essay.js`)**:
  - **Multi-Byte Precision**: Calculates exact character counts, EUC-KR (2 bytes), and UTF-8 (3 bytes).
  - **Sentence Variance & Monotony Audit**: Rejects uniform AI cadence (e.g. all sentences ~45 chars); enforces balanced short punchy sentences (20~35 chars) and compound action sentences (70~90+ chars).
  - **Anti-Cliché Filter**: Scans for and flags artificial AI idioms (`귀사`, `시너지`, `역량을 함양`, `100% 일치`, middle-dot `·`).

### 2. 👥 3 Specialized Subagent Personas (`agents/` & `AGENTS.md`)
* **`job_analyst` (`agents/job_analyst.md`)**: Parses official job posting PDFs/text, extracts core technical requirements, and conducts market/company research.
* **`resume_editor` (`agents/resume_editor.md`)**: Crafts bottom-line-first (두괄식) STAR essays, focusing 60%+ of the content on engineering actions and authentic terminology.
* **`fact_checker` (`agents/fact_checker.md`)**: Operates as a blind auditor evaluating drafts against a strict 6-point integrity rubric (JD alignment, hallucination detection, anti-monotony, and evidence validation).

---

## 📂 Repository Structure

```text
Resume-Helper-AgenticAI/
├── README.md                  # Project overview & Antigravity guide
├── AGENTS.md                  # Standard Multi-Agent Closed-Loop Specification
├── package.json               # Scripts & project metadata
├── LICENSE                    # MIT License
├── .gitignore                 # Privacy safeguards
├── draft_input.template.md    # Starter template for drafting essays
├── agents/                    # Subagent system prompts & behavioral rules
│   ├── job_analyst.md         # JD deconstruction & skill extraction
│   ├── resume_editor.md       # STAR draft generator & optimizer
│   └── fact_checker.md        # Independent 6-point audit gatekeeper
├── tools/                     # Deterministic verification tools (Node.js)
│   ├── validate_intake.js     # Gate 1: Mandatory input contract gatekeeper
│   └── verify_essay.js        # Gate 2: Character, byte, variance & cliché validator
├── tests/                     # Automated regression test suite
│   ├── test_cases.json        # Standard evaluation cases
│   └── run_tests.js           # Test runner
└── samples/                   # Sample demonstration data
    ├── sample_profile.md      # Mock candidate profile (Marketing Specialist)
    ├── sample_input.md        # Pre-configured input notes & draft
    └── sample_output.md       # Verified sample essay & audit report
```

---

## ⚡ Getting Started in Google Antigravity

This repository is designed to run seamlessly inside **Google Antigravity**. You do **not** need external API keys, proxy servers, or custom script runners.

### Step 1. Open in Google Antigravity
Open or clone this repository as a workspace in Google Antigravity:
```bash
git clone https://github.com/BR8KTIME/Resume-Helper-AgenticAI.git
```

### Step 2. Start Chatting with the Main Agent
Simply prompt Antigravity's Main Agent in natural language. For example:

> *"samples/sample_input.md 파일을 참고해서 문항 1번 자소서 작성해줘."*  
> *"HD현대마린솔루션 DT설계 직무 1번 문항 초안 작성하고 검증 루프 돌려줘."*

### Step 3. Autonomous Closed-Loop Execution
Antigravity automatically executes the workflow:
1. **Gate 1 Execution**: Runs `node tools/validate_intake.js --file <input>` to ensure all 5 required fields are present.
2. **Drafting**: Invokes the `resume_editor` subagent to generate an initial STAR draft.
3. **Gate 2 Verification**: Executes `node tools/verify_essay.js` to mathematically check character counts, EUC-KR bytes, sentence variance, and clichés.
   - *If verification fails*: The Main Agent provides exact numerical deltas back to `resume_editor` to adjust length while preserving passing sentences.
4. **Audit**: Invokes `fact_checker` to verify claims and authenticity.
5. **Delivery**: Presents the verified final text and audit score.

---

## 🛠️ Standalone Tool Usage (CLI)

You can also run the deterministic tools independently from your terminal:

### 1. Validate Input Intake Contract
```bash
node tools/validate_intake.js --file ./samples/sample_input.md
```

### 2. Verify Character Limits & Sentence Variance
```bash
# Verify character limits (e.g., 400 to 500 characters)
node tools/verify_essay.js --text "작성된 자기소개서 본문..." --min 400 --max 500

# Verify EUC-KR byte limits (e.g., max 1,000 bytes)
node tools/verify_essay.js --file ./draft_output.md --max 1000 --type euckr

# Output structured JSON for IDE integration
node tools/verify_essay.js --file ./samples/sample_output.md --json
```

### 3. Run the Automated Regression Test Suite
Run continuous integration tests against diverse evaluation cases:
```bash
npm test
```

---

## 👤 Author

* **Hasung Cho**
  * GitHub: [@BR8KTIME](https://github.com/BR8KTIME)
  * Email: lifeofcho23@gmail.com

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
