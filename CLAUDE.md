# CLAUDE.md - falsegreen-skill

Project context for Claude Code and other agents opening this repository.

---

## What This Project Is

`falsegreen-skill` is a public LLM skill for finding false-positive tests:
tests that stay green even when the implementation is wrong.

It is not Claude-specific. The same protocol is packaged for Claude Code,
Codex, Gemini, Cursor, plain LLM prompts, API usage, and the npm CLI.

The companion `falsegreen` project is the deterministic Python scanner. This
repository is the semantic, multi-host skill layer.

---

## Public Repo Boundary

This repo should contain only public product assets:

- `SKILL.md` - canonical J1-J6 protocol and structural catalog rules.
- `reference.md` - per-language pattern catalog and look-alike exemptions.
- `schema/` - canonical machine-readable output contracts.
- `skills/` - plugin skill entry points.
- `.claude-plugin/`, `.codex-plugin/`, `.antigravity-plugin/`, `.agents/`, `.gemini/` - host packaging metadata (`.antigravity-plugin/` = Antigravity CLI plugin for `agy plugin install`; `.agents/skills/` = Antigravity CLI workspace skill; `.gemini/` = legacy Gemini CLI copy).
- `contexts/` - host-specific usage guides.
- `bin/` and `scripts/` - CLI and packaging/validation scripts.
- `examples/` - public examples only.

Do not add private datasets, adjudication notes, unpublished paper drafts,
internal agent outputs, or benchmark artifacts here.

---

## Maintenance Rules

- Keep `SKILL.md`, `llm.md`, `GEMINI.md`, and host contexts consistent when the
  protocol changes.
- Treat `schema/finding.json` and `schema/report.json` as the source of truth
  for JSON output.
- Supported languages in public docs: Python, TypeScript, JavaScript, and Robot
  Framework (the catalog covers all four, mirroring the static scanners). Gherkin
  and Tavern are covered as secondary semantic passes in `reference.md`.
- The skill is a superset of the three static scanners: every structural code in
  falsegreen / falsegreen-js / robotframework-falsegreen must appear in `reference.md`,
  plus the AI-only semantic codes (S-series).
- Prefer thin host entry points that reference the canonical protocol instead
  of duplicating the full catalog.
- Run `npm run validate` before release.
- Run `npm run build:targets` when preparing standalone Claude/Gemini skill
  packages.

---

## Default Model Guidance

Model names in docs are examples, not a guarantee of current availability.
Before a release, validate `models.yaml` and provider-specific context files
against the providers being documented.
