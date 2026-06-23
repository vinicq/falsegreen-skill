# falsegreen-skill on OpenAI / Codex

How to use the falsegreen-skill J1-J6 protocol with ChatGPT, the OpenAI API,
structured output, Codex CLI, and batch pipelines.

---

## Installation (Codex CLI)

Two official paths:

1. **Plugin marketplace:**

   ```bash
   codex plugin marketplace add vinicq/falsegreen-skill
   ```

   The plugin manifest lives at `.codex-plugin/plugin.json`, the marketplace
   catalog at `.agents/plugins/marketplace.json`, and the shared skill at
   `skills/falsegreen-llm/SKILL.md`.

2. **Clone the repo.** `AGENTS.md` at the repo root loads automatically when
   Codex starts a session inside the clone.

Note: OpenAI deprecated `~/.codex/prompts/` custom prompts in favor of skills.
Use one of the two paths above instead.

---

## Model recommendations

| Use case | Model |
|---|---|
| Default (production review) | `gpt-4o` |
| Fast / cheap batch | `gpt-4o-mini` |
| Reasoning-heavy — case 18 analysis | `o3` |

`gpt-4o` is the right starting point. It handles all six judgments reliably,
including the semantic cases (10, 11, 12, 15, 18). Use `gpt-4o-mini` when
throughput or cost matters more than precision on edge cases. Use `o3` when
you need extended chain-of-thought for a case 18 finding that requires citing
an oracle and running an adversarial check.

**Note on o3:** o3 does not support a `system` message. Fold the skill
protocol into the first user message instead. See the o3 section below.

---

## 1. ChatGPT (chat.openai.com)

### One-off review

1. Open [chat.openai.com](https://chat.openai.com).
2. Paste the full contents of `SKILL.md` at the start of the conversation, followed by a blank line.
3. Paste the test file or snippet you want to analyze.
4. Send.

The model will work through Steps 1-6 of the protocol and produce a report
in the `CASE N (JX) - HIGH|LOW` format with a SUMMARY block at the end.

### Persistent context with Projects

ChatGPT Projects let you pin a system instruction that persists across all
conversations in that project. Use this to avoid pasting `SKILL.md` every
time.

1. Create a new Project in ChatGPT.
2. Open **Project Instructions** (gear icon or project settings).
3. Paste the full text of `SKILL.md` into the instructions field.
4. Save.

From that point on, every conversation in the project starts with the skill
protocol loaded. You only need to paste the test code.

**Tip:** name the project something like `falsegreen review` so it is easy to
open when you want a quick analysis during a PR review.

---

## 2. OpenAI API (Python)

### Basic usage

```python
from pathlib import Path
from openai import OpenAI

client = OpenAI()  # reads OPENAI_API_KEY from environment

skill_protocol = Path("SKILL.md").read_text(encoding="utf-8")
test_code = Path("tests/test_example.py").read_text(encoding="utf-8")

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": skill_protocol},
        {"role": "user", "content": test_code},
    ],
)

print(response.choices[0].message.content)
```

### o3 (reasoning model)

o3 does not accept a `system` role. Combine the protocol and the test code
in a single user message:

```python
from pathlib import Path
from openai import OpenAI

client = OpenAI()

skill_protocol = Path("SKILL.md").read_text(encoding="utf-8")
test_code = Path("tests/test_example.py").read_text(encoding="utf-8")

user_message = f"{skill_protocol}\n\n---\n\n{test_code}"

response = client.chat.completions.create(
    model="o3",
    messages=[
        {"role": "user", "content": user_message},
    ],
)

print(response.choices[0].message.content)
```

Use o3 selectively for individual tests where case 18 is suspected, not for
full-file batch runs — latency and cost are significantly higher.

---

## 3. Structured output

When you need machine-readable results — for CI integration, dashboards, or
dataset collection — use OpenAI's structured output feature with a JSON
schema.

### Schema

```json
{
  "name": "falsegreen_report",
  "schema": {
    "type": "object",
    "properties": {
      "findings": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "case":           { "type": "string" },
            "judgment":       { "type": "string", "enum": ["J1","J2","J3","J4","J5","J6"] },
            "confidence":     { "type": "string", "enum": ["HIGH","LOW"] },
            "language":       { "type": "string", "enum": ["Python","TypeScript","JavaScript","Robot"] },
            "level":          { "type": "string", "enum": ["unit","integration","e2e"] },
            "intent":         { "type": "string", "enum": ["spec","char","regression","behavior"] },
            "test":           {
              "type": "object",
              "properties": { "name": { "type": "string" } },
              "required": ["name"],
              "additionalProperties": false
            },
            "finding":        { "type": "string" },
            "evidence":       { "type": "array", "items": { "type": "string" } },
            "oracle":         { "type": "string" },
            "fix_hint":       { "type": "string" }
          },
          "required": ["case","judgment","confidence","language","level","intent","test","finding","evidence","fix_hint"],
          "additionalProperties": false
        }
      },
      "summary": {
        "type": "object",
        "properties": {
          "tests_reviewed": { "type": "integer" },
          "high":           { "type": "integer" },
          "low":            { "type": "integer" },
          "clean":          { "type": "integer" }
        },
        "required": ["tests_reviewed","high","low","clean"],
        "additionalProperties": false
      },
      "language": { "type": "string" },
      "framework": { "type": "string" }
    },
    "required": ["findings","summary","language","framework"],
    "additionalProperties": false
  },
  "strict": true
}
```

### Python usage

```python
import json
from pathlib import Path
from openai import OpenAI

client = OpenAI()

skill_protocol = Path("SKILL.md").read_text(encoding="utf-8")
test_code = Path("tests/test_example.py").read_text(encoding="utf-8")

schema = {
    "name": "falsegreen_report",
    "schema": {
        "type": "object",
        "properties": {
            "findings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "case":            {"type": "string"},
                        "judgment":        {"type": "string", "enum": ["J1","J2","J3","J4","J5","J6"]},
                        "confidence":      {"type": "string", "enum": ["HIGH","LOW"]},
                        "language":        {"type": "string", "enum": ["Python","TypeScript","JavaScript","Robot"]},
                        "level":           {"type": "string", "enum": ["unit","integration","e2e"]},
                        "intent":          {"type": "string", "enum": ["spec","char","regression","behavior"]},
                        "test":            {
                            "type": "object",
                            "properties": {"name": {"type": "string"}},
                            "required": ["name"],
                            "additionalProperties": False,
                        },
                        "finding":         {"type": "string"},
                        "evidence":        {"type": "array", "items": {"type": "string"}},
                        "oracle":          {"type": "string"},
                        "fix_hint":        {"type": "string"},
                    },
                    "required": ["case","judgment","confidence","language","level","intent","test","finding","evidence","fix_hint"],
                    "additionalProperties": False,
                },
            },
            "summary": {
                "type": "object",
                "properties": {
                    "tests_reviewed": {"type": "integer"},
                    "high":           {"type": "integer"},
                    "low":            {"type": "integer"},
                    "clean":          {"type": "integer"},
                },
                "required": ["tests_reviewed","high","low","clean"],
                "additionalProperties": False,
            },
            "language": {"type": "string"},
            "framework": {"type": "string"},
        },
        "required": ["findings","summary","language","framework"],
        "additionalProperties": False,
    },
    "strict": True,
}

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": skill_protocol},
        {"role": "user",   "content": test_code},
    ],
    response_format={"type": "json_schema", "json_schema": schema},
)

report = json.loads(response.choices[0].message.content)

for f in report["findings"]:
    print(f"CASE {f['case']} ({f['judgment']}) - {f['confidence']} - {f['test']['name']}: {f['finding']}")

s = report["summary"]
print(f"\nSUMMARY: {s['tests_reviewed']} reviewed, {s['high']} high, {s['low']} low, {s['clean']} clean")
```

### Schema field guide

| Field | Description |
|---|---|
| `case` | Pattern code: `C1`, `C3`, `10`, `18`, etc. |
| `judgment` | The first judgment that failed: `J1` through `J6` |
| `confidence` | `HIGH` (no plausible legitimate interpretation) or `LOW` (likely smell) |
| `language` | `Python`, `TypeScript`, or `JavaScript` |
| `intent` | `spec`, `char`, `regression`, or `behavior` |
| `test.name` | Name of the test function |
| `finding` | One sentence describing what is wrong |
| `evidence` | Array of specific line(s) that triggered the finding |
| `oracle` | Required only for semantic case `18`; not used for structural code `C18` |
| `fix_hint` | One sentence suggestion |
| `summary.tests_reviewed` | Total number of test functions analyzed |
| `summary.high` | Count of HIGH-confidence findings |
| `summary.low` | Count of LOW-confidence findings |
| `summary.clean` | Count of tests with no findings |

---

## 4. Codex CLI

If you installed the plugin, Codex discovers `skills/falsegreen-llm/SKILL.md`
through `.codex-plugin/plugin.json`. If you only cloned this repo, Codex reads
`AGENTS.md` as project guidance; that is useful, but it is not the same as an
installed skill. The options below cover running the protocol in a project that
has neither.

### Per-session context

Pass `SKILL.md` as a context file using the `--context` flag:

```bash
codex --context SKILL.md "Analyze the following test file for false-positive smells" < tests/test_example.py
```

Or pipe with explicit context:

```bash
codex --context SKILL.md < tests/test_example.py
```

### Project-level configuration

Add a section to your project's `AGENTS.md` (Codex CLI reads it automatically
when present) that points Codex to the skill:

```markdown
## Test quality analysis

To analyze a test file for false-positive test smells, apply the
falsegreen-skill J1-J6 protocol from `SKILL.md`. Always follow
the six steps in order: detect language, apply Python catalog if Python,
classify test intent, apply J1-J6, adversarial-verify case 18, report.
Output findings as: CASE N (JX) - HIGH|LOW / Test / Finding / Evidence / Fix hint.
End with a SUMMARY block.
```

Then invoke:

```bash
codex "analyze tests/test_example.py for false-positive smells"
```

Codex will load the project `AGENTS.md` context and apply the protocol.

### Test discovery

When the plugin is installed or `AGENTS.md` is present, Codex can find test
files automatically — you do not need to list paths. Say:

- "find and analyze all test files in this project"
- "run falsegreen on every test under tests/"
- "check the component tests in src/__tests__/"

Codex runs shell commands to discover files by pattern:

| Language | Patterns |
|---|---|
| Python | `test_*.py`, `*_test.py` |
| TypeScript / TSX | `*.test.ts`, `*.spec.ts`, `*.test.tsx`, `*.spec.tsx` |
| JavaScript / JSX | `*.test.js`, `*.spec.js`, `*.test.jsx`, `*.spec.jsx` |

Frontend component tests (React, Vue, Angular) match the same patterns and are
analyzed with the same J1-J6 protocol as backend tests.

---

## 5. Batch processing

For large test suites, split by file and run API calls in parallel using
`asyncio`. This keeps total wall-clock time close to the slowest single file
rather than the sum of all files.

```python
import asyncio
import json
from pathlib import Path
from openai import AsyncOpenAI

client = AsyncOpenAI()
skill_protocol = Path("SKILL.md").read_text(encoding="utf-8")

SCHEMA = {
    "name": "falsegreen_report",
    "schema": {
        "type": "object",
        "properties": {
            "findings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "case":            {"type": "string"},
                        "judgment":        {"type": "string", "enum": ["J1","J2","J3","J4","J5","J6"]},
                        "confidence":      {"type": "string", "enum": ["HIGH","LOW"]},
                        "language":        {"type": "string", "enum": ["Python","TypeScript","JavaScript","Robot"]},
                        "level":           {"type": "string", "enum": ["unit","integration","e2e"]},
                        "intent":          {"type": "string", "enum": ["spec","char","regression","behavior"]},
                        "test":            {
                            "type": "object",
                            "properties": {"name": {"type": "string"}},
                            "required": ["name"],
                            "additionalProperties": False,
                        },
                        "finding":         {"type": "string"},
                        "evidence":        {"type": "array", "items": {"type": "string"}},
                        "oracle":          {"type": "string"},
                        "fix_hint":        {"type": "string"},
                    },
                    "required": ["case","judgment","confidence","language","level","intent","test","finding","evidence","fix_hint"],
                    "additionalProperties": False,
                },
            },
            "summary": {
                "type": "object",
                "properties": {
                    "tests_reviewed": {"type": "integer"},
                    "high":           {"type": "integer"},
                    "low":            {"type": "integer"},
                    "clean":          {"type": "integer"},
                },
                "required": ["tests_reviewed","high","low","clean"],
                "additionalProperties": False,
            },
            "language": {"type": "string"},
            "framework": {"type": "string"},
        },
        "required": ["findings","summary","language","framework"],
        "additionalProperties": False,
    },
    "strict": True,
}


async def analyze_file(path: Path) -> dict:
    test_code = path.read_text(encoding="utf-8")
    response = await client.chat.completions.create(
        model="gpt-4o-mini",   # use gpt-4o for higher precision
        messages=[
            {"role": "system", "content": skill_protocol},
            {"role": "user",   "content": test_code},
        ],
        response_format={"type": "json_schema", "json_schema": SCHEMA},
    )
    report = json.loads(response.choices[0].message.content)
    return {"file": str(path), **report}


async def analyze_suite(test_dir: str) -> list[dict]:
    paths = list(Path(test_dir).rglob("test_*.py")) + \
            list(Path(test_dir).rglob("*_test.py")) + \
            list(Path(test_dir).rglob("*.test.ts")) + \
            list(Path(test_dir).rglob("*.spec.ts"))
    tasks = [analyze_file(p) for p in paths]
    return await asyncio.gather(*tasks)


if __name__ == "__main__":
    results = asyncio.run(analyze_suite("tests/"))

    total_high = sum(r["summary"]["high"] for r in results)
    total_low  = sum(r["summary"]["low"]  for r in results)
    total_rev  = sum(r["summary"]["tests_reviewed"] for r in results)

    print(f"Files analyzed: {len(results)}")
    print(f"Tests reviewed: {total_rev}")
    print(f"HIGH findings:  {total_high}")
    print(f"LOW findings:   {total_low}")

    for result in results:
        if result["summary"]["high"] > 0:
            print(f"\n{result['file']}")
            for f in result["findings"]:
                if f["confidence"] == "HIGH":
                    print(f"  CASE {f['case']} ({f['judgment']}) - {f['test']['name']}: {f['finding']}")
```

**Practical notes:**

- `gpt-4o-mini` is the right default for batch runs. It is 10-15x cheaper
  than `gpt-4o` and handles the structural families (A-E) accurately. Switch
  to `gpt-4o` when reviewing files that are likely to contain semantic cases
  (10, 11, 12, 15, 18).
- Split files larger than ~300 lines into logical groups before sending. The
  model's precision degrades when a single message contains too many test
  functions.
- Add a semaphore (`asyncio.Semaphore`) to cap concurrent requests if you hit
  rate limits:
  ```python
  sem = asyncio.Semaphore(10)  # max 10 concurrent requests

  async def analyze_file(path: Path) -> dict:
      async with sem:
          ...  # rest of the function unchanged
  ```

---

## Related files

- [`SKILL.md`](../SKILL.md) - the full J1-J6 protocol (system prompt)
- [`reference.md`](../reference.md) - per-language case catalog
- [`providers.md`](../providers.md) - all supported LLM providers
- [`contexts/`](./) - provider-specific context files
