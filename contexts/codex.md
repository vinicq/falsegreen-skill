# falsegreen-skill on OpenAI / Codex

How to use the falsegreen-skill J1-J6 protocol with ChatGPT, the OpenAI API,
structured output, Codex CLI, and batch pipelines.

---

## Installation (Codex CLI)

Two paths:

1. **Plugin (interactive).** The Codex CLI installs plugins from inside the
   TUI, not from a subcommand. Start Codex and open the plugins panel:

   ```bash
   codex
   ```

   Then run `/plugins` and add this repo as a source. The plugin manifest lives
   at `.codex-plugin/plugin.json`, the marketplace catalog at
   `.agents/plugins/marketplace.json`, and the shared skill at
   `skills/falsegreen-llm/SKILL.md`.

2. **Clone the repo.** `AGENTS.md` at the repo root loads automatically when
   Codex starts a session inside the clone.

Note: if you were relying on a `~/.codex/prompts/` custom prompt, the plugin or
`AGENTS.md` path above is the maintained way to load this protocol. Keep using
your own prompts if they work for you; nothing here requires removing them.

---

## Compact load order for Codex (context budget)

Codex loads project guidance into a host context with a working budget of
about **32 KiB**. The full set of protocol files does not fit: `SKILL.md`
(~29 KB) plus `AGENTS.md` (~11 KB) plus this guide (~18 KB) is roughly 58 KB
loaded together, well past the budget. Loading all three at once truncates
the protocol mid-file and the analysis degrades silently.

Load the compact path instead. It carries the same J1-J6 protocol and case
catalog through the single-source fragments, not a separate summary, so it
cannot drift from the canonical text.

Eager (always loaded when Codex opens the project):

1. **`AGENTS.md`** - the project pointer. Codex reads it automatically at the
   repo root. It carries the compact J1-J6 protocol, the compact semantic-case
   table, and the precision-first rules. The semantic-case table and the
   precision rules are injected from `fragments/semantic-cases-compact.md` and
   `fragments/precision-rules.md` by `scripts/sync-host-files.mjs`, so they
   stay byte-identical to the canonical fragments. This file alone is enough
   to run the protocol on a typical file and fits the budget on its own.

On demand (load only when the case calls for it, never eagerly):

2. **`reference.md`** - the full per-language pattern catalog with examples and
   look-alike exemptions. At ~80 KB it never fits eagerly. Pull the relevant
   section only when a finding needs the full pattern definition or an
   exemption check that the compact table does not spell out.
3. **`SKILL.md`** - the full prose protocol, edge cases, and multi-agent mode.
   Load it only when you need the long-form judgment wording or the multi-agent
   procedure; the compact protocol in `AGENTS.md` covers routine review.

Single-source rule: the compact path MUST reference the J1-J6 protocol and the
case catalog through `AGENTS.md` (which is synced from the `fragments/*`
single sources) and through `reference.md` on demand. Do not fork a separate
compact summary of the protocol or the case table into this guide or anywhere
else - a forked summary drifts from the canonical text the moment either side
is edited. If a fragment changes, run `npm run sync:hosts` to re-inject it.

---

## Model recommendations

Codex routes to OpenAI's current default model (the GPT-5 family at the time of
writing). The CLI picks the version; this guide does not pin one, because a
hard version string goes stale on the next release. The table below maps the
three analysis passes to the capability you need, not to a frozen model id.

| Use case | Model |
|---|---|
| Default (production review) | Codex's current default model |
| Fast / cheap batch | A smaller, faster sibling of the default (for example a `mini` variant) |
| Reasoning-heavy, case 18 analysis | A reasoning-tier model, with extended reasoning enabled |

The current default handles all six judgments reliably, including the semantic
cases (10, 11, 12, 15, 18). Drop to a smaller sibling when throughput or cost
matters more than precision on edge cases. Use a reasoning-tier model when a
case 18 finding needs extended chain-of-thought to cite an oracle and run an
adversarial check.

For the API examples below, set `model` to the id your account exposes for the
current default (or its reasoning tier). See `models.yaml` for the canonical
tier-to-capability mapping the docs are validated against.

**Note on reasoning models:** some OpenAI reasoning models (the o-series) do
not accept a `system` message. When using one, fold the skill protocol into
the first user message instead. See the reasoning-model section below.

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
    model="gpt-5",  # Codex's current default model; use the id your account exposes
    messages=[
        {"role": "system", "content": skill_protocol},
        {"role": "user", "content": test_code},
    ],
)

print(response.choices[0].message.content)
```

### Reasoning models (o-series)

Some OpenAI reasoning models do not accept a `system` role. Combine the
protocol and the test code in a single user message:

```python
from pathlib import Path
from openai import OpenAI

client = OpenAI()

skill_protocol = Path("SKILL.md").read_text(encoding="utf-8")
test_code = Path("tests/test_example.py").read_text(encoding="utf-8")

user_message = f"{skill_protocol}\n\n---\n\n{test_code}"

response = client.chat.completions.create(
    model="o3",  # any current OpenAI reasoning model that omits the system role
    messages=[
        {"role": "user", "content": user_message},
    ],
)

print(response.choices[0].message.content)
```

Use a reasoning model selectively for individual tests where case 18 is
suspected, not for full-file batch runs - latency and cost are significantly
higher.

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
      "language": { "type": "string", "enum": ["Python","TypeScript","JavaScript","Robot"] },
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
            "language": {"type": "string", "enum": ["Python","TypeScript","JavaScript","Robot"]},
            "framework": {"type": "string"},
        },
        "required": ["findings","summary","language","framework"],
        "additionalProperties": False,
    },
    "strict": True,
}

response = client.chat.completions.create(
    model="gpt-5",  # Codex's current default model; use the id your account exposes
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

The Codex CLI has no `--context` flag. To load the protocol for a one-off run,
pipe the test file on stdin (`-`) and reference the skill from the prompt, or
prepend `SKILL.md` to the input:

```bash
codex "Apply the falsegreen-skill J1-J6 protocol from SKILL.md to the test file on stdin, and report false-positive smells" - < tests/test_example.py
```

To feed the protocol text inline, concatenate `SKILL.md` and the test file:

```bash
cat SKILL.md tests/test_example.py | codex "Analyze the test file below the protocol for false-positive smells" -
```

For a persistent setup, put the skill reference in `AGENTS.md` (next section) so
every session in the project picks it up without repeating it on the command line.

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
            "language": {"type": "string", "enum": ["Python","TypeScript","JavaScript","Robot"]},
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
        model="gpt-5-mini",   # smaller sibling of the default; use the full default for higher precision
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

- A smaller sibling of the default (a `mini` variant) is the right default for
  batch runs. It is markedly cheaper than the full default and handles the
  structural families (A-E) accurately. Switch to the full default when
  reviewing files that are likely to contain semantic cases (10, 11, 12, 15, 18).
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
