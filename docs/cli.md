# falsegreen-skill CLI

Command-line interface for running the falsegreen J1-J6 protocol against test files.
The CLI sends each file to an LLM provider with `llm.md` as the system prompt and
prints the resulting findings report. Zero dependencies, Node.js 18 or newer.

## Install

```bash
npm install -g falsegreen-skill
```

Or run without installing:

```bash
npx falsegreen-skill analyze tests/test_payment.py
```

## Quick start

### Anthropic (default provider)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
falsegreen-skill analyze tests/test_payment.py
```

### OpenAI

```bash
export OPENAI_API_KEY=sk-...
falsegreen-skill analyze tests/test_payment.py --provider openai
```

### Google Gemini

```bash
export GEMINI_API_KEY=...
falsegreen-skill analyze tests/test_payment.py --provider gemini
```

### Groq (openai-compatible)

```bash
export FALSEGREEN_API_KEY=gsk_...
falsegreen-skill analyze tests/test_payment.py \
  --provider openai-compatible \
  --base-url https://api.groq.com/openai/v1 \
  --model llama-3.3-70b-versatile
```

### Ollama (local, openai-compatible)

```bash
export FALSEGREEN_API_KEY=ollama
falsegreen-skill analyze tests/test_payment.py \
  --provider openai-compatible \
  --base-url http://localhost:11434/v1 \
  --model qwen2.5-coder:32b
```

The same pattern works for configured OpenAI-compatible providers: pass their
base URL and model name, and set `FALSEGREEN_API_KEY` to the provider key.

## Commands

```
falsegreen-skill analyze <file...> [options]
falsegreen-skill fix <test-file> --case <code> --line <n> [options]
falsegreen-skill --help
falsegreen-skill --version
```

`analyze` is Mode A (review); `fix` is Mode C (AI-fix). Multiple files given to
`analyze` are analyzed in separate API calls. Plain-text output is printed under a
`=== {filename} ===` header. With `--json`, the CLI validates each model response
against the canonical schema and emits one aggregate JSON report.

## Flags

| Flag | Description | Default |
|---|---|---|
| `--provider <name>` | `anthropic`, `openai`, `gemini`, or `openai-compatible` | `anthropic` |
| `--model <model>` | Model override. Required for `openai-compatible` | per provider (see below) |
| `--base-url <url>` | API base URL. Required for `openai-compatible` | none |
| `--json` | Validate and output a JSON report conforming to `schema/report.json` | off |
| `--conventions <file>` | Conventions YAML/text block injected per SKILL.md Step 0 | none |
| `--temperature <n>` | Sampling temperature 0.0–1.0. Skipped for OpenAI o-series (o3, o4-mini) | `0.2` |
| `--max-tokens <n>` | Max output tokens per request | `4096` |
| `--fail-on-high` | Exit with code 2 when any HIGH finding is present. Requires `--json` | off |

Default models: `anthropic` uses `claude-sonnet-4-6`, `openai` uses `gpt-4o`,
`gemini` uses `gemini-2.5-pro`. For deep case 18 analysis, pass `--model claude-opus-4-8`
(Anthropic) or `--model o3` (OpenAI). When using `o3`, `--temperature` is ignored automatically.

## Environment variables

| Variable | Used by |
|---|---|
| `ANTHROPIC_API_KEY` | `--provider anthropic` |
| `OPENAI_API_KEY` | `--provider openai` (and fallback for `openai-compatible`) |
| `GEMINI_API_KEY` | `--provider gemini` |
| `FALSEGREEN_API_KEY` | `--provider openai-compatible` (takes precedence over `OPENAI_API_KEY`) |

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Analysis completed (findings may still exist; this is an analysis tool, not a gate) |
| 1 | Error: missing file, missing API key, bad flag, invalid JSON, schema mismatch, non-2xx API response |
| 2 | `--fail-on-high` was set and the JSON report contains at least one HIGH finding |

## `fix` - propose a stronger test and prove it

```
falsegreen-skill fix <test-file> --case <code> --line <n> [options]
```

`analyze` finds a false-green; `fix` proposes a stronger test and runs a local gate
to prove it before you trust it. It is opt-in, **Python/pytest only**, and
**propose-only**: it prints a test-file patch but never applies it and never edits
production code. The provider flags above apply; `fix` adds these:

| Flag | Description |
|---|---|
| `--case <code>` | Catalog code of the finding to fix. V1 fixable set: `C2b`, `C20`, `C21`, `C5`, `C7` |
| `--line <n>` | Line of the finding in the test file (1-indexed) |
| `--sut <file>` | Production file the test protects. Required for a validated fix |
| `--sut-line <n>` | Line in the SUT to mutate. Defaults to `--line` |
| `--cheap` | Validation tier: parse + preserve only, no mutation gate |

```bash
# propose a patch for a C2b finding and run the full gate against the real SUT
falsegreen-skill fix tests/test_discount.py --case C2b --line 14 \
  --sut src/discount.py --sut-line 12

# parse + preserve only, no mutation gate (no runnable SUT, or a quick pass)
falsegreen-skill fix tests/test_discount.py --case C5 --line 9 --cheap

# machine-readable gate verdict (schema/fix-validation.json)
falsegreen-skill fix tests/test_discount.py --case C20 --line 22 \
  --sut src/discount.py --json
```

On a clean replica the gate runs three checks: the patch parses (`py_compile`), it
passes `pytest` against the real code (preserve), and it **fails** on a line-scoped
mutation of the SUT. A patch is accepted only when it passes on correct code and goes
red on the mutant. Exit code is 0 on accept, 1 on reject/unvalidated. Without `--sut`
(or with `--cheap`) the gate degrades to propose-only and labels the fix unvalidated.
The honest limit: it proves the fix catches the targeted mutant, not every possible
bug; JS/TS/Robot and the deep semantic cases (10/11/12/18) are v2.

## CI usage

Combine `--json` with `--fail-on-high` to gate a pipeline on HIGH-confidence
findings. GitHub Actions example:

```yaml
- name: Detect false-positive tests
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: |
    npx falsegreen-skill analyze tests/test_payment.py tests/test_orders.py \
      --json --fail-on-high > falsegreen-report.json

- name: Upload report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: falsegreen-report
    path: falsegreen-report.json
```

The step fails with exit 1 if the model returns invalid JSON or fields that do
not match `schema/report.json`. It fails with exit 2 only when the validated
report contains a HIGH-confidence finding. LOW findings and clean tests keep
the pipeline green.

## Project conventions

If your project uses custom assertion helpers or intentional patterns that
look like smells, declare them in a conventions file and pass it with
`--conventions`:

```yaml
conventions:
  custom_assertion_helpers:
    - verify_payment_state
  intentional_patterns:
    - "smoke tests in tests/smoke/ assert only that no exception is raised"
```

The block is injected before the file content, per Step 0 of the protocol,
so the model incorporates it before applying any judgment.
