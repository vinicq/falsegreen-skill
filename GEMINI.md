# falsegreen-skill for Gemini

LLM-based semantic analysis for false-positive test detection. This skill
judges whether a test genuinely verifies correct behavior, across Python,
TypeScript, JavaScript, and Robot Framework, plus semantic patterns no static
tool can see.

Full protocol: `SKILL.md`. Language patterns: `reference.md`.
The S1-S18 and S21 semantic codes are language-agnostic; Step 4 below applies
them, and the compact table further down carries a row for each one.
Gemini-specific API guide: `contexts/gemini.md`.
Report schema: `schema/report.json`.

---

## How to invoke

Say any of the following:

- "Analyze this test file for false-positive smells."
- "Run falsegreen analysis on the tests/ directory."
- "Check these tests with the J1-J6 framework."
- "Are there any false positives in this test suite?"

You can attach a single file, paste a snippet, or point to a directory.

### Test discovery

The Antigravity CLI (`agy`) auto-parses this file as a workspace rule file on
startup, and registers the `.agents/skills/falsegreen-skill/SKILL.md` skill as
the `/falsegreen-skill` slash command, so the protocol is always in scope. The
agent's file tools let it read test files without you pasting them manually.
Say:

- "find and analyze all tests in this project"
- "run falsegreen on the tests/ directory"
- "check the component tests under src/__tests__/"

Gemini discovers files by pattern (`test_*.py`, `*.test.ts`, `*.spec.ts`,
`*.test.tsx`, `*.spec.tsx`, `*.test.js`, `*.spec.js`, `*.spec.jsx`) and reads
each before applying the protocol. Frontend component tests are included — no
separate invocation needed.

---

## Long-context advantage

Gemini 2.5 Pro supports up to 1 million tokens. You can load an entire test
directory in a single request and get a consolidated report across all files.
This matters for case 15 (order-dependent tests), which is invisible when files
are analyzed in isolation.

When given a directory, read all test files and produce a single consolidated
report. Do not summarize per file; deduplicate cross-file findings.

Prompt that works well:

```
Analyze all test functions in the following suite using the falsegreen-skill
protocol. Apply the full J1-J6 framework to each test and output findings in
standard CASE / SUMMARY format.

<paste entire tests/ directory content here>
```

---

## Protocol (compact)

Work through these steps in order. Do not skip steps.

**Step 0 (optional):** If the user supplies a `conventions:` block, incorporate
it before judging. It extends look-alike exemptions, not severity levels.

**Step 1: Detect language, framework, and level.**
Identify: Python / TypeScript / JavaScript / Robot Framework; pytest / unittest /
Jest / Vitest / Mocha+Chai / Cypress / Playwright / Robot. Read the level from
signals (the pyramid): unit (boundaries doubled), integration (real HTTP client
or ORM/driver - API and database), or E2E (browser). Strongest signal wins
(markers, paths, file names, `conventions:`). The level changes the oracle: in
E2E the presence of a page/element IS the assertion; a real API/DB call in a
unit test is itself the smell. Report the level in each finding.

**Step 2: Python structural pass.**
If Python, scan against all falsegreen families before semantic judgment:

| Family | Codes | What to look for |
|---|---|---|
| A - never checks | C1, C2, C2b, C3, C4, C4b, C20, C21, C38, C39, C43, C45, CC | assertion unreachable, missing, swallowed, uncollected, name-shadowed, returned-not-asserted, mid-test skip, empty parametrize |
| B - weak/always-true | C5, C6, C6b, C7, C8, C9, C11a, C13, C13b, C14, C16, C18, C25, C34, C42, C44 | tautology, truthiness-only, self-compare, broad exception, string repr, generator/lambda truthy, numeric tautology |
| C - checks own setup | C19, C28, C29 | pytest.raises wraps too much, binding unread, env mutation |
| D - external state | C17, C23, C24, C27, C30, C31, C32, C35 | skip-on-failure, hard path, shared mutable, try/pass, flaky |
| E - wrong thing | C33, C36, C37 | metric not asserted, fail without reason, duplicate case |
| Optional / diagnostic (opt-in) | C22, D1, D3, D4, D5, D6, M2 | apply only when user requests |

For TypeScript, JavaScript, Robot Framework, and the project layer this file
carries no table, but the structural pass is not optional. Load the matching
`reference.md` section and apply every code in it - the 24 JS-codes for TS/JS,
the R-codes for Robot, the PL codes for project layout - then continue to Step 3.
Load the section in full: Gemini's context is measured in hundreds of thousands
of tokens and the largest section is ~19 KiB, so the passage-scoped rule that the
Codex path needs does not apply here.

**Step 3: Classify test intent.**

| Class | Meaning | Oracle |
|---|---|---|
| spec/TDD | the test is the spec | the test itself |
| characterization | intentionally freezes current behavior | current output |
| regression | records a known bug fix | the bug report |
| behavior | verifies a production rule or contract | spec / docstring / types |

A failing TDD test is not a false positive. Classify before judging.

**Step 4: Apply J1-J6.**

- **J1:** Does the assertion run? Vacuous passes from unreachable or skipped assertions.
- **J2:** Is the expected value from an independent oracle? Not from current code output or a re-implementation of the formula.
- **J3:** Is the real unit under test? Mocking the SUT and asserting the mock is not a test.
- **J4:** Does the assertion verify enough, and the right thing? Not just truthiness or broad exception type.
- **J5:** Is the test coupled to implementation internals? Fails when those internals change even though the public contract still holds.
- **J6:** Does the test pass in isolation? Not order-dependent on siblings or shared mutable state.

Flag only the first failing judgment per test. Do not double-report.

**Then screen every S-code, on every file, whatever the language.** S1-S18 and
S21 are part of this step, not a preamble to it: walk the table under "Semantic
cases (quick lookup)" below row by row, check each candidate against "Look-alike
exemptions for the semantic codes", then move on. Step 4 is not complete until
every S-code has been considered. This holds for Python, TypeScript, JavaScript,
and Robot Framework alike.

**Step 5: Adversarial verify for case 18.**
Case 18 (expected value contradicts what the code should do) requires an
independent oracle before reporting. Run a refuter pass: assume the expected
value is correct and argue why. Only report case 18 HIGH when the refuter
cannot mount a credible defense. Never report on pattern-matching alone.

**Step 6: Output the report.**

For each finding:

```
CASE {number} ({J-code}) - {HIGH|LOW} - {language} - {intent}

Test: {function name, line range}
Finding: {one sentence describing what is wrong}
Evidence: {the specific line(s) that triggered this}
Oracle: {case 18 only: cite the independent oracle}
Fix hint: {one sentence suggestion}
```

Then the summary block:

```
SUMMARY
Tests reviewed: N
Findings: M (H high, L low)
Clean: N-M
```

**Step 7 (optional):** When the report contains 3 or more findings of the same
code, append a pattern note to the SUMMARY suggesting a conventions block.

---

## Semantic cases (quick lookup)

<!-- fg:semantic-cases-compact:start -->
| Case | Judgment | Severity | Name | Rule |
|---|---|---|---|---|
| 10 | J3 | HIGH | Mocks the unit under test | Patches/mocks the function being tested, then asserts on the mock's return value |
| 11 | J2/J3 | HIGH | Asserts the value fed to the mock | Stubs dependency to return X, then asserts result == X with no real logic in between |
| 12 | J2 | HIGH | Re-implements the production formula | Expected value computed with the same formula as the SUT; both sides agree on the same wrong answer |
| 15 | J6 | HIGH | Passes only if another test ran first | Reads shared mutable state written by a sibling test; fails when run alone |
| 18 | J2 | HIGH | Expected value contradicts what the code should do | Asserts a value the independent oracle says is wrong; requires cited oracle before reporting |
| S1 | J4 | - | Intent mismatch | The name or docstring claims to verify X, the assertion checks Y or a trivial property (`test_applies_discount` that only asserts the call did not raise) |
| S2 | J4 | - | Irrelevant oracle | The assertion checks a property unrelated to the behavior under test: a test of the computed total that only asserts the response is not null |
| S3 | J2 | - | Plausible-but-wrong expected value | The expected constant looks reasonable but contradicts the spec (off-by-one, wrong rounding, wrong sign); derive the correct value from the spec and compare |
| S4 | J4 | - | Oracle cannot distinguish correct from a likely bug | The assertion passes for the right output and for a plausible wrong one: `len(result) == 3` when the suspected bug also yields three items |
| S5 | J3 | - | Tests the framework, not the code | The assertion exercises a language or library guarantee (a dict stores a key, the ORM returns what was just saved) instead of the code under test |
| S6 | J4 | - | Happy-path only against a stated contract | The spec or docstring promises error handling or boundaries, the test covers only the nominal path |
| S7 | J2 | - | Expected lifted from the output | The expected value was copied from a run of the current code (a pasted dict, a captured response), so the test can only confirm the code matches itself |
| S8 | J3 | - | Mock return reaches the assertion through an indirection | The stub's value flows through one or two trivial steps to the assertion, so the test still echoes the stub instead of verifying real behavior |
| S9 | J2 | - | Self-fulfilling arrangement | The test arranges the exact state it then asserts, with no transformation by the unit under test |
| S10 | J4 | - | Asserts the log, not the effect | The only check is that a message was logged, not the state change the message describes |
| S11 | J4 | - | Negative-only assertion on a security filter | A sanitizer, redactor, or auth test asserts only that the bad thing is absent (`"password" not in response`); it passes when the output is empty or dropped, so require a paired positive assertion |
| S12 | J3 | - | Patches core logic instead of an external edge | The test patches a private method or a direct collaborator on the class under test, so the assertion reads the stub, not the unit's own logic; patching a genuine external edge is legitimate |
| S13 | J6 | - | Passes only via shared state a sibling set up | The test relies on module-global, fixture, or hoisted state that another test or an import mutates, so it passes only in a given execution order |
| S14 | J2 | - | Recorded model output as the oracle | Asserts `==` against a snapshotted LLM/model result; green means the model still emits what it once emitted, not that the output is correct |
| S15 | J6 | LOW | Hand-rolled retry/poll loop masking flakiness | Wraps action+assertion in a retry/poll and passes if any attempt succeeds; only the swallow-and-pass form (a retry that re-raises on exhaustion is a sanctioned settle, not S15) |
| S16 | J4 | LOW | Call-verification as the sole oracle | The only check is that a collaborator was called (`assert_called_once`/`toHaveBeenCalled`), with no assertion on the unit's own return value or state |
| S17 | J4 | HIGH | Exception-path oracle blindness | `pytest.raises(Exception)`/`expect(fn).toThrow()` with no type or message on a documented error contract; goes green when the exception came from arrange (typo, missing import, None-deref) and the SUT never reached its raise |
| S18 | J3 | LOW | Contract-impossible stub value | A legitimate edge stub is configured to return a value the real collaborator can never emit (negative price, schema-violating row, `None` where non-null is guaranteed); the SUT handles an unreachable branch while the real defect goes untouched |
| S21 | J2 | LOW | Self-judging LLM/agent assertion | The oracle is a live model call (`judge_llm(...) == "yes"`, embedding-similarity against a model-generated reference, agent grading its own transcript); circular, passes whenever the judge is wrong in the same direction as the SUT |
<!-- fg:semantic-cases-compact:end -->

## Look-alike exemptions for the semantic codes

Check these before reporting any S-code. They override the table above: a
pattern listed here is correct code.

<!-- fg:semantic-exemptions:start -->
Look-alikes - do NOT flag: a deliberately narrow unit test whose scope the spec confirms
(S6 needs a stated broader contract); a constant that the spec genuinely endorses (not S3);
a sanitizer test that already pairs the negative check with a positive one (not S11); a test
of a filter whose contract is to drop the input entirely - a blocklist sanitizer, a
guard that returns empty on a forbidden value, a redactor that suppresses the whole field -
where empty output is the correct behavior, so the negative-only assertion legitimately
passes and a positive "content survived" assertion would contradict the design (not S11); a
mock on a genuine external edge - DB, network, clock (not S12); a `jest.spyOn(instance, 'methodA')` / `vi.spyOn` that stubs a DIFFERENT method than the one under test, to isolate an orchestrator from a sibling sub-unit (the assertion is on the composed result, not the stub) - S12 fires only when the patched symbol is a method of the SUT instance itself or the assertion echoes the stub value (not S12); a constructor-injected or module-level collaborator mock - repository, db, auth, or HTTP client (a clean case-10 external edge, not S12); a stub-config call made on the very library under test - `mockingoose`, `tinyspy`, `jsdom-testing-mocks` - where the mocking library IS the SUT, so the stub setup is production code (not S5/S8/C11a); a test whose shared state is
reset by an autouse/`beforeEach` teardown (not S13); a structural or contract assertion on a
model output - valid JSON, required keys present, a cited source id matches, a refusal on a
banned prompt, a deterministic post-processing step - or a mocked/stubbed model whose return is
fixture data (not S14); a sanctioned async-settling wait - Robot `Wait Until Keyword Succeeds`,
Testing Library `waitFor`/`findBy*`, Playwright/Cypress auto-wait, `await expect(...).toPass()` -
that polls a real settle condition and still fails hard on timeout (not S15); a call-only
assertion where the interaction IS the contract - a fire-and-forget event, an audit-log or
telemetry write, a queue publish - or a `toHaveBeenCalledWith`/`assert_called_once_with` that
pins the specific arguments, or any call-verification paired with an assertion on the SUT's return value or state - S16 requires the call-verification to be the SOLE oracle (not S16); a `pytest.raises(SpecificError, match=...)` bound to the SUT line (not S17); a stub fed a value the collaborator's contract can actually return (not S18); a test under `*.problem.*` / `*.solution.*` / `exercises/` / `katas/` / `playground/` - a teaching or TDD-spec fixture whose expected value is intentional (the exercise IS the spec), not a frozen bug (not case 18, not S3); a deterministic rubric, structural validator, or frozen human-labeled judge set rather than a live model verdict (not S21).
<!-- fg:semantic-exemptions:end -->

---

## Precision-first rules

<!-- fg:precision-rules:start -->
1. Never report case 18 without citing an independent oracle.
2. If a mock replaces a network/disk/time dependency (an edge), it is NOT
   case 10. Case 10 applies only when the mock replaces the unit being tested.
3. A characterization test is not a bug even if the expected value looks wrong.
   Classify first (Step 3) before judging.
4. A test decorated with `@pytest.mark.skip`, `@pytest.mark.xfail(strict=True)`,
   or `@unittest.skip` that has no assertion body is NOT C2/C5. The marker stops
   it from running (skip) or fails it on XPASS (strict xfail). A plain
   `@pytest.mark.xfail` (no `strict=`) is exempt ONLY when the project turns on
   strict xfail globally - `xfail_strict = true` in pytest config (pytest.ini,
   `[tool.pytest.ini_options]`, setup.cfg) or `-o xfail_strict=true` - because the
   marker then inherits strict and an XPASS fails the run. Otherwise a plain xfail
   still executes and an XPASS keeps exit status 0, so a no-assertion test stays
   false-green. Check the pytest config (or a `conventions:` override) first.
5. In web/UI layer tests, a truthiness check on a response or locator object
   is NOT case 6. Presence of a response IS the assertion at that layer.
6. Tests decorated with `@given`, `@hypothesis`, or `@fuzz` that have no
   explicit `assert` are NOT C2. These frameworks generate and check
   assertions internally.
7. `expectTypeOf(v).toEqualTypeOf<T>()` in Vitest is a compile-time type
   assertion. Not C5. Do not flag it.
<!-- fg:precision-rules:end -->

---

## Thinking mode tip

For case 18 adversarial verify, use extended thinking with
`thinking_budget=8192` to give the refuter pass deeper reasoning before
committing to a HIGH confidence finding. See `contexts/gemini.md` for the
exact API call. A budget of 8192 tokens covers most cases; go up to 16384
for complex domain logic.

---

## Output format reference

`CASE {number} ({J1-J6}) - {HIGH | LOW} - {language} - {intent: spec|char|regression|behavior}`

HIGH only when there is no plausible legitimate interpretation.
Precision over recall: a wrong HIGH finding is worse than a missed LOW one.
