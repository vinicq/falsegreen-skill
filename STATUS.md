# Status

Public product state of `falsegreen-skill` at a glance. For the protocol and usage, see the
[README](README.md) and [reference.md](reference.md); for the change history, see the
[CHANGELOG](CHANGELOG.md).

Research artifacts, datasets, adjudication notes, and unpublished paper content live in the
private research hub, never in this repo. This file tracks the public product only.

## Version

- Current: **0.7.0** (npm: `npm install falsegreen-skill`)
- Versioning: semver; releases via trusted publishing (OIDC).

## CI health

- `ci.yml`: validate (catalog and host-file drift guard) plus smoke.
- `release.yml`: npm publish on tag.
- `codex-review-gate.yml`, `release-drafter.yml`, `credit-contributor.yml`.

## Modes

Three intents, one protocol:

- **Mode A - Review.** The default: read a test and judge whether it can fail when the code
  breaks (J1-J6). A finding requires a cited oracle or it is not reported.
- **Mode B - Authoring.** Given a spec, propose a test with an independent oracle, gated by
  an architect/QA pass (A0) that reuses the review judgments and precision rules before the
  test is written.
- **Mode C - AI-fix.** Given a review finding, propose a stronger test and prove it against
  the real code. Shipped in the CLI as `fix` (Python/pytest, propose-only, mutation-gated).

## Protocol

Semantic LLM pass over test code, judged by six questions (J1-J6): does the assertion run,
is the oracle independent, is the real unit exercised, is the check sufficient, is it coupled
to internals, does it pass in isolation. A finding requires a cited oracle or it is not
reported. False positive is worse than a miss.

## CLI

Zero-dependency Node CLI (`npx falsegreen-skill`), Node 18+:

- `analyze <file...>` - Mode A over one or more files, plain-text or `--json` (validated
  against `schema/report.json`), `--fail-on-high` for CI gating.
- `fix <test-file> --case <code> --line <n> --sut <file>` - Mode C, propose-only. The gate
  proves the patch parses, still passes on correct code, and fails on a line-scoped SUT
  mutant (`schema/fix-validation.json`). V1 is Python/pytest.

Full flags: [docs/cli.md](docs/cli.md).

## Catalog coverage (superset)

`reference.md` is the superset of the deterministic scanners plus the semantic-only codes:
**125 codes total**.

- **Structural, mirrored from the static scanners:** the Python `C*` codes (S1-S21 span the
  semantic series; the C-series runs up to C59), the JS/TS `JS*` codes (up to JS31), the
  Robot `R*`/`C*` codes (up to R8b), and the project-layer `PL*` and diagnostic `D*`/`M*`
  codes.
- **Semantic-only (need judgment, not just structure):** the `S1`-`S21` series, plus the
  family F7 cases (10, 11, 12, 15, 18) that need intent.

`schema/scanner-codes.json` pins each sibling scanner's emitted code set; `npm run validate`
runs `check-scanner-coverage.mjs`, which fails if any scanner emits a code the catalog does
not carry. When a new code lands in any static scanner, it is mirrored here so the skill
stays the complete multi-stack net.

## Host support

Packaged host guides: Claude (CLAUDE.md / contexts/claude.md), Codex (AGENTS.md /
contexts/codex.md), Cursor (.cursor/ / contexts/cursor.md), Gemini (GEMINI.md /
contexts/gemini.md). The protocol is provider-agnostic; providers.md is the cross-provider
API reference (OpenAI, Groq, Qwen, Kimi, Anthropic).

## Languages

Python, JavaScript/TypeScript, Robot Framework, and Gherkin/Tavern, with the same J1-J6
framework across stacks.
