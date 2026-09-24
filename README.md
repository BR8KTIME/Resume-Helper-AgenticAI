# Resume-Helper-AgenticAI

[![Node.js Version](https://img.shields.io/badge/node.js-18%2B-green.svg)](https://nodejs.org/)
[![Multi-Agent Architecture](https://img.shields.io/badge/architecture-Multi--Agent%20Closed--Loop-blue.svg)]()
[![Exact Verification](https://img.shields.io/badge/verification-Exact%20Byte%20%26%20Char-orange.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Author](https://img.shields.io/badge/Author-Hasung%20Cho%20%28BR8KTIME%29-blueviolet)](https://github.com/BR8KTIME)

> **A Multi-Agent System with Exact Character/Byte Verification & Autonomous Quality Audits for Job Application Essays.**

---

## 📌 Overview

Writing application essays for tech companies requires meeting **strict quantitative constraints**:
* Exact character counts (with/without spaces).
* Multi-byte encoding limits (EUC-KR 2-byte, UTF-8 3-byte).
* Filtering out repetitive, generic AI clichés ("synergy", "passionately", "contribute globally").

Large Language Models (GPT, Claude, Gemini) struggle to count characters mathematically and often hallucinate counts or introduce clichés. 

**Resume-Helper-AgenticAI** solves this by combining specialized AI agents with deterministic Node.js verification scripts. It provides a complete pipeline that drafts, measures, audits, and auto-corrects application essays until all constraints are 100% satisfied.

---

## 🏗️ How It Works (Multi-Agent Pipeline)

The system separates drafting from verification to guarantee high quality and factual accuracy:

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Candidate
    participant Orchestrator as Main Orchestrator
    participant JobAnalyst as Job Analyst (JD Spec)
    participant ResumeEditor as Resume Editor (STAR Draft)
    participant VerifyTool as Verification Tool (verify_essay.js)
    participant FactChecker as Fact Checker (Independent Audit)

    User->>Orchestrator: Input Target Role & Candidate Experiences
    Orchestrator->>JobAnalyst: Deconstruct JD & Extract Requirements
    JobAnalyst-->>Orchestrator: Structured Requirements & Character Limits
    Orchestrator->>ResumeEditor: Request STAR Draft (30% Situation, 60% Action)
    ResumeEditor-->>Orchestrator: Initial Draft

    rect rgb(240, 245, 255)
    Note over Orchestrator,FactChecker: Autonomous Quality & Constraint Loop
    Orchestrator->>VerifyTool: Run Exact Char/Byte & Cliché Analysis
    alt Verification FAILS (Limit Exceeded or Cliché Found)
        VerifyTool-->>Orchestrator: Exact Violation Metrics
        Orchestrator->>ResumeEditor: Auto-Revise Draft with Feedback
        ResumeEditor-->>Orchestrator: Revised Draft
    else Verification PASSES
        VerifyTool-->>Orchestrator: PASS Metrics (Chars, EUC-KR, UTF-8)
        Orchestrator->>FactChecker: Independent 6-Point Audit (Truth & Voice)
        alt Fact Checker REJECTS
            FactChecker-->>Orchestrator: REJECT (Logical break / Vague buzzword)
            Orchestrator->>ResumeEditor: Re-draft with Audit Findings
        else Fact Checker APPROVES
            FactChecker-->>Orchestrator: APPROVED Certification
        end
    end
    end

    Orchestrator-->>User: Final Verified Essay + Full Audit Report
```

---

## 🚀 Key Features

### 1. Exact Verification Tool (`tools/verify_essay.js`)
* **Multi-Byte Encoding Precision**: Calculates exact character counts, EUC-KR (2 bytes), and UTF-8 (3 bytes) with zero error.
* **Anti-Cliché Filter**: Scans for and flags artificial AI idioms and phrases (`귀사`, `시너지`, `역량을 함양`, `100% 일치`, middle-dot `·`).
* **Structure Ratio Analysis**: Heuristically checks the balance between **Situation (<30%)**, **Engineering Action (>60%)**, and **Results (<10%)**.

### 2. Specialized Multi-Agent Roles (`agents/`)
* **Job Analyst (`job_analyst.md`)**: Parses job descriptions and extracts core technical requirements.
* **Resume Editor (`resume_editor.md`)**: Drafts experience-focused essays using the STAR framework with a bottom-line-first approach (두괄식).
* **Fact Checker (`fact_checker.md`)**: Acts as an independent auditor to ensure the essay reflects authentic problem-solving and honest facts.

### 3. Automated Test Suite (`tests/`)
* Includes `tests/test_cases.json` covering realistic enterprise scenarios (Cloud/Distributed Systems, Autonomous Driving, Embedded Telecom).
* Run regression tests with a single command to ensure the tools work reliably.

---

## 📂 Repository Structure

```text
Resume-Helper-AgenticAI/
├── README.md               # Documentation & workflow overview
├── package.json            # Scripts & project metadata
├── LICENSE                 # MIT License
├── .gitignore              # Privacy safeguards
├── agents/                 # Specialized agent specifications
│   ├── job_analyst.md      # JD deconstruction
│   ├── resume_editor.md    # STAR draft generator
│   └── fact_checker.md     # Independent audit gatekeeper
├── tools/                  # Deterministic verification tools
│   ├── verify_essay.js     # Character, byte, and cliché validator
│   └── orchestrator.js     # Pipeline entrypoint
├── tests/                  # Automated test suite
│   ├── test_cases.json     # Standard evaluation cases
│   └── run_tests.js        # Test runner
└── samples/                # Sample demonstration data
    ├── sample_profile.md   # Mock candidate profile
    └── sample_output.md    # Verified sample essay
```

---

## ⚡ Getting Started

### 1. Run the Test Suite
Test the verification tools against the standard evaluation cases:
```bash
npm test
```

### 2. Verify an Essay Draft Directly
Check any draft text for character limits, byte sizes, and clichés:
```bash
# Check with character limits (e.g., 500 to 1,000 characters)
node tools/verify_essay.js --text "Your draft essay here..." --min 500 --max 1000

# Check EUC-KR byte limits (e.g., max 2,000 bytes)
node tools/verify_essay.js --text "Your draft essay here..." --max 2000 --type euckr

# Validate an entire file and output JSON
node tools/verify_essay.js --file ./samples/sample_output.md --json
```

---

## 👤 Author

* **Hasung Cho**
  * GitHub: [@BR8KTIME](https://github.com/BR8KTIME)
  * Email: lifeofcho23@gmail.com
  * Academic Background: M.S. in Computer Science & Engineering, POSTECH

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
