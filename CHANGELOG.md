# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `reference.md` superset sync with the static scanners (#39): the JS/TS C44 numeric
  tautology on a length (`expect(x.length).toBeGreaterThanOrEqual(0)`), pairing the
  existing Python `len(x) >= 0` form. The `Infinity`-bound forms are deliberately not
  flagged (they are false for `NaN`, so they still catch a value that escaped). Robot
  Framework gained R6 (`Should Be True` on a string literal), C9 (catch-all
  `Run Keyword And Expect Error    *`), C20 (verification after `[Return]`/`Fail`/
  `Pass Execution`), C37 (duplicate `[Template]` data row), CC (commented-out
  verification keyword), R1 (forced green via `Pass Execution`), and R2 (hollow verifier
  keyword). RF3 is documented as sharing id `C3` (swallow plus status-variable forms).
  Added the JS D8 diagnostic (magic number in an assertion) to the maintainability group.
- AI-fix mode (Mode C) in `SKILL.md`: given a finding from a falsegreen report, the
  skill proposes a strengthened test and self-validates it by running Mode A over its
  own output (reusing the Mode B machinery). The header is now "Three intents, one
  skill" (Review = A / Author = B / Fix = C). The boundary is explicit: the skill
  proposes the fix and the validation contract but does not run the gate. (#1)
- `schema/fix-validation.json`: the output contract for the bidirectional gate verdict
  (finding reference, tier, clean/mutated replica outcomes, accept/reject verdict).
  accept requires clean_replica=pass AND mutated_replica=fail.
- F7 in `reference.md`: AI-fix gate adjudication. Documents the two cost tiers
  (suite rerun vs. targeted unit mutation), the accept/reject rule, the flaky case
  (no stable isolation -> J6 -> reject), and the mutmut / cosmic-ray / Stryker tooling
  that runs on the host side.
- Community hygiene parity with `falsegreen`: README status badges (CI, npm version,
  License), `.github/ISSUE_TEMPLATE/` (bug report, feature request, config), a pull
  request template, `CODEOWNERS`, a `dependabot.yml` covering npm and github-actions,
  and release-drafter config plus its workflow (the workflow skips fork PRs so it does
  not fail red). (#40)

## [0.2.0] - 2026-06-23

### Added
- The skill is now a superset of all three static scanners: added the Python codes
  C38/C39/C41/C42/C43/C44/C45, the JS codes C6/C20/C23/JS8/JS15/JS17/JS18/JS21/JS22, and the
  Robot codes R3/R4/R5 (plus empty-keyword C2 and IP-URL C23). supertest `.expect()` noted as
  a real API assertion.
- Examples parity (#9): the TypeScript and JavaScript examples are now family-based, mirroring
  the Python layout (`family_a_never_checks`, `family_b_weak_always_true`,
  `family_c_checks_own_setup`, `family_d_external_state`, `family_e_wrong_thing`,
  `semantic_cases`, `diagnostic_codes`), each code with a BAD example and a CLEAN look-alike.
  The earlier thematic TS files and the JS samples were folded into these; the TS-only
  `type_aware.ts` (branded types, generics, expectTypeOf) stays as it has no Python analogue.
- New AI-only semantic catalog (S1-S10): patterns no AST or linter can see (intent mismatch,
  irrelevant oracle, plausible-but-wrong expected value, oracle too coarse to fail, tests the
  framework not the code, happy-path-only against a stated contract, expected lifted from
  output, mock value reaching the assertion through indirection, self-fulfilling arrangement,
  asserts the log not the effect).
- Documented test-pyramid coverage with level-aware oracle reading (unit / integration with
  API and database / E2E).
- Robot Framework verification-keyword vocabulary across libraries (BuiltIn Should*, Collections, String, SeleniumLibrary, Browser assertion engine, RequestsLibrary, RESTinstance, DatabaseLibrary, AppiumLibrary) so a real check is not mistaken for no-verification; Browser `Get` without an operator flagged as a non-verifying getter.
- Visual testing note (Percy/Chromatic/Playwright screenshots/Storybook): percySnapshot is a non-assertion (no local oracle); screenshot-only is snapshot-only (JS3/C14).
- Tavern (`*.tavern.yaml`) semantic catalog: API stages with a request but no response, status-only checks, broad status acceptance.
- Gherkin/BDD semantic catalog in `reference.md` (.feature: scenario with no Then, non-verifying Then, empty outline, tautological Then) for Cucumber.js/behave/pytest-bdd.
- Robot Framework semantic catalog in `reference.md` (false-green keyword patterns:
  no-verification, swallowed `Run Keyword And Ignore Error`, always-true, self-compare,
  `Sleep`-as-wait, skip, conditional-only verification) + look-alikes.
- Step 1 now detects Robot Framework, Cypress/Playwright (E2E), and React Testing
  Library, and classifies test level (unit / integration / E2E) with the E2E/UI
  presence-is-the-assertion rule.
- Host context guides in `contexts/` (Claude, Codex, Gemini, Cursor) with per-host
  invocation instructions, and a ready-made Cursor rule at
  `.cursor/rules/falsegreen-skill.mdc` generated from `contexts/cursor.md` by
  `scripts/sync-cursor-mdc.mjs`. (#11, #23)
- Zero-dependency CLI (`bin/falsegreen-llm.js`) with `--json` report validation
  (including the required `level` field) and a `--temperature` flag with
  provider-specific handling.
- CI (`ci.yml`): validates manifests and schemas, checks CLI syntax plus an
  offline smoke test, builds the standalone targets, and guards protocol drift -
  the precision rule and the J5 wording must be present in each of SKILL.md,
  llm.md, AGENTS.md, and GEMINI.md. (#6, #23)
- TypeScript examples reorganized into per-pattern family files: async patterns,
  component tests, oracle failures, structural mocks, type-aware checks, and weak
  assertions.

### Changed
- `providers.md` trimmed to a cross-provider API reference (model table, raw SDK
  snippets for providers without a host guide, case 18 two-pass, provider
  selection); per-host wiring now points into `contexts/` instead of being
  duplicated. (#12)
- `models.yaml` documented as a human-facing tier reference - nothing loads it at
  runtime, since the CLI stays zero-dependency. (#12)
- `llm.md` header now states its role (self-contained protocol) versus the
  `contexts/` host guides. (#12)

### Removed
- `examples/typescript/bad_tests_sample.ts`; its unique case 12 (expected value
  re-implements the production formula) folded into `oracle_patterns.ts`, the
  other patterns already covered by the family files. (#12)

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

[Unreleased]: https://github.com/vinicq/falsegreen-skill/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/vinicq/falsegreen-skill/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/vinicq/falsegreen-skill/releases/tag/v0.1.0
