# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Visual testing note (Percy/Chromatic/Playwright screenshots/Storybook): percySnapshot is a non-assertion (no local oracle); screenshot-only is snapshot-only (JS3/C14).
- Tavern (`*.tavern.yaml`) semantic catalog: API stages with a request but no response, status-only checks, broad status acceptance.
- Gherkin/BDD semantic catalog in `reference.md` (.feature: scenario with no Then, non-verifying Then, empty outline, tautological Then) for Cucumber.js/behave/pytest-bdd.
- Robot Framework semantic catalog in `reference.md` (false-green keyword patterns:
  no-verification, swallowed `Run Keyword And Ignore Error`, always-true, self-compare,
  `Sleep`-as-wait, skip, conditional-only verification) + look-alikes.
- Step 1 now detects Robot Framework, Cypress/Playwright (E2E), and React Testing
  Library, and classifies test level (unit / integration / E2E) with the E2E/UI
  presence-is-the-assertion rule.

## [0.1.0] - 2026-06-22

### Added
- Initial skill definition (`SKILL.md`): LLM-based semantic analysis for
  false-positive test detection across Python, TypeScript, and JavaScript.
- TypeScript / JavaScript structural catalog in `SKILL.md` (Step 2b) and a
  code-keyed table in `reference.md`, aligned with the
  [falsegreen-js](https://github.com/vinicq/falsegreen-js) scanner: shared C-codes
  plus JS1-JS13.
- Maintainability smells documented as an explicit **opt-in diagnostic pass**
  (D1/D3/D4/D5/D6/D7/M2), matching falsegreen and falsegreen-js. (#16)
- Detection reference (`reference.md`): per-language case catalog with J1-J6
  judgment index, framework cues, and language-specific smell patterns.
- Case catalog covering the 18 cases from the falsegreen methodology, with
  full semantic pass for cases 10, 11, 12, 15, 18.
- Multi-agent adversarial verification protocol for case 18 (bug-freezing).
- CREDITS.md citing the research base.

[Unreleased]: https://github.com/vinicq/falsegreen-skill/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/vinicq/falsegreen-skill/releases/tag/v0.1.0
