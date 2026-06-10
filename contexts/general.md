# falsegreen-skill — general usage guide

This document covers how to run falsegreen-skill on any instruction-following
LLM that is not listed in a dedicated context file. It applies to LLaMA,
Mistral, Qwen, Kimi, Phi, Command R, and any model you access through a chat
interface, an OpenAI-compatible API, or a local runtime like Ollama.

The J1-J6 judgment framework and the SKILL.md protocol are provider-agnostic.
The skill works as long as the model can follow multi-step instructions and
reason about code.

---

## The minimal pattern

The only thing you need to run the skill is `SKILL.md`. Everything else in this
repo is optional tooling.

**If the platform has a system prompt field:**

1. Copy the full contents of `SKILL.md` into the system prompt field.
2. Paste the test code into the user message.
3. Send.

**If the platform has no system prompt field (single message box only):**

Use the self-contained template at the end of this document.

That is the complete integration. No SDK, no library, no configuration file
required.

For any OpenAI-compatible provider, the zero-dependency CLI is the fastest
path: `npx falsegreen-skill analyze <files>` (see `docs/cli.md`).

---

## OpenAI-compatible APIs

Most LLM providers expose an OpenAI-compatible chat completions endpoint. You
can use the `openai` Python SDK for all of them by changing only `base_url`,
`api_key`, and `model`.

### Universal Python snippet

```python
import pathlib
from openai import OpenAI

# Change these three values for each provider
BASE_URL = "https://api.groq.com/openai/v1"
API_KEY  = "YOUR_API_KEY"
MODEL    = "llama-3.3-70b-versatile"

client = OpenAI(base_url=BASE_URL, api_key=API_KEY)

skill_protocol = pathlib.Path("SKILL.md").read_text(encoding="utf-8")
test_code      = pathlib.Path("tests/test_example.py").read_text(encoding="utf-8")

response = client.chat.completions.create(
    model=MODEL,
    messages=[
        {"role": "system", "content": skill_protocol},
        {"role": "user",   "content": test_code},
    ],
    max_tokens=4096,
)

print(response.choices[0].message.content)
```

### Provider table

| Provider | base_url | Model example |
|---|---|---|
| Groq (LLaMA) | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| Together.ai (LLaMA) | `https://api.together.xyz/v1` | `meta-llama/Llama-3.1-405B-Instruct` |
| Ollama (local) | `http://localhost:11434/v1` | `llama3.3`, `qwen2.5-coder` |
| OpenRouter | `https://openrouter.ai/api/v1` | `Qwen/Qwen2.5-72B-Instruct` |
| Moonshot Kimi | `https://api.moonshot.cn/v1` | `kimi-k2-0711-instruct` |
| Mistral | `https://api.mistral.ai/v1` | `mistral-large-latest` |

For Ollama the `api_key` value is ignored; pass any non-empty string such as
`"ollama"`.

---

## Minimum model requirements

Not every model is equal for this task. The cases vary in difficulty.

| Task | Minimum requirement | Notes |
|---|---|---|
| Structural patterns C1-C37 (assertion missing, always-true, etc.) | Any 7B+ instruction model | Pattern-matching level; small models handle it reliably |
| Semantic cases 10-15 (mocks SUT, echo value, formula copy, order-dependent) | 13B+ or any frontier API model | Requires reasoning about test intent, not just syntax |
| Case 18 adversarial verify (expected value contradicts spec) | 70B+ or frontier API model | Must hold two arguments in tension and cite an oracle; smaller models skip the refuter pass |

If you are using a small local model (7B-13B), restrict its role to structural
patterns. Route case 18 candidates to a stronger model before reporting.

---

## Prompt engineering tips

**Too many false alarms (low precision):**

Add this line to the system prompt or at the top of the user message:

```
When in doubt, report LOW, not HIGH. A wrong HIGH finding is worse than a
missed LOW one.
```

**Missing real problems (low recall):**

Add:

```
Be thorough. Check every test function individually.
```

**Model ignores part of the protocol:**

Break the request into explicit steps. Instead of sending the test code alone,
prefix it with:

```
Apply the falsegreen-skill protocol in order:
Step 1: detect language and framework.
Step 2: scan for structural patterns (Python only).
Step 3: classify each test as spec/TDD, characterization, regression, or behavior.
Step 4: apply J1-J6 to each test.
Step 5: adversarial verify any case 18 candidates.
Step 6: output the report in standard CASE / SUMMARY format.

Test code follows:
```

Smaller models benefit from explicit step enumeration more than frontier models.

---

## Ollama local usage

Ollama is a common local setup. `qwen2.5-coder:32b` is the best local model
for code analysis tasks at the time of writing.

Install the model:

```bash
ollama pull qwen2.5-coder:32b
```

Run the skill against a test file:

```python
import pathlib
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",  # required by the SDK, value is ignored
)

skill_protocol = pathlib.Path("SKILL.md").read_text(encoding="utf-8")
test_code      = pathlib.Path("tests/test_example.py").read_text(encoding="utf-8")

response = client.chat.completions.create(
    model="qwen2.5-coder:32b",
    messages=[
        {"role": "system", "content": skill_protocol},
        {"role": "user",   "content": test_code},
    ],
    max_tokens=4096,
)

print(response.choices[0].message.content)
```

For case 18 deep analysis locally, `qwen2.5-coder:32b` is marginal. Validate
its case 18 outputs against the benchmark or route those findings to a hosted
model.

---

## No-API usage (plain text prompt)

For chat interfaces with no separate system prompt field, combine the protocol
and the test code into one message. The template below is self-contained.

Copy it, replace `<TEST CODE HERE>` with your test file contents, and send the
whole thing as a single message:

```
You are a test quality analyzer. Follow the falsegreen-skill protocol below
exactly. Apply all steps in order to the test code at the end of this message.

--- PROTOCOL ---

A test is useful only if it fails when the code breaks. You are looking for
tests that pass while the code is wrong.

Step 1: Identify the language (Python / TypeScript / JavaScript) and test
framework.

Step 2 (Python only): Scan for structural patterns. Families:
  A - assertion never executes (dead branch, no assert, swallowed exception)
  B - assertion always passes (tautology, truthiness-only, self-compare, broad
      exception, string repr)
  C - test checks its own setup (pytest.raises wraps too much, unread binding,
      env mutation)
  D - external state dependency (skip-on-failure, hardcoded path, shared
      mutable state, try/pass, retry decorator)
  E - wrong thing checked (ML metric discarded, fail without reason, duplicate
      parametrize case)

Step 3: Classify each test as one of: spec/TDD, characterization, regression,
or behavior. A failing TDD test is not a false positive. A labeled
characterization snapshot is not a frozen bug.

Step 4: Apply six judgments to each test:
  J1 - Does at least one assertion actually execute at runtime?
  J2 - Is the expected value from an independent oracle (spec, contract,
       human judgment), not derived from the current code output?
  J3 - Is the real unit under test, not a mock of it?
  J4 - Does the assertion check a meaningful property, not just truthiness?
  J5 - Does the test avoid depending on implementation internals?
  J6 - Does the test pass in isolation, without ordering dependency?

Step 5 (case 18 only): Before reporting that an expected value contradicts what
the code should do, cite an independent oracle (spec, docstring, API contract,
domain rule). Run an adversarial check: argue that the expected value is
actually correct. Report case 18 HIGH only if that argument fails and the
oracle clearly contradicts the value.

Step 6: For each finding output:

  CASE {number} ({J1-J6}) - {HIGH | LOW} - {language}
  Test: {function name, line range}
  Finding: {one sentence}
  Evidence: {the specific lines}
  Oracle: {case 18 only}
  Fix hint: {one sentence}

Then output a summary:

  SUMMARY
  Tests reviewed: N
  Findings: M (H high, L low)
  Clean: N-M

Precision rule: when in doubt, report LOW. A wrong HIGH is worse than a
missed LOW.

--- TEST CODE ---

<TEST CODE HERE>
```

---

## Batch analysis across a directory

The universal snippet can loop over files with minimal changes:

```python
import pathlib
from openai import OpenAI

client = OpenAI(
    base_url="https://api.groq.com/openai/v1",
    api_key="YOUR_API_KEY",
)

skill_protocol = pathlib.Path("SKILL.md").read_text(encoding="utf-8")
test_dir       = pathlib.Path("tests/")

for test_file in sorted(test_dir.rglob("test_*.py")):
    test_code = test_file.read_text(encoding="utf-8")
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": skill_protocol},
            {"role": "user",   "content": test_code},
        ],
        max_tokens=4096,
    )
    print(f"\n{'='*60}")
    print(f"FILE: {test_file}")
    print(response.choices[0].message.content)
```

---

## Output format reference

All providers should produce the same output structure defined in SKILL.md
Step 6:

```
CASE {number} ({J1-J6}) - {HIGH | LOW} - {language}

Test: {function name, line range}
Finding: {one sentence describing what is wrong}
Evidence: {the specific line(s) that triggered this}
Oracle: {case 18 only: cite the independent oracle}
Fix hint: {one sentence suggestion}
```

Followed by:

```
SUMMARY
Tests reviewed: N
Findings: M (H high, L low)
Clean: N-M
```

HIGH means there is no plausible legitimate interpretation. LOW means the
finding is real but context could change the verdict. Precision is the
priority.
