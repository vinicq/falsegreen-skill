# Contributing to falsegreen-skill

falsegreen-skill is the LLM semantic pass companion to the
[falsegreen](https://github.com/vinicq/falsegreen) Python scanner. It detects
false-positive test patterns that no static tool can see, across Python,
TypeScript, and JavaScript.

## 30-second cheat sheet

```bash
# 1. Fork the repo on GitHub first (vinicq/falsegreen-skill → your-username/falsegreen-skill)
# 2. Clone your fork
git clone https://github.com/<your-username>/falsegreen-skill
cd falsegreen-skill
# no runtime dependencies — this is a skill definition, not a package
```

Branch, make your changes, and open a pull request against `vinicq/falsegreen-skill`.

## Validate your changes

Before opening a PR, run:

```bash
npm run validate
```

This checks required files, skill frontmatter, manifest JSON, schema field names, and unsupported language claims. It takes under a second.

For CLI changes, also run:

```bash
node --check bin/falsegreen-llm.js
```

If you changed `SKILL.md`, check that the same text appears in `llm.md`, `AGENTS.md`, and `GEMINI.md` - they carry the same protocol and must stay in sync.

## How the skill is built

One file does the work: `SKILL.md`. It defines the protocol Claude follows
when analyzing a test. `reference.md` is the supporting catalog: per-language
patterns, framework cues, and the J1-J6 judgment index.

The skill inherits the same methodology as the scanner: a test is useful only
if it fails when the code breaks. Cases 10, 11, 12, 15, and 18 need semantic
judgment that a parser cannot make. This skill makes that judgment.

## Repository layout contract

Two host-packaging details depend on the current file layout. Keep them in mind
before moving or renaming files at the repo root.

- **The Claude skill entry point is a thin pointer that resolves the protocol by
  relative path.** `skills/falsegreen-llm/SKILL.md` references `../../SKILL.md`
  and `../../reference.md`. Those paths resolve two levels up, at the repo root,
  inside the installed plugin cache. Moving `SKILL.md` or `reference.md` out of
  the root, or relocating the skill directory, breaks the reference silently -
  the plugin still installs, but the protocol never loads. If you change the
  layout, update the relative paths in the skill entry and re-run
  `npm run validate`.
- **The marketplace entries use the root form `"source": "./"`.**
  `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json` point
  at the repo root, so the host runs its default `skills/` scan to find the
  skill. If you ever add an explicit `skills` field to a marketplace entry, it
  replaces that default scan - the host then looks only where the field points.
  Leave `"source": "./"` without a `skills` override unless you intend to take
  over discovery yourself.

## Releasing: bump the version

`plugin.json`, `.codex-plugin/plugin.json`, and `gemini-extension.json` pin a
`version`. New commits do not reach installed plugins until that version is
bumped and published - a fix merged to `master` without a release is invisible
to users. Before publishing, run `npm version <patch|minor|major>` (the
`version` npm script syncs the number into all three manifests and stages
them), move the `[Unreleased]` entries in `CHANGELOG.md` under the new version,
then follow `RELEASE.md`.

## Refreshing the scanner snapshot

`schema/scanner-codes.json` pins, per sibling scanner, the version and the exact
set of codes it emits. `check-scanner-coverage.mjs` diffs that snapshot against
the catalog and fails if any sibling emits a code the skill catalog does not
cover (the #105 regression). The snapshot is generated, not hand-edited:

```bash
# from checkouts next to this repo (../falsegreen, ../falsegreen-robot, ../falsegreen-js)
node scripts/refresh-scanner-snapshot.mjs

# point at checkouts elsewhere (per sibling; env vars work too)
node scripts/refresh-scanner-snapshot.mjs \
  --falsegreen=/path/to/falsegreen \
  --falsegreen-js=/path/to/falsegreen-js

# CI-friendly: fail if the committed snapshot lags the checkouts, no write
node scripts/refresh-scanner-snapshot.mjs --check
```

The script reads each sibling's version and its `CASES` code set straight from
source, so the refresh no longer relies on a human copying codes by hand. A
sibling that is not checked out is skipped with a warning and its existing
snapshot entry is kept. After refreshing, run `npm run validate` so
`check-scanner-coverage.mjs` confirms the catalog still covers every code. This
check is not in `npm run validate` because the sibling repos are not present at
this repo's CI time (ADR 0002); run it locally against live checkouts before a
release.

## Precision over recall

Same rule as the scanner: a finding that wrongly flags a legitimate test is
worse than a missed finding. Before adding a detection cue or tightening a
boundary rule, test it against common legitimate patterns (characterization
tests, TDD tests, integration doubles).

## Filing an issue

A useful false-positive report includes the test snippet, the case number the
skill attributed, and why that attribution is wrong. A useful false-negative
report shows the bad test and the case it should have caught.

## Adding a language pattern

A new language-specific pattern touches two places:

1. **`reference.md`**: the case entry for the relevant language, with a
   bad-pattern example and a clean look-alike.
2. **`SKILL.md`**: the detection cues section for that language, if the
   pattern requires a new cue the model should look for.

## Authorship and AI tooling

Use any tools you like. The authorship is yours. Do not add `Co-Authored-By`
trailers for AI agents. Human co-authors are welcome.

## Commit messages: Conventional Commits

Format: `type(scope): summary`. Recognised types: `feat`, `fix`, `docs`,
`refactor`, `chore`. Scope is usually the language or case number.

```
feat(python): add C35 flaky-decorator detection to reference
fix(typescript): stop flagging jest.spyOn when SUT is an edge
docs(reference): add JavaScript Sinon stub look-alike examples
```

## License

By contributing you agree your contributions are MIT-licensed.
