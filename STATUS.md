# Status

Public product state of `falsegreen-skill` at a glance. For the protocol and usage, see the
[README](README.md) and [reference.md](reference.md); for the change history, see the
[CHANGELOG](CHANGELOG.md).

Research artifacts, datasets, adjudication notes, and unpublished paper content live in the
private research hub, never in this repo. This file tracks the public product only.

## Version

- Current: **0.3.0** (npm: `npm install falsegreen-skill`)
- Versioning: semver; releases via trusted publishing (OIDC).

## CI health

- `ci.yml`: validate (catalog and host-file drift guard) plus smoke.
- `release.yml`: npm publish on tag.
- `codex-review-gate.yml`, `release-drafter.yml`, `credit-contributor.yml`.

## Protocol

Semantic LLM pass over test code, judged by six questions (J1-J6): does the assertion run,
is the oracle independent, is the real unit exercised, is the check sufficient, is it coupled
to internals, does it pass in isolation. A finding requires a cited oracle or it is not
reported. False positive is worse than a miss.

## Catalog coverage (superset)

`reference.md` is the superset of the deterministic scanners plus the semantic-only codes:

- **Structural, mirrored from the static scanners:** the Python `C*` codes (through C48,
  including the dark-patch C48), the JS/TS `JS*` codes, and the Robot `R*`/`C*` codes.
- **Semantic-only (need judgment, not just structure):** S1 through S13, plus the family
  F7 cases (10, 11, 12, 15, 18).

When a new code lands in any static scanner, it is mirrored here so the skill stays the
complete multi-stack net.

## Host support

Packaged host guides: Claude (CLAUDE.md / contexts/claude.md), Codex (AGENTS.md /
contexts/codex.md), Cursor (.cursor/ / contexts/cursor.md), Gemini (GEMINI.md /
contexts/gemini.md). The protocol is provider-agnostic; providers.md is the cross-provider
API reference (OpenAI, Groq, Qwen, Kimi, Anthropic).

## Languages

Python, JavaScript/TypeScript, Robot Framework, and Gherkin/Tavern, with the same J1-J6
framework across stacks.
