# falsegreen-skill on Claude

This document covers three ways to run falsegreen-skill on Claude: Claude Code
(CLI), Claude.ai chat, and the Anthropic API. All three modes share the same
SKILL.md protocol and J1-J6 judgment framework.

---

## Model selection

| Model | Use case |
|---|---|
| `claude-sonnet-4-6` | Default. Best balance of precision and speed for most suites. |
| `claude-haiku-4-5-20251001` | Fast and cheap. Good for interactive review or large batches where a quick first pass is acceptable. |
| `claude-opus-4-8` | Deep analysis. Use for complex case 18 investigations, contested findings, or paper-facing results. |

---

## Mode 1: Claude Code (CLI)

Claude Code is the primary path. The skill ships as a Claude Code plugin and
loads from `skills/falsegreen-llm/SKILL.md`.

### Setup

Install the plugin from the marketplace:

```
/plugin marketplace add vinicq/falsegreen-skill
/plugin install falsegreen-skill@falsegreen
```

After install, the skill is available as the namespaced command
`/falsegreen-skill:falsegreen-llm`. It also triggers on natural-language
intent, so a plain request like "analyze this test file for false-positive
smells" works without the slash command.

### Basic usage

```
/falsegreen-skill:falsegreen-llm
```

Then say what to analyze:

```
analyze tests/
```

Claude Code discovers test files automatically using its built-in Glob and Read
tools — no need to paste code or list paths manually. It searches for
`test_*.py`, `*_test.py`, `*.test.ts`, `*.spec.ts`, `*.test.tsx`,
`*.spec.tsx`, `*.test.js`, and `*.spec.js`. Backend modules and frontend
component tests (React, Vue, Angular) are found in the same pass.

### Useful prompts

```
/falsegreen-skill:falsegreen-llm analyze tests/unit/ - focus on J2 and J3
```

```
/falsegreen-skill:falsegreen-llm I only care about HIGH confidence findings
```

```
run J1 only across the entire test suite, using the falsegreen protocol
```

### Pre-pass with the falsegreen scanner (Python)

For Python projects, run the static scanner first to get structural findings
without consuming tokens on patterns the AST can catch:

```bash
falsegreen tests/
```

Paste the scanner output into the conversation:

```
Here is the falsegreen scanner output for tests/test_payments.py:

<paste output>

Apply semantic judgment on top of these findings and check for cases 10-12, 15, 18.
```

Claude will skip the structural pass (Step 2 in the protocol) and go directly
to semantic adjudication for each flagged item.

### Multi-agent mode for large suites

For test suites with more than ~20 files, spawn one agent per file to run in
parallel. Each agent gets one file, runs the full protocol, and returns a JSON
findings block. A coordinator agent merges results and deduplicates.

In Claude Code:

```
/falsegreen-skill:falsegreen-llm For each file in tests/, spawn a subagent that
applies the full J1-J6 protocol and returns findings as JSON. Merge and
summarize at the end.
```

---

## Mode 2: Claude.ai chat

Claude.ai can use a custom Agent Skill package where that feature is available.
Build the standalone package first:

```bash
npm run build:targets
```

Then package or upload `dist/claude-agent-skill/` using Claude.ai's custom
skills workflow. If custom skills are not available in your account, fall back
to pasting the protocol manually.

### Step-by-step

1. Open a new conversation on claude.ai.
2. If the Agent Skill is not installed, copy the full content of `SKILL.md` and paste it at the start of your
   first message, wrapped in a code block or between clear delimiters.
3. Attach the test file (use the attachment button) or paste the test code
   directly after the protocol.
4. Send.

### Minimal prompt template

```
Below is the falsegreen-skill protocol. Apply it to the test file I'm attaching.

--- PROTOCOL START ---
<paste SKILL.md contents here>
--- PROTOCOL END ---

Test file: [attach file or paste code below]
```

### Pre-pass tip

If you ran `falsegreen` locally, include its output before the test code:

```
Here is the scanner output:
<paste scanner output>

Here is the test file:
<paste test code>

Perform semantic adjudication on the scanner findings (skip Step 2, go to Step 3).
```

### Recommended model on Claude.ai

Use Claude Sonnet (default) for most cases. Switch to Claude Opus for case 18
analysis when the expected value needs adversarial verification against a spec
or API contract.

---

## Mode 3: Anthropic API

Use the API when you want programmatic output — CI pipelines, batch analysis,
or building a tool on top of the skill.

### Basic usage (Python)

```python
import anthropic
import pathlib

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY from environment

skill_protocol = pathlib.Path("SKILL.md").read_text(encoding="utf-8")
test_code = pathlib.Path("tests/test_payments.py").read_text(encoding="utf-8")

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=4096,
    system=skill_protocol,
    messages=[
        {"role": "user", "content": test_code}
    ]
)

print(response.content[0].text)
```

### With falsegreen pre-pass output

```python
scanner_output = "<paste or read falsegreen CLI output here>"
test_code = pathlib.Path("tests/test_payments.py").read_text(encoding="utf-8")

user_message = f"""The falsegreen scanner produced the following output for this file.
Skip Step 2 (structural pass) and apply Steps 3-6 (semantic judgment) on each finding.

Scanner output:
{scanner_output}

Test file:
{test_code}
"""

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=4096,
    system=skill_protocol,
    messages=[
        {"role": "user", "content": user_message}
    ]
)
```

### Extended thinking for case 18

Case 18 (expected value contradicts what the code should do) requires
adversarial verification against an independent oracle. Enable extended
thinking when this case is suspected or when running deep analysis with
`claude-opus-4-8`:

```python
response = client.messages.create(
    model="claude-opus-4-8",
    max_tokens=16000,
    thinking={
        "type": "enabled",
        "budget_tokens": 10000
    },
    system=skill_protocol,
    messages=[
        {
            "role": "user",
            "content": (
                "Focus on case 18. Apply adversarial verification before "
                "reporting any finding. Cite the independent oracle.\n\n"
                + test_code
            )
        }
    ]
)
```

Extended thinking is available on `claude-opus-4-8` and `claude-sonnet-4-6`.
Set `budget_tokens` between 5000 and 16000 depending on how many tests need
deep verification.

### Batch analysis across a directory

```python
import anthropic
import pathlib

client = anthropic.Anthropic()
skill_protocol = pathlib.Path("SKILL.md").read_text(encoding="utf-8")

test_dir = pathlib.Path("tests/")
results = {}

for test_file in sorted(test_dir.rglob("test_*.py")):
    test_code = test_file.read_text(encoding="utf-8")
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=skill_protocol,
        messages=[{"role": "user", "content": test_code}]
    )
    results[str(test_file)] = response.content[0].text

for path, report in results.items():
    print(f"\n{'='*60}")
    print(f"FILE: {path}")
    print(report)
```

For large suites, consider prompt caching to avoid re-sending SKILL.md on
every request. Mark the system prompt with `cache_control` to enable the
cache:

```python
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=4096,
    system=[
        {
            "type": "text",
            "text": skill_protocol,
            "cache_control": {"type": "ephemeral"}
        }
    ],
    messages=[{"role": "user", "content": test_code}]
)
```

The cache is valid for 5 minutes. Sequential file analysis within that window
avoids redundant input token charges for the protocol text.

---

## Combining the scanner and the skill

The falsegreen static scanner (Python AST) and this skill are designed to work
together:

1. Run `falsegreen tests/` for fast structural detection (C1-C45, C48, CC, D1-D6, M2).
2. Pass the scanner output to Claude as context.
3. Claude applies semantic judgment (cases 10, 11, 12, 15, 18) and adjudicates
   any structural findings that need human-level interpretation.

This split keeps token costs low while ensuring semantic cases are not missed.
For non-Python languages (TypeScript, JavaScript), step 1 is skipped and Claude
handles the full pass.

---

## Output format

All three modes produce the same output structure defined in SKILL.md Step 6:

```
CASE {number} ({J1-J6}) - {HIGH | LOW} - {language} - {level: unit|integration|e2e} - {intent}

Test: {function name, line range}
Finding: {one sentence}
Evidence: {the specific lines}
Oracle: {case 18 only: cite the independent oracle}
Fix hint: {one sentence}
```

Followed by a summary block:

```
SUMMARY
Tests reviewed: N
Findings: M (H high, L low)
Clean: N-M
```

HIGH confidence means there is no plausible legitimate interpretation of the
pattern. LOW means the finding is real but context could change the verdict.
Precision is the priority: a wrong HIGH is worse than a missed LOW.
