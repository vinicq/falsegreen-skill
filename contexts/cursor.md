# falsegreen-skill in Cursor

How to install and use falsegreen-skill inside Cursor IDE.

---

## Installation

Create the file `.cursor/rules/falsegreen-skill.mdc` in your project root. Copy the full
template below. Cursor loads it automatically when you open a matching test file.

```
.cursor/
  rules/
    falsegreen-skill.mdc
```

---

## Full MDC template

Copy this file verbatim to `.cursor/rules/falsegreen-skill.mdc`:

````
---
description: falsegreen-skill — false-positive test detection
globs: **/*.test.ts, **/*.test.tsx, **/*.test.js, **/*.test.jsx, **/*.spec.ts, **/*.spec.tsx, **/*.spec.js, **/*.spec.jsx, **/test_*.py, **/*_test.py, **/*.robot, **/*.resource
alwaysApply: false
---

# falsegreen-skill

A semantic LLM skill for detecting false-positive tests — tests that are always
green regardless of whether the code is correct.

## The one rule

A test is useful only if it fails when the code breaks. Every pattern this skill
looks for is a variation on tests that do not fail: tests that pass while the
code is wrong, tests that check the wrong thing, or tests that borrow correctness
from elsewhere.

## Protocol

Work through these steps in order. Do not skip steps.

### Step 1: Detect language, framework, and level

Identify the language (Python / TypeScript / JavaScript / Robot Framework) and
framework (pytest / unittest / Jest / Vitest / Mocha+Chai / Cypress / Playwright /
Robot). Read the level from signals (the pyramid): unit (boundaries doubled),
integration (real HTTP client or ORM/driver - API and database), or E2E (browser).
Strongest signal wins (markers, paths, file names, `conventions:`). The level
changes the oracle (E2E presence IS the assertion; affects J4/J6); a real API/DB
call in a unit test is itself the smell. The full catalog for TS/JS (24 JS-codes),
Robot (R-codes), and the new Python codes is in `reference.md`. The AI-only
S-codes (S1-S18 and S21) are language-agnostic: run every one of them on every
file, whatever the language, Python included. Their rules and their look-alike
exemptions are in this rule under "Semantic cases" below, so this path needs no
other file. `reference.md` has the same codes as full prose with examples under
`## Patterns only the semantic pass can catch (AI-only)`; read it when a finding
needs the long form. Its per-language sections sit below that section, so a
language-section-only load skips the S-codes.
Report the level in each finding.

### Step 2: For Python — apply the structural pattern catalog

Scan the file against all falsegreen codes before semantic analysis. Apply each
family in order, then report structural findings with code and confidence before
proceeding:

**Family A — test never checks anything**
- C1: assert inside if/for/while that may never run (LOW)
- C2: test body has no assert at all (HIGH) — exemption: @skip, @xfail(strict=True), @given (plain @xfail still runs, XPASS keeps exit 0 — unless xfail_strict=true is set globally in pytest config)
- C2b: calls SUT but no assert follows (LOW)
- C3: assert inside try, except swallows AssertionError/Exception (HIGH)
- C4: test function nested inside another function, never collected (HIGH)
- C4b: TestClass defines __init__, pytest skips it (LOW)
- C20: assert after unconditional return/raise (HIGH)
- C21: every assert is inside a conditional, none runs unconditionally (LOW)
- C22: async test, no await, no loop driver — opt-in only (OFF)
- CC: commented-out assert left in body (LOW)

**Family B — check is weak or always true**
- C5: assert True / assert (x, y) non-empty tuple / assert x or True (HIGH)
- C6: only checks truthiness or len > 0, not the actual value (LOW)
      exemption: web/browser layer — presence IS the assertion
- C6b: mock.call_args.args[computed_index] — fragile positional mock check (LOW)
- C7: assert x == x, identical left and right (HIGH)
      exemption: testing __eq__/__hash__ semantics
- C8: float exact equality with == against non-sentinel literal (LOW)
- C9: pytest.raises(Exception) or pytest.raises() with no match= (LOW)
- C11a: obj.attr = VALUE then assert obj.attr == VALUE same literal (LOW)
- C13: mock assertion method accessed without () — assert_called_once vs assert_called_once_with() (HIGH)
- C13b: @patch without autospec=True or spec= (LOW)
- C14: golden file generated from actual output on first run (LOW)
        exemption: Playwright/Selenium snapshot tests
- C16: uncontrolled time (datetime.now() without freezegun), random without seed, sleep (LOW)
- C18: str(x) == "literal" or repr(x) == "literal" — couples to repr format (LOW)
- C25: @pytest.mark.xfail without strict=True (LOW)
- C34: assert x == True / assert x == None / assert len(x) == 0 suboptimal forms (LOW)

**Family C — test checks its own setup, not the program**
- C19: pytest.raises wraps more than one statement (LOW)
- C28: pytest.raises binding variable exc never read in assertion (LOW)
- C29: os.environ modified directly without monkeypatch (LOW)

**Family D — test depends on external or shared state**
- C17: pytest.skip() inside broad except — hides real failures (HIGH)
- C23: hard-coded absolute or home-relative file path (LOW)
- C24: module-level mutable dict/list/set mutated by test, no reset (LOW)
- C27: try/except/pass wraps SUT call with no assert — always green (HIGH)
- C30: responses.add() or httpretty called but activator absent (LOW)
- C31: capsys.readouterr() result discarded, never asserted (LOW)
- C32: @pytest.mark.skip with no reason= (LOW)
- C35: @flaky / @retry / @rerun decorator masking non-determinism (LOW)

**Family E — passes but checks the wrong thing**
- C33: sklearn metric result assigned but never asserted against threshold (LOW)
- C36: pytest.fail() with no reason argument (LOW)
- C37: @parametrize has duplicate argument set (LOW)

For TypeScript and JavaScript, Robot Framework, and the project layer, apply the
complete emitted code set indexed here, then proceed to Step 3 for the semantic
judgments. Generated from `schema/code-catalog.json` and
`schema/scanner-codes.json`, so it cannot drift. Every code any of the three
scanners can emit has a row, which matters here because this rule is copied into
repositories that have no `reference.md`. Scanner column: `py` falsegreen, `js`
falsegreen-js, `rf` falsegreen-robot. Severity `-` means no fixed severity. The
D-series and M2 are opt-in diagnostics: apply them only when the user asks.

<!-- fg:structural-codes-all:start -->
| Code | Scanner | Severity | What to look for |
|---|---|---|---|
| C1 | py | LOW | Assertion inside conditional or loop that may never run |
| C2 | py/js/rf | HIGH | Test body contains no assertion at all |
| C2b | py/js/rf | LOW | Test calls production code but verifies nothing |
| C2c | py | LOW | Empty `self.subTest(...)` block |
| C3 | py/rf | HIGH | Assert inside try whose except swallows the error |
| C4 | py | HIGH | Test function not collected by pytest |
| C4b | py | LOW | Test class has `__init__` (pytest won't collect it) |
| C5 | py/js/rf | HIGH | Always-true assertion |
| C6 | py/js/rf | LOW | Weak assertion: only checks that something came back |
| C6b | py | LOW | Assertion on positional mock argument via computed index |
| C6c | py | LOW | Mock `call_count` truthiness as the oracle |
| C7 | py/js/rf | HIGH | Self-comparison: both sides are identical |
| C8 | py/js | LOW | Float exact equality |
| C8b | py/js | LOW | Approximate equality with no explicit tolerance |
| C9 | py/js/rf | LOW | pytest.raises too broad |
| C9b | rf | - | RequestsLibrary `expected_status=any` |
| C11a | py/js/rf | LOW | Self-confirming literal: test assigns then asserts the same value |
| C13 | py | HIGH | Mock assertion misspelled or not called |
| C13b | py | LOW | patch() without autospec |
| C14 | py | LOW | Golden file generated from the actual output |
| C16 | py/js/rf | LOW | Result depends on uncontrolled time, randomness, or sleep |
| C17 | py | HIGH | pytest.skip() inside broad except |
| C18 | py/js | LOW | String/repr comparison |
| C19 | py | LOW | pytest.raises wraps more than one call |
| C20 | py/js/rf | HIGH | Assertion after unconditional return/raise/fail |
| C21 | py/js/rf | LOW | Every assertion is inside a conditional; none runs unconditionally |
| C22 | py | OFF | Async test never awaits the unit under test |
| C23 | py/js/rf | LOW | Hard-coded absolute or home-relative file path |
| C24 | py | LOW | Module-level mutable state mutated by test |
| C25 | py | LOW | xfail without strict=True |
| C27 | py | HIGH | try/except/pass around SUT call with no assertion |
| C28 | py | LOW | pytest.raises binding variable never read |
| C29 | py | LOW | os.environ modified directly in test |
| C30 | py | LOW | HTTP mock not activated |
| C31 | py/rf | LOW | capsys.readouterr() result discarded |
| C32 | py/rf | LOW | @pytest.mark.skip without reason |
| C33 | py | LOW | ML metric computed but not asserted |
| C34 | py | LOW | Suboptimal assertion form |
| C35 | py | LOW | Retry/flaky decorator |
| C36 | py | LOW | pytest.fail() without reason |
| C37 | py/js/rf | LOW | Duplicate parametrize case |
| C38 | py | HIGH | Two tests share a name |
| C39 | py | HIGH | Returns a comparison instead of asserting |
| C41 | py | LOW | Assertion on a None-returning mutator |
| C42 | py | HIGH | Assertion on a generator/lambda |
| C43 | py | LOW | Mid-test skip |
| C44 | py/js/rf | HIGH | Numeric tautology |
| C45 | py | HIGH | Empty parametrize |
| C48 | py/js | LOW | Dark patch: flips a test-mode flag then asserts |
| C49 | py | LOW | `pytest.warns`/`assertWarns` wraps more than one call |
| C50 | py | LOW | Captured log never asserted |
| C51 | py | HIGH | Empty-bodied `pytest.raises`/`warns` context |
| C52 | py | LOW | Membership self-confirmation |
| C55 | py | LOW | Assertion compares two mock-rooted values |
| C56 | py | LOW | Sync assert of a never-awaited coroutine |
| C57 | py | LOW | Assertion against an unconfigured Mock attribute |
| C59 | py | HIGH | Bare comparison written as a statement |
| CC | py/js/rf | LOW | Commented-out assert |
| D1 | py/js | LOW | Assertion Roulette: multiple asserts, none with a message |
| D2 | rf | - | Control flow at test level |
| D3 | py/js | LOW | Duplicate Assert: same assertion appears twice |
| D4 | py/js | LOW | Unnamed parametrize cases |
| D5 | py | LOW | Excessive inline setup |
| D6 | py/js | LOW | Debug print in test |
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
| M2 | py/js/rf | LOW | Long test method |
| PL1 | py | - | Asserts stripped at runtime |
| PL2 | py | - | Warnings not promoted |
| PL7 | py/js | - | No coverage gate |
| PL8 | py/js | - | Run stops early |
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
<!-- fg:structural-codes-all:end -->

### Step 3: Classify test intent

Before judging expected values, classify each test:

| Class | Meaning | Oracle |
|---|---|---|
| spec/TDD | the test IS the spec; code must match it | the test itself |
| characterization | intentionally freezes current behavior | current output is the oracle |
| regression | records a known bug fix | the bug report is the oracle |
| behavior | verifies a production rule or contract | spec / docstring / types |

A characterization test is not a false positive even if the expected value looks
wrong. Classify first — misclassifying here causes false alarms.

### Step 4: Apply the six judgments

Judge each test across J1-J6. Flag the first judgment that fails; do not
double-report the same root cause.

**J1 — Does the assertion run?**
Does at least one assertion execute when the test runs normally? Assertions inside
branches that never fire, or after unconditional returns, pass vacuously.

**J2 — Is the expected value from an independent oracle?**
Is the expected value from the spec, API contract, or independent human judgment —
NOT from the current code output? If the test asserts result == current_impl(),
both sides agree on the same wrong number. Re-implementing the production formula
in the test has the same problem.

**J3 — Is the real unit under test?**
Is the test verifying the actual production unit, or a mock of it? Mocking the
function/class under test and asserting on the mock value is not a test of
production code.

**J4 — Does the assertion verify enough, and the right thing?**
Does the assertion check a meaningful property of the result? Checking only that
the result is truthy, or that an exception was raised without verifying its type,
does not protect the behavior being tested.

**J5 — Is the test coupled to implementation internals?**
Does the test fail when internals change - private methods, internal state,
call order - even though the public contract still holds?

**J6 — Does the test pass in isolation?**
Does the test depend on execution order, shared mutable state, or fixtures set up
by a sibling test?

Semantic cases (LLM only). Apply every row, on every file, whatever the language:

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

Look-alike exemptions for the semantic codes. Check these before reporting any
S-code. They override the table above: a pattern listed here is correct code.

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

TypeScript/JavaScript patterns (all HIGH unless noted):
- Conditional test: expect() inside if/switch that may never fire
- Unknown test: it() callback with zero expect() calls
- Swallowed try/catch: exception absorbed, test stays green
- forEach/map over possibly-empty array with expect() inside callback
- Missing return/await on Promise: async test, expect inside .then() never fires
- done() called before assertion in done-callback style
- Literal-vs-literal: expect(true).toBe(true), assert.equal(1, 1)
- var hoisting creating hidden shared state (MEDIUM)
- it.skip / xit left permanently without revisit (MEDIUM)
- expect.assertions(N) guard missing on async test (MEDIUM)

### Step 5: Adversarial verify for case 18

Before reporting case 18:

1. Cite an independent oracle: spec, docstring, type annotation, API contract, or
   domain rule. If you cannot cite one, do not report case 18.
2. Run an adversarial check: assume the expected value is correct and argue why.
   If the argument holds, withdraw the finding.
3. Report only when the oracle clearly contradicts the expected value and the
   adversarial argument does not hold.

Never report case 18 based on pattern-matching alone.

### Step 6: Output the report

For each finding:

```
CASE {number} ({J1-J6}) - {HIGH | LOW} - {language} - {intent}

Test: {function name, line range}
Finding: {one sentence}
Evidence: {the specific line(s)}
Oracle: {case 18 only: cite the independent oracle}
Fix hint: {one sentence}
```

Then a summary:

```
SUMMARY
Tests reviewed: N
Findings: M (H high, L low)
Clean: N-M
```

Precision over recall. Use HIGH only when there is no plausible legitimate
interpretation. A wrong HIGH finding is worse than a missed LOW one.

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
````

---

## Cursor Chat

Open a test file, then open Cursor Chat (`Ctrl+L` on Windows/Linux, `Cmd+L` on Mac).

The rule activates automatically for files matching the globs in the frontmatter.
Type a trigger phrase:

```
analyze this file for false-positive test smells using falsegreen-skill
```

Or more targeted:

```
check test_auth.py for always-green tests
```

Cursor injects the rule context and applies the full J1-J6 protocol. You get a
finding-per-test report with confidence levels and fix hints.

### @file mention

To analyze a specific file without opening it first, use `@file` in chat:

```
@test_billing.py analyze for false-positive smells
```

Or mention the file inline:

```
look at @test_auth.py and @test_payments.py — any false-positive risks?
```

Cursor reads the files and runs the skill across both.

### Folder-level discovery

To analyze an entire test directory, use Composer or ask in Chat:

```
analyze all test files in tests/ for false-positive smells using falsegreen-skill
```

```
check every *.test.tsx file in src/ with the J1-J6 protocol
```

Cursor searches the workspace for matching files. Frontend component tests
(`*.test.tsx`, `*.spec.tsx`, `*.test.jsx`) are included automatically —
React, Vue, and Angular component tests use the same J1-J6 framework as
backend tests.

---

## Composer mode (batch analysis)

Open Composer (`Ctrl+I` on Windows/Linux, `Cmd+I` on Mac) for batch analysis across
a test suite:

```
analyze all test files in tests/ for false-positive smells using falsegreen-skill
```

Cursor reads each file in scope and applies the skill per file. Useful before a
release or after a large refactor. For very large suites (100+ test files), scope
it to a subdirectory or a specific test module.

---

## Model selection

Cursor lets you choose the model per conversation from the model picker in the
chat header.

| Model | When to use |
|---|---|
| `claude-sonnet-5` | Default choice. Best balance of precision and speed for J1-J6. |
| `gpt-5` | Solid alternative. Slightly less precise on case 18. |
| `claude-opus-4-8` | Case 18 deep analysis only. Slower and more expensive. |
| a reasoning-tier model (extended reasoning on) | Case 18 deep analysis when the oracle is ambiguous. |

For routine test reviews, `claude-sonnet-5` or `gpt-5` is enough. Switch to
`claude-opus-4-8` or a reasoning-tier model only when you need to confirm a
suspected case 18 before acting on it. These map to the semantic and adversarial
tiers in [`models.yaml`](../models.yaml), the canonical tier-to-model reference.

---

## Pre-commit workflow

Pair the rule with a Cursor chat habit before committing test changes:

1. Stage your changes.
2. Open Cursor Chat.
3. Type: `review my test changes before commit — check for false-positive smells`.

Cursor picks up the modified test files from context and runs the skill over the
diff. No hook wiring required: it is a manual step, not automated.

For automated structural checks in CI, run the falsegreen Python scanner separately:

```bash
pip install falsegreen
falsegreen tests/
```

The scanner covers all 56 Python structural codes it emits without an LLM. The Cursor
skill covers semantic cases and TypeScript/JavaScript, where no static scanner exists.
