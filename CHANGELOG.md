# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Semantic catalog was unreachable from every documented load path. 0.8.2 traded
  "load `reference.md` in full" for "load the matching language section", which
  fits the ~32 KiB Codex budget but routes past the S-series: the S-codes are
  language-agnostic and live in one section that sits above the per-language
  sections, so a language-section-only load never sees any of them. The named
  tight-budget fallback, `fragments/semantic-cases-compact.md`, carried 6 of the
  19 codes. Python was not exempt either: the root `SKILL.md` defines no S-code
  yet claims its catalog is complete on its own, so a Python run missed the same
  19. The mandatory load is now additive (semantic section AND language section)
  for every advertised language, the compact fragment carries a row for all 19
  codes, and the "complete on its own" claims are scoped to the structural
  catalog. Applied across `SKILL.md`, `skills/falsegreen-skill/SKILL.md`,
  `llm.md`, `contexts/codex.md`, `contexts/cursor.md`, `docs/architecture.md`,
  and, via `sync:hosts`, `AGENTS.md` and `GEMINI.md`.
- `npm run validate` now fails when the load path stops reaching the catalog.
  `check-catalog-consistency.mjs` gained three assertions: the compact fragment
  carries every semantic code, `reference.md` still defines them all in the one
  shared section, and every host that routes through `reference.md` names that
  section. Nothing in CI caught this class before, which is why it regressed
  silently one release after #117 closed it.
- Stale advertised ranges. `llm.md` announced the S-series as `S1-S16`, three
  codes short. Docs also mixed `S1-S16`, `S1-S21`, and `S1-S18 and S21` for the
  same 19 codes; `S1-S21` implies an S19 and S20 that do not exist. Normalized to
  `S1-S18 and S21`, and the new assertion rejects any range that closes outside
  the catalog's contiguous run.
- Stale byte figures that the budget argument rests on. `contexts/codex.md` and
  `docs/packaging.md` put `SKILL.md` at ~29 KB and `reference.md` at ~80 KB. The
  real numbers are ~36 KiB and ~92 KiB, which means `SKILL.md` alone already
  exceeds the ~32 KiB budget. That is a stronger case for the compact path than
  the docs were making.
- `models.yaml` semantic tier listed `cases: "10-15"` and never mentioned the
  S-series it depends on.

## [0.8.2] - 2026-07-08

### Fixed
- Codex plugin schema doc: `docs/packaging.md` listed `ON_FIRST_USE` as a
  `policy.authentication` value. The official docs example shows `ON_INSTALL`
  and describes the alternative as first-use auth; the Codex resolver accepts
  `ON_USE` and rejects `ON_FIRST_USE`. Reworded to attribute the value to the
  resolver and to point readers at their Codex CLI if it disagrees.
- Codex install docs across `README.md`, `docs/user-guide.md`,
  `docs/packaging.md`, and `contexts/codex.md`: stated plainly that Codex has no
  single-command install for this repo and documented two consistent paths -
  clone for the full protocol (scoped to the clone, all relative references
  resolve), or copy `AGENTS.md` into the user's own project / `~/.codex/AGENTS.md`
  for the compact routine protocol. Noted that the `AGENTS.md`-only path is
  compact-only: its on-demand references to `reference.md`/`SKILL.md` resolve
  only when those files sit beside it. Raised by the automated Codex review
  on #157.

## [0.8.1] - 2026-07-08

### Fixed
- Codex install docs: the `.agents/plugins/marketplace.json` catalog uses a
  repo-root source (`"path": "./"`), which Codex's marketplace resolver does not
  accept (it expects the plugin nested in a subdirectory of the marketplace
  root). Stopped advertising `codex plugin marketplace add` as an install path
  for this repo and documented the supported path (clone + `AGENTS.md`
  auto-load) across README, `docs/user-guide.md`, `docs/packaging.md`, and
  `contexts/codex.md`. Where the plugin command is shown, it is now qualified
  with the marketplace name (`codex plugin add falsegreen-skill@falsegreen`).
  Also corrected the `.claude-plugin/marketplace.json` doc, which wrongly said
  it was consumed by `codex plugin marketplace add`. Raised by the automated
  Codex review on #149.

## [0.8.0] - 2026-07-08

### Added
- Antigravity CLI (`agy`) support, Google's successor to the discontinued Gemini
  CLI. Two enable paths: an installable plugin at `.antigravity-plugin/`
  (`agy plugin install https://github.com/vinicq/falsegreen-skill`) and a
  workspace Agent Skill at `.agents/skills/falsegreen-skill/SKILL.md`, both
  exposed as the `/falsegreen-skill` slash command. `agy` also auto-parses
  `AGENTS.md`/`GEMINI.md` at the workspace root as codebase rule files.
  `npm run build:targets` now emits a self-contained `dist/antigravity-plugin/`.
  The Antigravity plugin manifest is versionless by design (its schema allows
  only `$schema`/`name`/`description`), so it stays out of the version-sync.

### Changed
- Docs now present the Antigravity CLI as the CLI host in place of the
  discontinued Gemini CLI (README, `docs/user-guide.md`, `docs/packaging.md`,
  `docs/architecture.md`, `providers.md`, `contexts/gemini.md`). The Gemini
  provider/API paths (AI Studio, Gemini API, Vertex, `--provider gemini`) are
  unchanged. Legacy `gemini-extension.json`, `GEMINI.md`, and `.gemini/` are
  kept as the import source for `agy plugin import gemini`.
- Unified the skill name to `falsegreen-skill` across every host. The shared
  Claude/Codex skill moved from `skills/falsegreen-llm/` to
  `skills/falsegreen-skill/` (frontmatter `name` and the Claude command are now
  `falsegreen-skill`), matching the Antigravity, Gemini, npm, and plugin
  identities. The CLI script filename `bin/falsegreen-llm.js` is unchanged; the
  user-facing CLI command was already `falsegreen-skill`.
- Aligned every host guide's model recommendations to `models.yaml`, the
  canonical tier-to-model map: refreshed `contexts/cursor.md` (was
  `claude-sonnet-4-6`/`gpt-4o`), added concrete ids to `contexts/codex.md`, and
  flagged the `gemini-2.5-pro` sunset (2026-10-16) in `contexts/gemini.md`.

### Fixed
- Codex marketplace catalog (`.agents/plugins/marketplace.json`) used invalid
  policy enum values (`installation: "manual"`, `authentication: "none"`) and a
  non-schema top-level `owner`. Now uses `AVAILABLE`/`ON_INSTALL` and drops
  `owner`, per the official Codex plugin marketplace schema.
- `contexts/codex.md` wrongly stated Codex has no plugin subcommand; corrected
  to `codex plugin marketplace add` / `codex plugin add`.
- README and `docs/cli.md` documented stale CLI default models; synced them to
  the code (`claude-sonnet-5`/`gpt-5`/`gemini-2.5-flash`).

## [0.7.0] - 2026-07-02

### Added
- `generate` CLI command: authoring mode (Mode B) on the CLI. It renders a language-neutral
  test-spec (`schema/test-spec.json`) into one stack with `--lang` (`python`, `typescript`,
  `javascript`, `tsx`, `jsx`, `robot` - the whole JS/TS family routes through the shared JS*
  catalog), then runs Mode A on the result so a false-green shape cannot pass the self-check
  undetected. It anchors the oracle guard on the `oracle:`/`expected:` keys, seeds the prompt
  with the shipped per-language render as a few-shot, and defaults `--lang` from the spec's
  `languages` list. Fail-closed exit contract: 0 PASSED, 1 FAILED (surviving false-green), 3
  UNVERIFIED (self-check could not run - never silently accepted). The self-check is a
  same-model static review bounded to one revision, not an execution; it does not verify the
  oracle value or that the test compiles/runs. Covered by an offline stubbed-provider smoke
  test for all three exit branches. Documented in README, `docs/user-guide.md`, `docs/cli.md`,
  `docs/invocation-methods.md`, and ADR 0004.
- `docs/invocation-methods.md`: the map of every way to run the skill (CLI, API token per
  provider, editor-host skill, raw protocol, static scanner, CI) with an OpenAI-compatible
  provider table (Groq, Cerebras, OpenRouter, NVIDIA, DeepInfra, Mistral, DeepSeek, Fireworks,
  Alibaba, Hugging Face, Cohere, Ollama) and a live validation snapshot.
- Authoring mode (Mode B) names its architect/QA gate **A0**: before a test is written, the
  skill runs the review judgments and the precision rules over the proposed design, and reuses
  the `examples/` fixtures as reference. Documented in ADR 0004 (#119).
- `docs/architecture.md`: an architecture overview with Mermaid flow diagrams for host and
  language routing and the Mode A/B/C flow (#122).

### Fixed
- AI-fix mutation gate made reliable (#110): the gate now takes an explicit `--sut-line`,
  keeps the SUT's package path in the clean replica, discards an invalid mutant instead of
  scoring it as a kill, and scopes both the preserve run and the mutation run to the target
  test.
- `mutateLine` no longer mutates an operator that appears only in a comment (which produced a
  null mutant), the finding schema now accepts the `fixture`/`scaffold` axes, and provider
  parsing no longer crashes on an unexpected response shape (#111).
- SKILL.md-led hosts now load the full `reference.md` catalog before reviewing any
  non-Python test, closing a recall gap where a host that read only SKILL.md missed the
  JS/Robot/semantic codes (#117).

### Changed
- Codex host docs corrected: removed references to non-existent CLI commands and realigned the
  manifest examples with `schema/finding.json` (#115).
- Model and provider references refreshed: dropped the retired `gemini-2.0-flash`, the legacy
  Gemini SDK, and the `budget_tokens` thinking form that now returns HTTP 400 (#116).
- Host-conformance hardening: comma-separated Cursor globs, and the skill-path and release
  contracts documented in CONTRIBUTING/RELEASE (#121).

## [0.6.3] - 2026-06-29

### Added
- Complete "Setup and usage reference" in the README: CLI install, the full analyze + fix flag tables, provider configuration (anthropic/openai/gemini/openai-compatible with base-url + env keys, incl. reasoning-model endpoints), per-host enable steps (Claude Code, Codex, Gemini, Cursor, plain LLM/API), and the J1-J6 output schema.

## [0.6.2] - 2026-06-29

### Changed
- `examples/typescript/semantic_cases.ts`: renamed the JWT example's signing-key literals from
  `topsecret`/`wrongsecret` to obviously-dummy placeholders (`example-not-a-real-key`,
  `placeholder-wrong-key`) and dropped the `const secret =` assignment in favor of `signingKey`.
  The plugin-scanner's `HARDCODED_SECRET` pattern matched the old literals in the test fixture and
  raised three HIGH findings. The example still illustrates the same false-green case (a sign-then-verify
  JWT round-trip with no negative test), now with no secret-shaped strings.

### Added
- `package-lock.json`: committed lockfile for reproducible dependency resolution. The package has no
  runtime dependencies, so the lockfile is minimal, but its absence was flagged by the plugin-scanner
  lockfile check.

### Fixed
- Pinned every GitHub Action in `.github/workflows/` to a full commit SHA (with a `# vN` comment),
  replacing the floating `@v7`/`@v6` tags on `actions/checkout`, `actions/setup-node`, and
  `release-drafter/release-drafter`. Removes the plugin-scanner unpinned-action findings and closes
  a tag-mutation supply-chain hole.

## [0.6.1] - 2026-06-29

### Added
- `schema/scanner-codes.json`: a committed snapshot of every sibling scanner's emitted code set
  plus its version (falsegreen 0.9.0, falsegreen-robot 0.6.2, falsegreen-js 0.6.2), derived from
  each scanner's live `CASES`. `scripts/check-scanner-coverage.mjs` diffs it against the catalog
  and fails when a scanner emits a code the catalog does not carry, naming the scanner and the
  orphan id. Wired into `npm run validate` (#105).
- Four Python codes the scanner already emitted but `reference.md` was missing: C56 (sync assert
  of a never-awaited coroutine), C57 (assertion against an unconfigured Mock attribute), C59 (bare
  comparison written as a statement), and PL1 (asserts stripped under `-O`/`PYTHONOPTIMIZE`). Robot
  bullets for the codes its scanner emits under reused ids: C31 (captured value never used), C11a
  (self-confirming literal), and M2 (long test). SKILL.md's Python family table now lists the recent
  and HIGH codes it had omitted (#105).

### Fixed
- The catalog was not a true superset of the live scanners: the falsegreen scanner shipped
  C56/C57/C59/PL1 but `reference.md` never gained the entries, so `schema/code-catalog.json` fell
  out of superset with nothing to catch it. Added the missing entries and a coverage guard that
  blocks the same drift at release time (#105). The catalog grows from 121 to 125 codes.
- `build-code-catalog.mjs` now accepts a hyphen as well as an em-dash in a family-additions bullet
  title, so a code entry written `- **C59 - Title (J1, HIGH):**` parses (#105).

## [0.6.0] - 2026-06-29

### Added
- AI-fix mode in the CLI (#1): `falsegreen-skill fix <test-file> --case <code> --line <n> --sut <file>`.
  It is opt-in and propose-only. The LLM proposes a test-file-only patch for a mechanical finding
  (C2b, C20, C21, C5, C7), then a local gate proves it on a clean replica: parse (`py_compile`),
  preserve (the patch passes `pytest` against the real production code), and a line-scoped mutation
  gate (the patch must fail on a built-in line-scoped mutant of the SUT line). The command never
  auto-applies the patch and never edits the SUT. Without `--sut`, or with `--cheap`, it degrades to
  propose-only and labels the output unvalidated. V1 is Python/pytest only; JS/TS/Robot fix paths and
  the deep semantic cases (10/11/12/18) are deferred to v2. The gate proves the fix catches the
  targeted mutant, not every possible bug, and the output says so.
- `bin/fix-gate.js`: the deterministic gate runner (parse, preserve, mutation), with mock-runner
  unit tests in `test/fix-gate.cjs` that confirm a tautological fix is rejected and a real-oracle fix
  is accepted without needing an API key or a live provider.

## [0.5.2] - 2026-06-29

### Fixed
- CLI `--json` against reasoning models on `openai-compatible` providers (#102). Live testing
  on Nvidia `qwen/qwen3.5-397b-a17b` and Fireworks Kimi showed the models ignored the buried
  JSON-only prompt and returned the prose report, so the CLI rejected a correct analysis with
  "could not parse JSON output". The chat call now sends `response_format: {type: "json_object"}`
  in `--json` mode, which both models honor. `extractJson` is hardened to recover JSON even when
  a model wraps it: it strips `<think>`/`<reasoning>` blocks, prefers a `json` fence then any
  fence, and falls back to brace-matching the outermost object; it pulls from
  `reasoning_content`/`reasoning` when `content` is empty, and normalizes the `"/findings"`
  leading-slash key quirk seen on qwen3.5. On an unparseable or truncated response it returns
  null and the CLI fails cleanly, with a hint to raise `--max-tokens` when the model was cut off
  mid-output (`finish_reason: length`).
- CLI no longer aborts on Windows when a request fails on the `--json` path (#102). The failure
  path called `process.exit` while the fetch socket was still closing, which tripped libuv's
  `UV_HANDLE_CLOSING` assertion (exit `0xC0000409`). `fail()` and the HIGH-finding exit now set
  `process.exitCode` and unwind through `main()`, letting the event loop drain the handle before
  the process exits.

## [0.5.1] - 2026-06-29

### Changed
- reference.md gains look-alike exemptions found by field validation against ~200 real repos
  (50 each Python/TS/JS/Robot, #99). No codes added or removed - the catalog stays at 121.
  Non-`assert` oracles are now explicitly exempt: helper-wrapped assertions and fluent matchers
  (hamcrest, assertpy, `numpy.testing`, `pandas.testing`); pytest runner-result oracles
  (`result.assert_outcomes`, `result.stdout.fnmatch_lines`/`no_fnmatch_line`, `result.ret`), with
  source passed to `makepyfile`/`makeconftest` treated as fixture data, not collected tests;
  Testing-Library throwing queries (`getBy*`/`getAllBy*`/`findBy*`/`findAllBy*`) read as assertions,
  so only `queryBy*`/`queryAllBy*` stay the check-free JS13 case; a guarded `if (cond) throw` /
  `node:assert` read as a hand-rolled oracle; the type-assertion exemption generalized past
  `expectTypeOf` to tsd `expectType`/`expectError` and hand-rolled `Expect<Equal<A,B>>`.
- Robot look-alikes gain a file-role exemption (no-verification/empty/`No Operation`/hollow not
  flagged under `testdata`/`resources`/`fixtures`/`performance`/`examples`, or on an intentionally
  empty DataDriver/`[Template]` suite), plus RESTinstance `Expect Request`/`Expect Response` armed
  in `[Setup]` (not R8), external report-merge keywords (oxygen `Run JUnit`/`Run Gatling`/`Run Zap`)
  as the oracle, `Pass Execution If`/`Skip If` on a runtime/env condition as a sanctioned skip (not
  R1), and screenshot keywords (`Capture Page Screenshot`) as non-assertions.
- The mock-vs-SUT boundary is sharpened for S12/S16/S5: a `jest.spyOn`/`vi.spyOn` stubbing a
  sibling method (orchestration isolation) is not S12; a constructor-injected or module-level
  collaborator mock is a clean case-10 edge; a stub config call on the mocking library under test
  (mockingoose, tinyspy, jsdom-testing-mocks) is production code, not S5/S8/C11a; S16 requires the
  call-verification to be the sole oracle.
- Guard and teaching-fixture exemptions added: a `try/catch` whose catch asserts under
  `expect.assertions(N)`/`expect.hasAssertions()` is not JS11/JS31; `pytest.raises(BroadType) as exc`
  with an assertion on `str(exc.value)`/`exc.value.<attr>` is exempt from C9 and S17; a test under
  `*.problem.*`/`*.solution.*`/`exercises/`/`katas/`/`playground/` is a teaching fixture, not case 18
  or S3.
- SKILL.md output shape: the Step-6 finding header generalizes from `CASE {number} (J1-J6)` to
  `{code} ({J})` so it accepts CASE-N / C* / JS* / R* / S* codes; the `level` axis gains `fixture`
  (with a `role:` note) and the `intent` axis gains `scaffold` for placeholder findings; the
  C9/C28/S17 tie-break is stated (most specific code wins, broad `pytest.raises` with a bound
  message assertion fires nothing); and each code's listed severity is now stated as a ceiling that
  intent classification can only lower, never raise (#99, field validation 2026-06-29).

## [0.5.0] - 2026-06-29

### Added
- reference.md mirrors the new structural codes the sibling scanners merged: Python C49
  (`pytest.warns`/`assertWarns` over more than one call, J1), C50 (captured log never asserted,
  J4), C51 (empty-bodied `pytest.raises`/`warns` context, J1, HIGH), C52 (membership
  self-confirmation, J2), C55 (assertion compares two mock-rooted values, J3); TS/JS JS25
  (assertion only inside an array-iterator callback, HIGH), JS26 (fake timers never advanced),
  JS27 (call-only oracle on a local double), JS29 (floating `.resolves`/`.rejects`), JS30
  (literal-vs-literal assertion, HIGH), JS31 (swallowed throw, no assertion); Robot R8/R8b
  (verification only in Setup/Teardown, J4) and C9b (RequestsLibrary `expected_status=any`, J4).
  The catalog stays a true superset of the three scanners.
- Three AI-only semantic codes after S16: S17 (exception-path oracle blindness, J4, HIGH), S18
  (contract-impossible stub value, J3), S21 (self-judging LLM/agent assertion, J2). Each carries
  a worked example and a look-alike exemption, and S17/S18/S21 are mirrored into
  `fragments/semantic-cases-compact.md` so the Codex/Gemini hosts that read only the compact
  table know they exist (resynced into AGENTS.md and GEMINI.md) (#92, #93, #94).

### Changed
- The C44 reference.md entry now records that the Robot scanner widens C44 under the same id to
  vacuous library assertions (`Should Contain ${EMPTY}`, `Should Not Be Empty ${TRUE}`, a
  `Length Should Be` tautology) beyond the numeric-tautology form py/js use, so the shared id is
  honestly documented as broader on Robot rather than silently drifting (#96).

### Fixed
- `scripts/build-code-catalog.mjs` now parses the S-series, the Robot section, and the project
  layer (config-audit) in reference.md, not just the Python family prose and the TS/JS table.
  `schema/code-catalog.json` grew from 75 to 121 codes (it had been missing every R, PL, S, and
  D2 entry), so `check-catalog-consistency.mjs` can catch an id/family/title/severity drift in
  any of those families, matching ADR-0002's claim that the map is the canonical source (#95).

## [0.4.0] - 2026-06-28

### Added
- contexts/codex.md now documents a compact load order that fits the Codex ~32 KiB
  host context budget: `AGENTS.md` eager (it carries the compact protocol plus the
  `fragments/*` synced semantic-case table and precision rules), with `reference.md`
  and `SKILL.md` pulled in only on demand. The compact path references the canonical
  J1-J6 protocol and case catalog through the single-source fragments, so it cannot
  drift from a forked summary. docs/packaging.md records the budget for future edits (#66).

### Changed
- contexts/codex.md model table no longer recommends stale `gpt-4o`/`gpt-4o-mini`/`o3`
  ids. It points to Codex's current default model (GPT-5 family) and a reasoning tier by
  capability, leaving the version unpinned so the guidance does not go stale; the API and
  batch examples use `gpt-5`/`gpt-5-mini` with a note to use the id the account exposes (#66).

### Fixed
- `scripts/validate-package.mjs` now asserts `level` is in `schema/finding.json`'s required array,
  so dropping `level` from the schema fails `npm run validate` (it was silently allowed) (#61).

## [0.3.0] - 2026-06-28

### Fixed
- contexts/gemini.md structured-output schema: `case` is now STRING (was INTEGER, which dropped
  every C/JS/R/S code from a Gemini run) and the required `level` field plus a `required` list were
  added, matching finding.json (#76).
- `fragments/semantic-cases-compact.md` was missing S14/S15/S16, so the Codex/Gemini hosts (which
  read only the synced compact table) did not know those patterns exist. Added the three rows and
  resynced AGENTS.md and GEMINI.md, closing the same host-under-detect gap the SKILL.md guard
  targets (#78).

### Changed
- Stale catalog ranges updated to `C1-C45, C48` (the catalog skips C46/C47) and `S1-S16` across
  contexts/claude.md, contexts/cursor.md, README.md, llm.md, AGENTS.md, SKILL.md, and
  skills/falsegreen-llm/SKILL.md; the contexts/claude.md output template now includes `level` (#79, #80).
- reference.md S15 boundary clarified: a retry that re-raises on exhaustion is a sanctioned settle,
  not a flakiness mask (#80).

### Added
- reference.md now carries the project-layer config codes (PL2/PL7/PL8 Python, PL7/PL8/PL10 JS,
  PL9 Robot), Robot R7 (hollow [Template] keyword), and Robot D2 (test-level control flow), closing
  the superset gap: every code the three scanners emit is now mirrored in the catalog (#75).

### Changed
- validate-package.mjs comment no longer overstates the drift guard: it checks SKILL.md is a subset
  of reference.md, not reference.md vs the sibling scanners (the latter is enforced by review) (#77).

### Added
- Catalog (reference.md): three semantic S-codes for patterns only the LLM pass can judge -
  `S14` recorded model output used as the oracle (J2; agent/RAG/eval snapshot of a completion or
  judge verdict), `S15` hand-rolled retry/poll loop masking flakiness (J6; the loop-bodied sibling
  of C35's decorator), `S16` call-verification as the sole oracle (J4; `toHaveBeenCalled`/
  `assert_called` with no output or state assertion). Each ships a BAD/CLEAN pair and a
  do-not-flag boundary (#63, #64, #65).

### Added
- `npm run validate` now guards catalog drift (#60): it fails if SKILL.md advertises a
  canonical code reference.md does not define (reference.md is the superset; SKILL.md must
  be a subset), and if the finding.json and report.json `language` enums diverge. Keeps a
  host that reads only SKILL.md from under-detecting and the two schemas in lockstep.

### Fixed (earlier in the 0.3.0 cycle)
- A plain @pytest.mark.xfail is exempt from C2/C5 when the project enables strict xfail globally (xfail_strict=true), and stays false-green otherwise (#54, #58).
- C6 restricted to non-boolean values (a captured boolean status asserted with Should Be True is the correct oracle); LocalStack level cue mirrored; C9 documents the REGEXP:.* catch-all; release workflow on Node 22 for npm OIDC (#56).


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

[Unreleased]: https://github.com/vinicq/falsegreen-skill/compare/v0.6.3...HEAD
[0.6.3]: https://github.com/vinicq/falsegreen-skill/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/vinicq/falsegreen-skill/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/vinicq/falsegreen-skill/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/vinicq/falsegreen-skill/compare/v0.5.2...v0.6.0
[0.5.2]: https://github.com/vinicq/falsegreen-skill/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/vinicq/falsegreen-skill/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/vinicq/falsegreen-skill/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/vinicq/falsegreen-skill/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/vinicq/falsegreen-skill/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/vinicq/falsegreen-skill/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/vinicq/falsegreen-skill/releases/tag/v0.1.0
