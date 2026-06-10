# Multi-LLM invocation guide

falsegreen-skill is designed to run on any LLM provider. The SKILL.md protocol and
the J1-J6 judgment framework are provider-agnostic. This document covers how to
invoke the skill on each supported provider and how to integrate it with Cursor.

---

## Provider overview

| Provider | Default model | Fast/cheap tier | Deep reasoning tier |
|---|---|---|---|
| Anthropic (Claude) | claude-sonnet-4-6 | claude-haiku-4-5-20251001 | claude-opus-4-8 |
| OpenAI | gpt-4o | gpt-4o-mini | o3 |
| Google Gemini | gemini-2.5-pro | gemini-2.0-flash | gemini-2.5-pro (thinking) |
| Meta LLaMA (Groq) | llama-3.3-70b-versatile | - | llama-3.1-405b (Together.ai) |
| Alibaba Qwen | Qwen2.5-72B-Instruct | - | QwQ-32B |
| Moonshot Kimi | kimi-k2-0711-instruct | - | kimi-k2-0711-preview |

---

## Anthropic (Claude Code / API)

### Via Claude Code (primary path)

Install Claude Code, then load the skill in a session:

```
/falsegreen-skill
```

Attach a test file or paste a snippet. The skill reads SKILL.md automatically.

### Via API (programmatic)

```python
import anthropic

client = anthropic.Anthropic()
skill_protocol = open("SKILL.md").read()
test_code = open("tests/test_example.py").read()

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=2048,
    system=skill_protocol,
    messages=[{"role": "user", "content": test_code}]
)
print(response.content[0].text)
```

For structured JSON output, use tool use with the canonical schema from
`schema/finding.json` in this repo.

---

## OpenAI

```python
from openai import OpenAI

client = OpenAI()
skill_protocol = open("SKILL.md").read()
test_code = open("tests/test_example.py").read()

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": skill_protocol},
        {"role": "user", "content": test_code}
    ],
    response_format={"type": "json_object"}  # use the schema from schema/finding.json
)
print(response.choices[0].message.content)
```

**Note:** o1/o3 models do not support `system` messages; fold the protocol into the
first user message instead.

---

## Google Gemini

```python
import google.generativeai as genai

genai.configure(api_key="YOUR_API_KEY")
model = genai.GenerativeModel(
    model_name="gemini-2.5-pro",
    system_instruction=open("SKILL.md").read()
)
test_code = open("tests/test_example.py").read()
response = model.generate_content(test_code)
print(response.text)
```

For structured output, use `response_mime_type="application/json"` with a
`response_schema` matching the canonical schema.

---

## Meta LLaMA (via Groq)

```python
from groq import Groq

client = Groq()
skill_protocol = open("SKILL.md").read()
test_code = open("tests/test_example.py").read()

response = client.chat.completions.create(
    model="llama-3.3-70b-versatile",
    messages=[
        {"role": "system", "content": skill_protocol},
        {"role": "user", "content": test_code}
    ],
    response_format={"type": "json_object"}
)
print(response.choices[0].message.content)
```

**Alternative runtimes:** Ollama (local), Together.ai (llama-3.1-405b for deep cases).

---

## Alibaba Qwen (via OpenRouter)

Qwen is available via OpenRouter using the OpenAI-compatible API:

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="YOUR_OPENROUTER_KEY"
)
skill_protocol = open("SKILL.md").read()
test_code = open("tests/test_example.py").read()

response = client.chat.completions.create(
    model="qwen/qwen2.5-72b-instruct",
    messages=[
        {"role": "system", "content": skill_protocol},
        {"role": "user", "content": test_code}
    ]
)
print(response.choices[0].message.content)
```

**Reasoning variant:** `qwen/qwq-32b` for difficult case 18 analysis.

---

## Moonshot Kimi

Kimi uses an OpenAI-compatible API:

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://api.moonshot.cn/v1",
    api_key="YOUR_MOONSHOT_KEY"
)
skill_protocol = open("SKILL.md").read()
test_code = open("tests/test_example.py").read()

response = client.chat.completions.create(
    model="kimi-k2-0711-instruct",
    messages=[
        {"role": "system", "content": skill_protocol},
        {"role": "user", "content": test_code}
    ]
)
print(response.choices[0].message.content)
```

---

## Cursor

Cursor is an AI-native code editor that integrates Claude and GPT. Use
falsegreen-skill in Cursor via project rules.

### Setup

Create `.cursor/rules/falsegreen-skill.mdc` in your project:

```markdown
---
description: LLM-based false-positive test smell detection (falsegreen-skill)
globs:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/*.test.js"
  - "**/*.spec.js"
  - "**/*_test.py"
  - "**/*.test.py"
  - "**/test_*.py"
alwaysApply: false
---

When asked to analyze a test file for quality issues, apply the falsegreen-skill
protocol (J1-J6 judgments, cases 1-22):

1. Detect language and framework (Python/TS/JS/Java/C#/PHP/Ruby/C++)
2. For Python: suggest running `falsegreen <file>` first for structural checks
3. Classify test intent: spec/TDD, characterization, regression, or behavior
4. Apply the six judgments (J1-J6) per test
5. Report each finding as: CASE N (JX) - HIGH|LOW - language / Test / Finding / Evidence / Fix hint
6. End with SUMMARY: tests reviewed / findings / clean

Precision-first: never report case 18 without citing an independent oracle (spec,
docstring, API contract). A wrong HIGH finding is worse than a missed LOW one.

Full protocol and case catalog: https://github.com/vinicq/falsegreen-skill
```

### Usage

1. Open a test file in Cursor.
2. Open Cursor chat (`Ctrl+L` or `Cmd+L`).
3. Type: `analyze this test file for false-positive smells`
4. Cursor injects the rule context and applies the J1-J6 protocol.

### Cursor model selection

Cursor supports Claude and GPT models. For falsegreen-skill:
- `claude-sonnet-4-6` - default; best balance of precision and speed
- `gpt-4o` - solid alternative, slightly less precise on case 18
- Use the "long context" model option for files with many test functions

---

## Case 18 two-pass invocation

Case 18 (expected value contradicts the spec) requires two independent API calls with
separate context windows. A single call risks self-confirmation bias: the model that
found the issue will tend to defend it. The two-pass structure forces a genuine challenge.

**Pass 1 (finder):** system = SKILL.md content, user = test file + "Identify any case 18
candidates (expected value contradicts the spec). For each candidate, cite the independent
oracle."

**Pass 2 (refuter):** system = "You are a skeptical code reviewer. Your only job is to
argue that the expected value in this test is CORRECT. Assume the test author knew what
they were doing.", user = Pass 1's case 18 finding. If the refuter cannot mount a credible
defense, the finding stands as HIGH. If the refuter's argument holds, downgrade to LOW or
withdraw.

Use `claude-opus-4-8` or `o3` for both passes. See `models.yaml` for the full tier guide.

```python
from openai import OpenAI  # works for any OpenAI-compatible provider

client = OpenAI()  # set base_url + api_key for non-OpenAI providers
skill_protocol = open("SKILL.md").read()
test_code = open("tests/test_example.py").read()

# Pass 1: finder
finder_response = client.chat.completions.create(
    model="o3",
    messages=[
        {"role": "system", "content": skill_protocol},
        {
            "role": "user",
            "content": (
                test_code
                + "\n\nIdentify any case 18 candidates (expected value contradicts the spec)."
                + " For each candidate, cite the independent oracle."
            ),
        },
    ],
)
finder_finding = finder_response.choices[0].message.content

# Pass 2: refuter (fresh context window, no system protocol)
refuter_response = client.chat.completions.create(
    model="o3",
    messages=[
        {
            "role": "system",
            "content": (
                "You are a skeptical code reviewer. Your only job is to argue that the"
                " expected value in this test is CORRECT. Assume the test author knew"
                " what they were doing."
            ),
        },
        {
            "role": "user",
            "content": finder_finding,
        },
    ],
)
refuter_argument = refuter_response.choices[0].message.content

# Decision rule:
# - If the refuter cannot mount a credible defense -> finding stays HIGH
# - If the refuter's argument holds              -> downgrade to LOW or withdraw
print("--- Finder ---")
print(finder_finding)
print("\n--- Refuter ---")
print(refuter_argument)
```

---

## Choosing a provider

For **highest precision** (production/paper-facing use): Anthropic claude-sonnet-4-6
or claude-opus-4-8. These providers have the most validated benchmark results.

For **fastest response** (interactive review, many files): claude-haiku-4-5-20251001
or gpt-4o-mini. Precision may be lower for edge cases.

For **deep case 18 analysis** (expected value contradicts spec): claude-opus-4-8
or OpenAI o3. Both support extended chain-of-thought.

For **cost-sensitive batch analysis** (Dataset B collection): LLaMA via Groq
(free tier available). Validate results against the benchmark before trusting at scale.

For **local/offline use**: Ollama with llama-3.3-70b or Qwen2.5-72B. Quality
is lower than hosted providers but sufficient for initial triage.
