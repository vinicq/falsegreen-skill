# How to run falsegreen: CLI, API token, and the other ways

There is more than one way to run this skill. They share the same J1-J6 protocol
and the same three modes (A analysis, B authoring, C fix); they differ only in
what drives the model and where the prompt comes from. This page is the map.

## 1. CLI

The `falsegreen-skill` command (`bin/falsegreen-llm.js`) sends the test file (or
the spec, for `generate`) to a provider with the protocol as system prompt and
prints the result. Zero npm dependencies, Node >= 18.

```bash
npx falsegreen-skill analyze tests/test_payment.py            # Mode A
npx falsegreen-skill generate spec.yaml --lang python         # Mode B
npx falsegreen-skill fix tests/test_x.py --case C2b --line 14 --sut src/x.py  # Mode C
```

Full flag reference: [cli.md](cli.md).

## 2. Via API token (which provider you point the CLI at)

The CLI is provider-agnostic. "Via token" means: set the provider's key in the
environment and point the CLI at it. This is the same three commands above - the
only thing that changes is `--provider`, `--base-url`, and the key.

| Path | Key env var | How |
|---|---|---|
| Anthropic | `ANTHROPIC_API_KEY` | default provider, nothing else needed |
| OpenAI | `OPENAI_API_KEY` | `--provider openai` |
| Google Gemini | `GEMINI_API_KEY` | `--provider gemini` |
| Any OpenAI-compatible host | `FALSEGREEN_API_KEY` | `--provider openai-compatible --base-url <root> --model <id>` |

The OpenAI-compatible path covers Groq, Cerebras, OpenRouter, NVIDIA NIM,
DeepInfra, Mistral, DeepSeek, Fireworks, Alibaba Qwen, Hugging Face, Cohere, and
Ollama (local or cloud). Base URLs and example models for each are in the
provider table in [cli.md](cli.md#openai-compatible-providers).

**One caveat worth stating up front.** The system prompt carries the full catalog
(`llm.md` + `reference.md`), around 33k tokens. Providers with a small per-minute
token cap on their free tier reject the request outright. This is not a bug in the
CLI; it is the size of the protocol. Pick a host whose tier accepts a ~35k-token
request, or run Ollama locally where there is no cap.

## 3. The other ways

### Editor-host skill (Claude Code, Cursor, Gemini, Codex)

Installed as a plugin, the skill runs inside the assistant with no CLI and no key
of yours - it uses the host's model. This is the only path that runs **interactive
Mode B**: it asks you for the pyramid level, the language, and the oracle, then
writes and self-checks the test. The CLI cannot ask questions, so it takes those
answers from a spec file instead.

```
/plugin marketplace add vinicq/falsegreen-skill
/plugin install falsegreen-skill@falsegreen
```

Then attach a test file and ask for analysis, or ask it to "write a test for this
function against this spec". Setup per host: [providers.md](../providers.md).

### Raw protocol in any LLM

`llm.md` is the whole protocol as a single system prompt. Paste it into any chat
model, then paste your test - no install, no CLI. This is the lowest-common-
denominator path and what the CLI automates.

### Static scanner first, skill second

For Python, the companion `falsegreen` pip package is a deterministic scanner. Run
it to get the structural findings fast, then hand its output to the skill (via
`--conventions` or in the host) so the LLM only does the semantic judgment on top.

```bash
pip install falsegreen && falsegreen tests/
```

### CI (GitHub Actions)

`analyze --json --fail-on-high` gates a pipeline on HIGH findings; the workflow
example is in [cli.md](cli.md#ci-usage). This is Mode A only - authoring and fix
are interactive/propose steps, not gates.

## Provider validation snapshot

Snapshot as of 2026-07-02; free-tier caps and model ids drift, so re-check before
relying on a specific row. Live end-to-end runs of `generate` (Mode B: render +
self-check) through the OpenAI-compatible path, to record what actually works:

| Provider | Reached API | `generate` result |
|---|---|---|
| OpenRouter | yes | Generated the test; self-check ran. On a small model (`llama-3.1-8b`) the Mode A report was incomplete, so the self-check reported `UNVERIFIED` - the designed degrade, not a crash. A larger model is needed for a clean `PASSED`. |
| Groq | yes | HTTP 413 - the 33k prompt exceeds the free 12k TPM cap. |
| Cerebras | yes | HTTP 429 - free token quota exceeded. |
| DeepInfra | yes | HTTP 402 - needs positive balance. |
| Mistral | yes | Timed out at 120s on the free path. |
| NVIDIA NIM | yes | HTTP 404 on a stale model id; base URL is correct, pass a current `--model`. |
| Alibaba Qwen | yes | HTTP 403 `AccessDenied.Unpurchased` - the model must be enabled on the account. |

Offline paths (no key) are covered by `test/smoke.cjs`: the `generate` guards
(unknown `--lang`, missing spec, spec with no oracle) and the output extractor.

**Takeaway.** The CLI and both self-check degrade paths work. The bottleneck for a
large batch is the provider tier, not the code: free tiers either cap tokens below
33k or rate-limit, so a broad run needs a host that fits the prompt (Ollama local,
or a paid/large-context model). The `generate` self-check specifically needs a
model strong enough to emit a valid Mode A JSON report, or it reports `UNVERIFIED`.

## Running a broad batch audit

To audit many repositories (Mode A over their existing tests), point the CLI at a
host that fits the prompt and loop:

```bash
export FALSEGREEN_API_KEY=...     # a host from the table that fits 33k
for repo in $(cat repos.txt); do
  git clone --depth 1 "$repo" _audit/$(basename "$repo")
  find _audit/$(basename "$repo") \( -name 'test_*.py' -o -name '*.test.ts' \) | while read f; do
    falsegreen-skill analyze "$f" --json \
      --provider openai-compatible \
      --base-url https://openrouter.ai/api/v1 \
      --model meta-llama/llama-3.3-70b-instruct --max-tokens 8192 \
      >> _audit/report.jsonl
  done
  rm -rf _audit/$(basename "$repo")
done
```

There is no offline batch mode - every analysis is one model call, so the batch
cost and rate limits are the provider's, not the CLI's. Size the run to the tier
you have.
