# Releasing falsegreen-skill

This package ships to npm. Unlike the static scanners, it has no compile step: the release
is the prompt protocol, the host packaging metadata, and the thin CLI. The work before a
release is keeping every host copy consistent and regenerating the standalone skill targets.

**Reminder:** the host manifests (`plugin.json`, `.codex-plugin/plugin.json`,
`gemini-extension.json`) pin a `version`. A fix merged to `master` without a
version bump and publish never reaches installed plugins. Every release cycle
bumps the version and the `CHANGELOG.md` together.

## Before you publish

1. Bump `version` in `package.json`. The `version` npm script runs automatically on
   `npm version` and syncs the same number into `.claude-plugin/plugin.json`,
   `.codex-plugin/plugin.json`, and `gemini-extension.json`, then stages them.
2. Move the `[Unreleased]` entries in `CHANGELOG.md` under the new version with today's date.
3. If the protocol changed, update every host rendering in lockstep: `SKILL.md`, `llm.md`,
   `GEMINI.md`, and the files in `contexts/`. `schema/finding.json` and `schema/report.json`
   are the source of truth for the JSON output; do not let a host copy drift from them.
4. When a sibling scanner ships a new code, update `schema/scanner-codes.json` (the emitted
   code set + version per scanner) and add the matching `reference.md` entry before tagging.
   `npm run validate` runs `check-scanner-coverage.mjs`, which fails if a scanner code has no
   catalog entry - the regression that caused #105.
5. Validate: `npm run validate`. It must pass before tagging.
6. Rebuild the standalone targets: `npm run build:targets` (the packaged Claude/Gemini
   skill bundles).

## Publishing a version

1. Commit: `git add -A && git commit -m "release: X.Y.Z"`.
2. Tag and push: `git tag -a vX.Y.Z -m "falsegreen-skill vX.Y.Z" && git push origin main --tags`.
3. Publish: `npm publish`. Confirm it is live: <https://www.npmjs.com/package/falsegreen-skill>.

There is no GitHub release workflow for this package yet. When one is added, the recommended
setup is npm Trusted Publishing (OIDC), the same as the sibling scanners, so no long-lived
`NPM_TOKEN` lives in the repo. Until then, publish from a trusted local environment.

## Version scheme

[Semantic Versioning](https://semver.org/spec/v2.0.0.html):
- **PATCH** (`0.x.Y`): wording fixes, doc corrections, look-alike exemption tweaks that do
  not change a verdict.
- **MINOR** (`0.X.0`): new patterns, new language or framework support, new host packaging,
  backward-compatible protocol additions.
- **MAJOR** (`X.0.0`): a change to the J1-J6 protocol, the output schema, or the CLI
  interface that breaks an existing integration.
