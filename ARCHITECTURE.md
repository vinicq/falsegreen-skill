# Architecture

falsegreen-skill is the semantic pass of the falsegreen family. Where the static scanners
read a parse tree, this skill reads intent: it judges whether a test would actually fail
when the code breaks. It runs as an LLM prompt protocol, packaged for several hosts, with a
machine-readable output contract.

There is no parser here. The "engine" is a protocol the model follows, defined once in
`SKILL.md` and referenced by thin host entry points.

## What runs where

| Asset | Role |
|-------|------|
| `SKILL.md` | the canonical protocol: J1-J6, the structural catalog, the step order |
| `reference.md` | per-language pattern catalog and look-alike exemptions |
| `schema/finding.json`, `schema/report.json` | the source of truth for JSON output |
| `skills/`, `.claude-plugin/`, `.codex-plugin/`, `.gemini/` | host packaging metadata |
| `contexts/` | host-specific usage guides |
| `llm.md`, `GEMINI.md` | host-specific renderings of the same protocol |
| `bin/`, `scripts/` | the CLI and the validate/build-targets scripts |
| `models.yaml` | documented model names per provider |

The design rule is one canonical protocol, many thin entry points. A host file references
`SKILL.md` instead of copying the catalog, so the judgment logic does not drift between
Claude, Codex, Gemini, Cursor, a plain prompt, the API, and the npm CLI.

## The protocol

The skill works through fixed steps, in order:

0. **Load conventions (optional).** A `conventions:` block declares project context (custom
   assertion helpers, layer overrides, excluded codes). It extends the look-alike
   exemptions; it does not lower severity. A HIGH finding that survives the exemptions
   stays HIGH.
1. **Detect language, framework, and test level.** Unit, integration, or E2E. The level
   changes what counts as a valid oracle: in an E2E/UI test the presence of a rendered
   element is the assertion at that layer, so it is not flagged as a weak check.
2. **Apply the judgments (J1-J6).** Does the verification run? Is the oracle independent of
   the code? Is it a real unit or a stand-in? Does it check enough, and the right thing? Is
   it coupled to internals? Does it pass in isolation?
3. **Report** against the schema.

## J1-J6, and why the skill exists

A test is useful only if it fails when the code breaks. The static scanners prove the
mechanical failures (no assertion, always-true, swallowed error). The skill owns the two
that need intent:

- **The expected value contradicts the intended behavior.** The test asserts what the code
  happens to return today, not what the spec says it should return.
- **The test re-implements the production logic** as its own oracle, so both move together
  and the test can never disagree with the code.

These cannot be read off a syntax tree. The skill compares the expected value against the
intended behavior in order: spec, then contract, then code. When it cannot cite an
independent oracle, it does not report the semantic finding rather than guess.

## Output contract

`schema/finding.json` and `schema/report.json` define the JSON. Each finding carries the
code, confidence, location, and the judgment (J1-J6) it came from, so the skill's output
lines up with the static scanners and the two can be reconciled on the same test.

## The boundary

- **Static** mechanical patterns are faster to catch with the deterministic scanners
  ([falsegreen](https://github.com/vinicq/falsegreen) for Python,
  [falsegreen-js](https://github.com/vinicq/falsegreen-js) for JS/TS,
  [falsegreen-robot](https://github.com/vinicq/falsegreen-robot) for Robot). For Python the
  skill can apply the full catalog directly; its results must stay consistent with the
  scanner. For TypeScript and JavaScript the skill is the primary semantic tool on top of
  the JS scanner.
- **Semantic** intent-level judgments are this skill's job.
- **Runtime** behavior (flakiness under a real clock, order dependence) is out of scope for
  a read-only analysis.

False positive is worse than a miss: a noisy semantic pass trains people to dismiss it,
which defeats the point.

## Privacy

This repository holds only public product assets. Datasets, adjudication notes, benchmark
artifacts, and paper drafts live in the private research hub, never here.
