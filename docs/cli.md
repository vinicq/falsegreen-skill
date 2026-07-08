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
falsegreen-skill generate <spec-file> [--lang <language>] [options]
falsegreen-skill fix <test-file> --case <code> --line <n> [options]
falsegreen-skill --help
falsegreen-skill --version
```

`analyze` is Mode A (review); `generate` is Mode B (authoring); `fix` is Mode C
(AI-fix). Multiple files given to `analyze` are analyzed in separate API calls.
Plain-text output is printed under a `=== {filename} ===` header. With `--json`,
the CLI validates each model response against the canonical schema and emits one
aggregate JSON report.

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

Default models: `anthropic` uses `claude-sonnet-5`, `openai` uses `gpt-5`,
`gemini` uses `gemini-2.5-flash`. For deep case 18 analysis, pass `--model claude-opus-4-8`
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

## `generate` - author a test from a spec (Mode B)

```
falsegreen-skill generate <spec-file> [--lang <language>] [options]
```

Renders a language-neutral test-spec into a real test, then runs `analyze` (Mode A)
on the result so a false-green test cannot pass the self-check undetected. It
catches false-green *shapes*, not a wrong-but-well-formed oracle. The spec is a
[`schema/test-spec.json`](../schema/test-spec.json) file (YAML or JSON);
[`examples/authoring/apply-discount.spec.yaml`](../examples/authoring/) is one spec
rendered into all four stacks.

| Flag | Meaning | Default |
|---|---|---|
| `--lang <language>` | `python`, `typescript`, `javascript`, `tsx`, `jsx`, or `robot`. `tsx`/`jsx` cover the React side of the JS/TS family (same shared JS* catalog `falsegreen-js` uses over `.js`/`.ts`/`.tsx`/`.jsx`). One language per run - the spec is the single source, re-run to render another stack | spec's first `languages` entry, else `python` |

```bash
# render the example spec to a Python test and self-check it
falsegreen-skill generate examples/authoring/apply-discount.spec.yaml --lang python

# same spec, TypeScript
falsegreen-skill generate examples/authoring/apply-discount.spec.yaml --lang typescript

# machine-readable: { language, test, self_check, self_check_passed, self_check_error }
falsegreen-skill generate my-spec.yaml --lang python --json
```

**Offline guards (no API call).** The command refuses early, exit 1, when the
language is unknown, the spec file is missing, or the spec carries no `oracle:` /
`expected:` key. The last is the point: a test generated from the code's current
output only freezes the bug (a characterization test). The guard anchors on the
keys, so the words in a comment no longer pass; the oracle's *value* is your
responsibility.

**Self-check and exit codes.** After generating, the CLI runs Mode A on the test.
If it trips a HIGH false-green finding, the CLI revises once and re-checks (bounded
to one revision - it is a command, not an agent loop). The exit code is the CI
contract, and it fails closed:

| Exit | State | Meaning |
|---|---|---|
| 0 | PASSED | self-check ran, no HIGH false-green |
| 1 | FAILED | a surviving false-green was confirmed (also: bad spec / API error via the offline guards above) |
| 3 | UNVERIFIED | the self-check could not run; the test is printed to stdout, the banner to stderr, and it is **not** accepted |

Gate CI on the exit code, or on `self_check_passed` in `--json`. The self-check is
a same-model static review, not an execution: it does not run the test, verify it
compiles/imports, or confirm the oracle value. `generate` needs a model that both
fits the ~33k-token prompt and can emit the JSON report - see the provider table
below.

## OpenAI-compatible providers

Every provider that speaks the OpenAI Chat Completions API works through
`--provider openai-compatible`: set `FALSEGREEN_API_KEY` to the provider key,
point `--base-url` at the `/v1` root (the CLI appends `/chat/completions`), and
pass the provider's model id with `--model`. The table below covers the common
hosts. "Fits 33k?" is whether the free tier accepts the skill's ~33k-token system
prompt; a paid tier on the same host usually lifts the cap.

| Provider | `--base-url` | Example `--model` | Free tier fits 33k prompt? |
|---|---|---|---|
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | No - 12k TPM cap (HTTP 413) |
| Cerebras | `https://api.cerebras.ai/v1` | `gpt-oss-120b` | No - token quota (HTTP 429) |
| OpenRouter | `https://openrouter.ai/api/v1` | `meta-llama/llama-3.3-70b-instruct` (or `:free`) | Partial - `:free` models are rate-limited upstream |
| NVIDIA NIM | `https://integrate.api.nvidia.com/v1` | `meta/llama-3.3-70b-instruct` | Yes, on most models |
| DeepInfra | `https://api.deepinfra.com/v1/openai` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` | No - needs positive balance (HTTP 402) |
| Mistral | `https://api.mistral.ai/v1` | `mistral-large-latest` | Paid |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` | Paid |
| Fireworks | `https://api.fireworks.ai/inference/v1` | `accounts/fireworks/models/llama-v3p3-70b-instruct` | Paid |
| Alibaba Qwen | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | `qwen-plus` (must be enabled on the account) | Region/plan dependent |
| Hugging Face | `https://router.huggingface.co/v1` | `meta-llama/Llama-3.3-70B-Instruct` | Yes, within monthly credits |
| Cohere | `https://api.cohere.ai/compatibility/v1` | `command-a-03-2025` | Trial key works, rate-limited |
| Ollama (local) | `http://localhost:11434/v1` | `qwen2.5-coder:32b` | Yes - local, no cap, any key placeholder |
| Ollama Cloud | `https://ollama.com/v1` | `gpt-oss:120b` | Plan dependent |

```bash
# example: OpenRouter (verified end-to-end for generate and analyze)
export FALSEGREEN_API_KEY=sk-or-...
falsegreen-skill analyze tests/test_payment.py \
  --provider openai-compatible \
  --base-url https://openrouter.ai/api/v1 \
  --model meta-llama/llama-3.3-70b-instruct --max-tokens 8192
```

Notes: Cohere is reached through its dedicated OpenAI-compatibility path
(`/compatibility/v1`), not its native `/v2/chat`. Ollama ignores the key, so any
placeholder (`FALSEGREEN_API_KEY=ollama`) works. Raise `--max-tokens` (8192+) for
reasoning models that spend budget on chain-of-thought and get cut off mid-report.

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
