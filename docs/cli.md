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
falsegreen-skill --help
falsegreen-skill --version
```

Multiple files are analyzed in separate API calls. Plain-text output is printed
under a `=== {filename} ===` header. With `--json`, the CLI validates each model
response against the canonical schema and emits one aggregate JSON report.

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
