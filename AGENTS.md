# falsegreen-skill

LLM-based semantic analysis for false-positive test detection. This skill
judges whether a test genuinely verifies correct behavior, across Python,
TypeScript, JavaScript, and Robot Framework, plus semantic patterns no static
tool can see.

A test is useful only if it fails when the code breaks. Every pattern this
skill looks for is a variation on tests that do not fail: tests that pass
while the code is wrong, tests that check the wrong thing, or tests that
borrow correctness from elsewhere.

Full protocol: `SKILL.md`. Language patterns catalog: `reference.md`.
API integration guide: `contexts/codex.md`. Structured output schema: `schema/report.json`.

---

## How to invoke

Say any of:

- "analyze this test file for false-positive smells"
- "run falsegreen analysis on tests/"
- "check tests/test_payments.py for false positives"

Attach a test file or paste a snippet. For Python projects, you can also paste
the output of the `falsegreen` static scanner first; the skill will skip the
structural pass and go directly to semantic adjudication.

### Test discovery

Codex has shell tools and can locate test files automatically. You do not need
to list paths or paste file contents. Say:

- "find and analyze all test files in this project"
- "run falsegreen on every test file under tests/"
- "check only the component tests in src/__tests__/"

Codex runs shell commands to discover files by pattern:

| Language | Patterns |
|---|---|
| Python | `test_*.py`, `*_test.py` |
| TypeScript / TSX | `*.test.ts`, `*.spec.ts`, `*.test.tsx`, `*.spec.tsx` |
| JavaScript / JSX | `*.test.js`, `*.spec.js`, `*.test.jsx`, `*.spec.jsx` |

Backend and frontend component tests (React, Vue, Angular) are included in
the same discovery pass — no extra configuration needed.

---

## Protocol (compact)

Work through these steps in order.

### Step 1: Detect language, framework, and level

Identify the language (Python / TypeScript / JavaScript / Robot Framework), the
test framework (pytest / unittest / Jest / Vitest / Mocha+Chai / Cypress /
Playwright / Robot), and the level from signals (the pyramid): unit (boundaries
doubled), integration (real HTTP client or ORM/driver - API and database), or
E2E (browser). Strongest signal wins (markers, paths, file names, `conventions:`).
The level changes the oracle (E2E presence IS the assertion; affects C6/C14); a
real API/DB call in a unit test is itself the smell. Report the level per finding.

### Step 2: Apply the Python structural catalog (Python only)

Scan against all falsegreen pattern families in order:

| Family | Codes | What to look for |
|---|---|---|
| A - never checks | C1, C2, C2b, C2c, C3, C4, C4b, C20, C21, C38, C39, C43, C45, C49, C50, C51, C59, CC | assertion unreachable, missing, swallowed, uncollected, name-shadowed, returned-not-asserted, discarded-comparison statement, empty/multi-call raises-warns context, captured log/output never asserted, mid-test skip, empty parametrize |
| B - weak/always-true | C5, C6, C6b, C6c, C7, C8, C8b, C9, C11a, C13, C13b, C14, C16, C18, C25, C34, C42, C44, C52, C55, C56, C57 | tautology, truthiness-only, self-compare, broad exception, string repr, generator/lambda truthy, numeric tautology, membership self-confirmation, mock-rooted compare, never-awaited coroutine, unconfigured Mock attribute |
| C - checks own setup | C19, C28, C29 | pytest.raises wraps too much, binding unread, env mutation |
| D - external state | C17, C23, C24, C27, C30, C31, C32, C35 | skip-on-failure, hard path, shared mutable, try/pass, flaky |
| E - wrong thing | C33, C36, C37, C41 | metric not asserted, fail without reason, duplicate case, None-returning mutator |
| Optional / diagnostic (opt-in) | C22, D1, D3, D4, D5, D6, M2 | apply only when user requests |

Report each structural finding before proceeding to Steps 3-6.

For TypeScript / JavaScript, Robot Framework, and the project layer, the family
tables above are partial. The complete emitted code set is indexed below, one row
per code, so you can run every code without opening `reference.md` first. Work
from the index, then pull the `reference.md` passage for a code only when a
finding needs its full definition or its look-alike exemption.

That order matters and the reverse does not work. This file is ~25 KiB and the
TS/JS section is ~19 KiB, so loading a whole section puts the pair past the
~32 KiB Codex budget before any test source loads and the host truncates
mid-file. But you also cannot ask for the passage of a code you have never seen
named. The index is what closes that gap: ~3 KiB for all 39 codes.

### Structural code index (TS/JS, Robot, project layer)

Generated from `schema/code-catalog.json` and `schema/scanner-codes.json`, so it
cannot drift. Every code `falsegreen-js` or `falsegreen-robot` can emit has a row.
Scanner column: `js` falsegreen-js, `rf` falsegreen-robot, `js/rf` both. Severity
`-` means no fixed severity. The D-series and M2 are opt-in diagnostics: apply
them only when the user asks.

<!-- fg:structural-codes-compact:start -->
| Code | Scanner | Severity | What to look for |
|---|---|---|---|
| C2 | js/rf | HIGH | Test body contains no assertion at all |
| C2b | js/rf | LOW | Test calls production code but verifies nothing |
| C3 | rf | HIGH | Assert inside try whose except swallows the error |
| C5 | js/rf | HIGH | Always-true assertion |
| C6 | js/rf | LOW | Weak assertion: only checks that something came back |
| C7 | js/rf | HIGH | Self-comparison: both sides are identical |
| C8 | js | LOW | Float exact equality |
| C8b | js | LOW | Approximate equality with no explicit tolerance |
| C9 | js/rf | LOW | pytest.raises too broad |
| C9b | rf | - | RequestsLibrary `expected_status=any` |
| C11a | js/rf | LOW | Self-confirming literal: test assigns then asserts the same value |
| C16 | js/rf | LOW | Result depends on uncontrolled time, randomness, or sleep |
| C18 | js | LOW | String/repr comparison |
| C20 | js/rf | HIGH | Assertion after unconditional return/raise/fail |
| C21 | js/rf | LOW | Every assertion is inside a conditional; none runs unconditionally |
| C23 | js/rf | LOW | Hard-coded absolute or home-relative file path |
| C31 | rf | LOW | capsys.readouterr() result discarded |
| C32 | rf | LOW | @pytest.mark.skip without reason |
| C37 | js/rf | LOW | Duplicate parametrize case |
| C44 | js/rf | HIGH | Numeric tautology |
| C48 | js | LOW | Dark patch: flips a test-mode flag then asserts |
| CC | js/rf | LOW | Commented-out assert |
| D1 | js | LOW | Assertion Roulette: multiple asserts, none with a message |
| D2 | rf | - | Control flow at test level |
| D3 | js | LOW | Duplicate Assert: same assertion appears twice |
| D4 | js | LOW | Unnamed parametrize cases |
| D6 | js | LOW | Debug print in test |
| D7 | js | LOW | Anonymous test: empty or missing description |
| D8 | js | LOW | Magic number in an assertion |
| JS1 | js | HIGH | focused test (`it.only`/`fit`) skips the rest of the suite |
| JS2 | js | HIGH | `expect(x)` with no matcher |
| JS3 | js | LOW | snapshot is the only assertion |
| JS4 | js | LOW | skipped test (`it.skip`/`xit`/`it.todo`) |
| JS5 | js | LOW | async query/event not awaited (`findBy*`/`waitFor`/user-event) |
| JS6 | js | HIGH | empty `describe`/`suite` |
| JS7 | js | LOW | assertion in a non-awaited `setTimeout`/`then` callback |
| JS8 | js | LOW | mocks the unit under test and asserts it directly |
| JS9 | js | HIGH | assertion in a dead literal branch (`if(false)`) |
| JS11 | js | LOW | `try/catch` swallows the assertion |
| JS13 | js | LOW | `queryBy*`/`queryAllBy*` query (returns null when absent) as a loose statement, never asserted - `getBy*`/`getAllBy*`/`findBy*`/`findAllBy*` throw on absence and ARE the assertion |
| JS15 | js | LOW | comparison wrapped in a boolean (`expect(a===b).toBe(true)`) |
| JS17 | js | LOW | commented-out test block (`// it(...)`) |
| JS18 | js | LOW | `done` callback instead of async/await |
| JS21 | js | HIGH | matcher referenced but never called (`expect(x).toBe` with no `()`) |
| JS22 | js | HIGH | empty `it.each`/`test.each` table |
| JS23 | js | HIGH | `expect.assertions(N)` with fewer unconditional reachable `expect()` calls than `N` |
| JS24 | js | LOW | Cypress `cy.get/find/contains` query statement with no `.should`/`.and`/`.then` assertion |
| JS25 | js | HIGH | the only assertion sits inside an array-iterator callback (`forEach`/`map`/`filter`/`some`/`every`/`flatMap`) - runs zero times on an empty collection |
| JS26 | js | LOW | fake timers installed but never advanced (`runAllTimers`/`advanceTimersByTime`/`tick`) - the scheduled callback never fires, so the assertion reads un-mutated state |
| JS27 | js | LOW | `toHaveBeenCalled*` is the sole oracle on a locally-created double - verifies wiring, not behaviour |
| JS29 | js | LOW | `expect(...).resolves`/`.rejects` chain is a bare statement, not awaited or returned - the test finishes green before the matcher settles |
| JS30 | js | HIGH | literal-vs-literal assertion (`expect(2).toBe(3)`, chai `expect(x).to.equal(y)`) - both operands are fixed at parse time |
| JS31 | js | LOW | `try/catch` swallows a possible throw with no assertion on the exception - a unit that stops throwing still passes green |
| M2 | js/rf | LOW | Long test method |
| PL7 | js | - | No coverage gate |
| PL8 | js | - | Run stops early |
| PL9 | rf | - | Skip-on-failure run option |
| PL10 | js | - | passWithNoTests |
| R1 | rf | - | Forced green |
| R2 | rf | - | Hollow verifier keyword |
| R3 | rf | - | Test Cases in a .resource |
| R4 | rf | - | No Operation only |
| R5 | rf | - | Empty [Template] |
| R6 | rf | - | Should Be True on a string literal |
| R7 | rf | - | Hollow [Template] keyword |
| R8 | rf | - | Verification only in Setup |
| R8b | rf | - | Verification only in Teardown |
<!-- fg:structural-codes-compact:end -->

The S1-S18 and S21 semantic codes are language-agnostic and apply to every
language, Python included. Everything needed to run them is in this file: the
table under "Semantic cases (quick reference)" below carries a row per code, and
"Look-alike exemptions for the semantic codes" carries the exemptions you must
check before reporting one. `reference.md` under
`## Patterns only the semantic pass can catch (AI-only)` has the same codes as
full prose with examples; read it when a finding needs the long form.

### Step 3: Classify test intent

| Class | Meaning |
|---|---|
| spec/TDD | the test is the spec; code must match it |
| characterization | intentionally freezes current behavior |
| regression | records a known bug fix |
| behavior | verifies a production rule or contract |

Misclassifying intent causes false alarms. A failing TDD test is not a false
positive. A labeled characterization snapshot is not a frozen bug.

### Step 4: Apply the six judgments (J1-J6)

Flag only the first judgment that fails. Do not double-report the same root cause.

**J1 - Does the assertion run?**
Does at least one assertion execute when the test runs normally? An assertion
inside a branch that never fires, or after an unconditional return, passes vacuously.

**J2 - Is the expected value from an independent oracle?**
Is the expected value derived from the spec or API contract, not from the
current code output? If both sides agree on the same wrong number, the test
cannot catch the bug.

**J3 - Is the real unit under test?**
Is the test verifying the actual production unit, or a mock of it? Mocking
the function under test and asserting the mock value is not a test of
production code.

**J4 - Does the assertion verify enough, and the right thing?**
Does the assertion check a meaningful property? Checking only truthiness, or
that an exception was raised without verifying its type, does not protect the
behavior under test.

**J5 - Is the test coupled to implementation internals?**
Does the test fail when internals change - private methods, internal state,
call order - even though the public contract still holds?

**J6 - Does the test pass in isolation?**
Does the test depend on execution order or shared mutable state? A test that
passes only in a specific order is not reliably testing anything.

**Then screen every S-code, on every file, whatever the language.** S1-S18 and
S21 are part of this step, not a preamble to it: walk the table under "Semantic
cases (quick reference)" below row by row, check each candidate against
"Look-alike exemptions for the semantic codes", then move on. Step 4 is not
complete until every S-code has been considered. For the S-series specifically,
nothing outside this file is needed; structural passages still come from
`reference.md`.

### Step 5: Adversarial verify for case 18

Case 18 (expected value contradicts what the code should do) means the test
has frozen a bug as correct. Before reporting it:

1. Cite the independent oracle: spec, docstring, type annotation, API contract,
   or domain rule. If you cannot cite one, do not report case 18.
2. Argue that the expected value is actually correct. If the argument holds,
   withdraw the finding.
3. Report only when the oracle clearly contradicts the expected value and the
   adversarial argument fails.

Never report case 18 based on pattern-matching alone.

### Step 6: Output the report

For each finding:

```
{code} ({J}) - {confidence: HIGH | LOW} - {language} - {level: unit|integration|e2e|fixture} - {intent: spec|char|regression|behavior|scaffold}

Test: {function name, line range}
Finding: {one sentence describing what is wrong}
Evidence: {the specific line(s) that triggered this}
Oracle: {for case 18 only: cite the independent oracle}
Fix hint: {one sentence suggestion}
```

`{code}` is any catalog id: a semantic case (CASE-10/11/12/15/18), a structural
C-code (C*), a JS/TS code (JS*), a Robot code (R*), or a semantic S-code (S*).
`{J}` is the judgment that failed (J1-J6).

Then a summary block:

```
SUMMARY
Tests reviewed: N
Findings: M (H high, L low)
Clean: N-M
```

Use HIGH only when there is no plausible legitimate interpretation.
Precision over recall: a wrong HIGH finding is worse than a missed LOW one.

---

## Semantic cases (quick reference)

<!-- fg:semantic-cases-compact:start -->
| Case | Judgment | Name | Rule |
|---|---|---|---|
| 10 | J3 | Mocks the unit under test | Patches/mocks the function being tested, then asserts on the mock's return value |
| 11 | J2/J3 | Asserts the value fed to the mock | Stubs dependency to return X, then asserts result == X with no real logic in between |
| 12 | J2 | Re-implements the production formula | Expected value computed with the same formula as the SUT; both sides agree on the same wrong answer |
| 15 | J6 | Passes only if another test ran first | Reads shared mutable state written by a sibling test; fails when run alone |
| 18 | J2 | Expected value contradicts what the code should do | Asserts a value the independent oracle says is wrong; requires cited oracle before reporting |
| S1 | J4 | Intent mismatch | The name or docstring claims to verify X, the assertion checks Y or a trivial property (`test_applies_discount` that only asserts the call did not raise) |
| S2 | J4 | Irrelevant oracle | The assertion checks a property unrelated to the behavior under test: a test of the computed total that only asserts the response is not null |
| S3 | J2 | Plausible-but-wrong expected value | The expected constant looks reasonable but contradicts the spec (off-by-one, wrong rounding, wrong sign); derive the correct value from the spec and compare |
| S4 | J4 | Oracle cannot distinguish correct from a likely bug | The assertion passes for the right output and for a plausible wrong one: `len(result) == 3` when the suspected bug also yields three items |
| S5 | J3 | Tests the framework, not the code | The assertion exercises a language or library guarantee (a dict stores a key, the ORM returns what was just saved) instead of the code under test |
| S6 | J4 | Happy-path only against a stated contract | The spec or docstring promises error handling or boundaries, the test covers only the nominal path |
| S7 | J2 | Expected lifted from the output | The expected value was copied from a run of the current code (a pasted dict, a captured response), so the test can only confirm the code matches itself |
| S8 | J3 | Mock return reaches the assertion through an indirection | The stub's value flows through one or two trivial steps to the assertion, so the test still echoes the stub instead of verifying real behavior |
| S9 | J2 | Self-fulfilling arrangement | The test arranges the exact state it then asserts, with no transformation by the unit under test |
| S10 | J4 | Asserts the log, not the effect | The only check is that a message was logged, not the state change the message describes |
| S11 | J4 | Negative-only assertion on a security filter | A sanitizer, redactor, or auth test asserts only that the bad thing is absent (`"password" not in response`); it passes when the output is empty or dropped, so require a paired positive assertion |
| S12 | J3 | Patches core logic instead of an external edge | The test patches a private method or a direct collaborator on the class under test, so the assertion reads the stub, not the unit's own logic; patching a genuine external edge is legitimate |
| S13 | J6 | Passes only via shared state a sibling set up | The test relies on module-global, fixture, or hoisted state that another test or an import mutates, so it passes only in a given execution order |
| S14 | J2 | Recorded model output as the oracle | Asserts `==` against a snapshotted LLM/model result; green means the model still emits what it once emitted, not that the output is correct |
| S15 | J6 | Hand-rolled retry/poll loop masking flakiness | Wraps action+assertion in a retry/poll and passes if any attempt succeeds; only the swallow-and-pass form (a retry that re-raises on exhaustion is a sanctioned settle, not S15) |
| S16 | J4 | Call-verification as the sole oracle | The only check is that a collaborator was called (`assert_called_once`/`toHaveBeenCalled`), with no assertion on the unit's own return value or state |
| S17 | J4 | Exception-path oracle blindness | `pytest.raises(Exception)`/`expect(fn).toThrow()` with no type or message on a documented error contract; goes green when the exception came from arrange (typo, missing import, None-deref) and the SUT never reached its raise |
| S18 | J3 | Contract-impossible stub value | A legitimate edge stub is configured to return a value the real collaborator can never emit (negative price, schema-violating row, `None` where non-null is guaranteed); the SUT handles an unreachable branch while the real defect goes untouched |
| S21 | J2 | Self-judging LLM/agent assertion | The oracle is a live model call (`judge_llm(...) == "yes"`, embedding-similarity against a model-generated reference, agent grading its own transcript); circular, passes whenever the judge is wrong in the same direction as the SUT |
<!-- fg:semantic-cases-compact:end -->

### Look-alike exemptions for the semantic codes

Check these before reporting any S-code. They are the precision half of the
table above, and they override it: a pattern listed here is correct code.

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

Cases from the structural families (the 57 C-codes plus CC) apply to Python directly.
For TypeScript/JavaScript, apply them by reading the source semantically.
Full patterns with examples are in `reference.md`.

---

## TypeScript/JavaScript structural patterns (summary)

- Conditional test: `expect()` inside an `if`/`switch` that may never fire (J1, HIGH)
- Unknown test: no `expect()` calls at all (J1, HIGH)
- Swallowed try/catch: exception absorbed, assertion absent or inside the catch (J1, HIGH)
- Assertion in `.forEach`/`.map` over a possibly empty collection (J1, HIGH)
- Missing `return`/`await` on Promise chain: assertion inside `.then()` never fires (J1, HIGH)
- `done()` called before assertion in Mocha/Jest callback style (J1, HIGH)
- Literal-vs-literal: `expect(true).toBe(true)` or `assert.equal(1, 1)` (J2, HIGH)
- `var` hoisting creates hidden shared state across tests (J6, MEDIUM)
- `expect.assertions(N)` guard missing on async test (J1, MEDIUM)
- `it.skip`/`xit` left permanently (J1, MEDIUM)

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

## Reference files

- `SKILL.md` - complete protocol with all steps, edge cases, and multi-agent mode
- `reference.md` - full case catalog with per-language patterns and look-alike exemptions
- `contexts/codex.md` - OpenAI API integration, structured output, batch processing
- `schema/report.json` - JSON schema for structured output reports
