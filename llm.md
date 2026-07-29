# falsegreen-skill — self-contained prompt context

> **Role of this file.** `llm.md` is the self-contained protocol: paste it whole
> into a system prompt or a plain chat and it works with no other file. The host
> guides in `contexts/` (claude, codex, gemini, cursor) are the opposite - thin
> per-host invocation instructions that point back at the canonical protocol.
> Use this file when you need the protocol inline; use `contexts/` when you need
> to wire the skill into a specific tool.

**LLM skill for false-positive test detection.** Applies the J1-J6 judgment
framework across Python, TypeScript, JavaScript, and Robot Framework, plus
semantic patterns no static tool can see.

For Python, this skill covers the complete falsegreen catalog (56 C-codes, semantic
cases, diagnostic codes) without requiring the static scanner to run first. For
TypeScript, JavaScript, and Robot Framework it is the primary detection tool, and
a superset of the three static scanners.

Invoke by attaching a test file and asking for false-positive analysis.

**Two intents, one skill.** Same J1-J6 and catalog, two directions: *review* an
existing test (the Protocol below) or *create* one. To author: ask the user for
level (unit / integration / e2e), language, and the behavior + independent oracle;
build one neutral spec per level; render it in the requested language with the
level's oracle (unit = return value; integration = status + body / row; e2e =
visible state); then **run this same Protocol on your generated test and revise
until it reports nothing**. A generated test must pass its own review.

---

## The one rule

A test is useful only if it fails when the code breaks. Every pattern this skill
looks for is a variation on tests that do not fail: tests that pass while the
code is wrong, tests that check the wrong thing, or tests that borrow
correctness from elsewhere.

---

## Protocol (Steps 0-7)

Work through these steps in order.

### Step 0 (optional): Load project conventions

If the user supplies a `conventions:` block, incorporate it before applying any
judgments.

```
conventions:
  custom_assertion_helpers:
    - conftest.assert_model_valid()
  test_layer_overrides:
    - tests/integration/ is web-layer
  excluded_codes:
    - C8
```

Conventions extend look-alike exemptions but do not disable severity levels.
HIGH findings that survive exemptions are still reported as HIGH.

### Step 1: Detect language, framework, and level

- Language: Python / TypeScript / JavaScript / Robot Framework
- Framework: pytest / unittest (Python), Jest / Vitest / Mocha+Chai / Cypress / Playwright
  (TS/JS), Robot Framework (`.robot`/`.resource`)
- Level — read it from signals, do not guess (the pyramid):
  - **Unit:** boundaries doubled (`unittest.mock`, `jest.mock`, `vi.mock`); SUT called directly.
  - **Integration / API:** HTTP client (`requests`/`httpx`, `TestClient`, supertest
    `request(app)`, RequestsLibrary/RESTinstance); asserts status/body.
  - **Integration / database:** real ORM/driver (SQLAlchemy, Django ORM, Prisma, TypeORM,
    Knex, psycopg, DatabaseLibrary); session/transaction/testcontainer.
  - **E2E:** browser (Playwright `page.`, Cypress `cy.`, Selenium `driver.`, Robot Browser).
  - Strongest signal wins: markers (`@pytest.mark.integration`/`e2e`), paths
    (`tests/unit|integration|e2e`, `cypress/`), file names (`.e2e.`, `.cy.`), `conventions:`.
  The level changes the oracle: in E2E/UI the presence of a page/element IS the assertion
  (affects C6/C14). A real API/DB call inside a *unit* test is itself the smell (J3/J6).

Python cues: `import pytest`, `import unittest`, `@pytest.mark.*`, `@patch`
TS/JS cues: `describe()`, `it()`, `test()`, `expect()`, `jest.fn()`, `vi.fn()`
Robot cues: `*** Test Cases ***` / `*** Keywords ***`, `Should *` keywords, `.robot`/`.resource`

### Step 2: Apply the full Python pattern catalog (Python only)

Scan against all falsegreen patterns organized by family:

| Family | Codes | What to look for |
|---|---|---|
| A — never checks | C1, C2, C2b, C3, C4, C4b, C20, C21, C38, C39, C43, C45, CC | assertion unreachable, missing, swallowed, uncollected, name-shadowed, returned-not-asserted, skipped mid-test, empty parametrize |
| B — weak/always-true | C5, C6, C6b, C7, C8, C9, C11a, C13, C13b, C14, C16, C18, C25, C34, C42, C44 | tautology, truthiness-only, self-compare, broad exception, string repr, generator/lambda truthy, numeric tautology |
| C — checks own setup | C19, C28, C29 | pytest.raises wraps too much, binding unread, env mutation |
| D — external state | C17, C23, C24, C27, C30, C31, C32, C35 | skip-on-failure, hard path, shared mutable, try/pass, flaky |
| E — wrong thing | C33, C36, C37, C41 | metric not asserted, fail without reason, duplicate case, None-returning mutator |
| Optional / diagnostic (opt-in) | C22, D1, D3, D4, D5, D6, M2 | apply only when user requests diagnostic pass |

Report each structural finding with code number and confidence before Step 3.

If the user provides existing `falsegreen` scanner output, use it as the
structural pass result and proceed directly to Step 3.

For TypeScript / JavaScript and Robot Framework, apply their catalogs from
`reference.md` (24 JS-codes, the shared C-codes, and 9 Robot R-codes), then proceed
to Step 3. The full multi-stack catalog lives in `reference.md`; this file carries
the Python catalog inline as the most common case.

The AI-only semantic codes (S1-S18 and S21) are language-agnostic and apply to every
language, Python included. They sit in `reference.md` under
`## Patterns only the semantic pass can catch (AI-only)`, above the per-language
sections, so loading a language section alone skips them. Load that section as
well, or the compact table in `fragments/semantic-cases-compact.md`, which carries
a row for every S-code. Read the "Look-alikes - do NOT flag" paragraph that closes
the section before reporting any S-code. Not only the HIGH ones: S15, S16, S18 and
S21 are LOW by definition, and their exemptions are what separate a sanctioned
async settle, an interaction contract, a valid stub value and a deterministic judge
from a false-green test.

### Step 3: Classify test intent

| Class | Meaning | Oracle |
|---|---|---|
| spec/TDD | the test is the spec; code must match it | the test itself |
| characterization | intentionally freezes current behavior | current output |
| regression | records a known bug fix | the bug report |
| behavior | verifies a production rule or contract | spec / docstring |

A failing TDD test is not a false positive. A labeled characterization snapshot
is not a frozen bug. Classify before judging.

### Step 4: Apply the six judgments (J1-J6)

Judge each test across all six questions. Flag only the first judgment that
fails; do not double-report the same root cause.

**J1: Does the assertion run?**
Does at least one assertion execute when the test is run normally? An assertion
inside a branch that never fires, or after an unconditional return, passes
vacuously.

**J2: Is the expected value from an independent oracle?**
Is the expected value derived from the spec, API contract, or independent human
judgment, NOT from the current code output? If the test asserts
`result == current_implementation()`, both sides agree on the same wrong number.
An assertion that re-implements the production formula has the same problem.

**J3: Is the real unit under test?**
Is the test verifying the actual production unit, or a mock of it? Mocking the
function/class under test and then asserting the mock value is not a test of
the production code.

**J4: Does the assertion verify enough, and the right thing?**
Does the assertion check a meaningful property of the result? Checking only that
the result is truthy, or that an exception was raised without verifying its
type, does not protect the behavior being tested.

**J5: Is the test coupled to implementation internals?**
Does the test fail when internals change - private methods, internal state,
call order - even though the public contract still holds?

**J6: Does the test pass in isolation?**
Does the test depend on execution order, shared mutable state, or fixtures set
up by a sibling test? A test that passes only in a specific order is not
reliably testing anything.

**Then screen every S-code, on every file, whatever the language.** S1-S18 and
S21 are part of this step, not a preamble to it: walk the semantic-cases table
below row by row, check each candidate against the look-alike exemptions that
follow it, then move on. Step 4 is not complete until every S-code has been
considered. The S-series is not scoped to Step 2, so a non-Python run still runs
it in full. Everything this step needs is in this file.

### Step 5: Adversarial verify for case 18

Case 18 (expected value contradicts what the code should do) is the highest-
stakes finding. Before reporting:

1. Cite the independent oracle: spec, docstring, type annotation, API contract,
   or domain rule. If you cannot cite one, do not report case 18.
2. Run an adversarial check: assume the expected value is correct and argue why.
   If the argument holds, withdraw the finding.
3. Report only when the oracle clearly contradicts the expected value and the
   adversarial argument does not hold.

Never report case 18 based on pattern-matching alone.

### Step 6: Output the report

For each finding:

```
CASE {number} ({J1-J6}) - {HIGH|LOW} - {language} - {level: unit|integration|e2e} - {intent: spec|char|regression|behavior}

Test: {function name, line range}
Finding: {one sentence describing what is wrong}
Evidence: {the specific line(s) that triggered this}
Oracle: {for case 18 only: cite the independent oracle}
Fix hint: {where and how to improve the code or test, one sentence}
```

Then a summary block (the status report):

```
SUMMARY
Tests reviewed: N
Findings: M (H high, L low)   by level: unit U / integration I / e2e E
Clean: N-M
Top fixes: the HIGH findings, each with its code and one-line remediation
```

Use HIGH only when there is no plausible legitimate interpretation.
Precision over recall: a wrong HIGH finding is worse than a missed LOW one.

### Step 7 (optional): Suggest project conventions

Run only when the report contains 3 or more findings of the same code or
pattern. Append a note to the SUMMARY block:

```
Pattern note: {code or pattern} appears {N} times. If intentional in this
project, add it to the conventions: block (Step 0) to suppress future findings.
```

---

## Python structural patterns — all families

### Family A — test never checks anything

| Code | Pattern | Confidence |
|---|---|---|
| C1 | Assert inside `if`/`for` that may not run | LOW |
| C2 | No assertion at all in the test body | HIGH |
| C2b | Calls SUT but discards the result | LOW |
| C3 | Assert inside `try` whose `except` swallows it | HIGH |
| C4 | Test function nested inside another function (pytest skips it) | HIGH |
| C4b | Test class with `__init__` (pytest skips it) | LOW |
| C20 | Assertion after unconditional `return`/`raise` | HIGH |
| C21 | Every assertion is inside a conditional; none runs unconditionally | LOW |
| C38 | Two tests share a name; the later silently overrides the first | HIGH |
| C39 | Test `return`s a comparison instead of asserting it | HIGH |
| C43 | `pytest.skip()` after test logic, with checks below it | LOW |
| C45 | Empty `@pytest.mark.parametrize` list (zero cases) | HIGH |
| CC | Commented-out assertion | LOW |

### Family B — check is weak or always true

| Code | Pattern | Confidence |
|---|---|---|
| C5 | Always-true assertion: `assert True`, `assert (a, b)` | HIGH |
| C6 | Truthiness / `len > 0` / substring in `str()` only | LOW |
| C6b | Positional mock arg via computed index | LOW |
| C7 | Self-comparison: `assert name == name` | HIGH |
| C8 | Exact float equality | LOW |
| C9 | `pytest.raises` too broad or no `match=` | LOW |
| C11a | Self-confirming literal: assigns then asserts same value | LOW |
| C13 | Mock assertion misspelled or missing `()` | HIGH |
| C13b | `@patch` without `autospec=True` | LOW |
| C14 | Golden file written from actual output (first run) | LOW |
| C16 | Depends on uncontrolled time, randomness, or `sleep` | LOW |
| C18 | `str()`/`repr()` comparison | LOW |
| C25 | `@pytest.mark.xfail` without `strict=True` | LOW |
| C34 | Suboptimal assertion form: `== True`, `== None`, `not x in y` | LOW |
| C42 | Assert on a generator expression / lambda (always truthy) | HIGH |
| C44 | Numeric tautology: `len(x) >= 0`, `abs(x) >= 0` | HIGH |

### Family C — test checks its own setup

| Code | Pattern | Confidence |
|---|---|---|
| C19 | `pytest.raises` wraps more than one call | LOW |
| C28 | `pytest.raises` binding variable never read | LOW |
| C29 | `os.environ` mutated directly without `monkeypatch` | LOW |

### Family D — green depends on external or shared state

| Code | Pattern | Confidence |
|---|---|---|
| C17 | `pytest.skip()` inside broad `except` | HIGH |
| C23 | Hard-coded absolute or home-relative path | LOW |
| C24 | Module-level mutable state mutated by test, no reset | LOW |
| C27 | `try/except/pass` around SUT call with no assertion | HIGH |
| C30 | HTTP mock registered but activator absent | LOW |
| C31 | `capsys.readouterr()` result discarded | LOW |
| C32 | `@pytest.mark.skip` without `reason=` | LOW |
| C35 | `@pytest.mark.flaky` / retry decorator | LOW |

### Family E — passes but checks the wrong thing

| Code | Pattern | Confidence |
|---|---|---|
| C33 | ML metric computed but never asserted | LOW |
| C36 | `pytest.fail()` without reason | LOW |
| C37 | Duplicate case in `@pytest.mark.parametrize` | LOW |
| C41 | Assert on a None-returning mutator (`assert not lst.sort()`) | LOW |

---

## Structural code index (all three scanners)

Generated from `schema/code-catalog.json` and `schema/scanner-codes.json`, so it
cannot drift. Every code any of the three scanners can emit has a row, which is
what lets this file be pasted on its own. Scanner column: `py` falsegreen, `js`
falsegreen-js, `rf` falsegreen-robot. Severity `-` means no fixed severity.
Diagnostic codes (D-series, M2) are opt-in: apply them only when asked.

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

## Semantic cases — all three languages and Robot

Semantic cases require LLM judgment. No static rule can detect them. The table
below is complete: the five numbered cases plus every AI-only S-code (S1-S18 and
S21). Nothing here needs `reference.md`.

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

| Case | Judgment | Name |
|---|---|---|
| 10 | J3 | Mocks the unit under test — asserts on the mock's return value |
| 11 | J2/J3 | Asserts the value fed to the mock (echo) |
| 12 | J2 | Re-implements the production formula as the expected value |
| 15 | J6 | Passes only when another test ran first |
| 18 | J2 | Expected value contradicts what the code should do (freezes a bug) |

**Case 10:** The mock target is the same symbol as the function being called in
the assertion. The test does not call the real implementation.

**Case 11:** Pattern is `stub.return_value = X; assert sut.method() == X`. The
result passes through no production logic.

**Case 12:** The test computes the expected value using the same formula as
production code. Both sides agree on the same wrong answer.

**Case 15:** A module-level or class-level variable is modified in one test and
read in another with no reset between them.

**Case 18:** The test asserts an expected value that contradicts the
specification, documented contract, or domain rule. Requires independent oracle.

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

## Output schema summary

Every finding has these fields:

- `case`: number (e.g., `10`, `18`, `C3`)
- `judgment`: J1-J6
- `confidence`: HIGH or LOW
- `language`: Python / TypeScript / JavaScript
- `intent`: spec / char / regression / behavior
- `test`: function name and line range
- `finding`: one sentence describing the problem
- `evidence`: the specific lines that triggered the finding
- `oracle`: cited source, required only for semantic case `18`; structural code
  `C18` is the `str()`/`repr()` comparison smell and does not require `oracle`
- `fix_hint`: one sentence suggestion

For machine-readable output, see `schema/report.json`.

---

## What this skill does not do

- It does not suggest code fixes unless asked.
- It does not run the tests.
- It does not analyze production code unless the test snippet includes it.
- It does not flag maintainability smells by default (bad names, missing messages,
  Eager Test, Lazy Test, long tests). They are an opt-in diagnostic pass
  (D1/D3/D4/D5/D6/D7/M2), applied only when asked. `ruff`'s `PT` rules (Python) or
  eslint-plugin-jest (JS/TS) also cover that layer.

---

## References

- `reference.md` — full per-language pattern catalog with examples and look-alike
  exemptions for Python, TypeScript, JavaScript, and Robot Framework, plus the
  AI-only semantic codes (S-series)
- `contexts/claude.md`, `contexts/codex.md`, `contexts/gemini.md` — maintained
  provider-specific API and host guides
- `contexts/cursor.md` — Cursor rule template
- `schema/finding.json` — JSON Schema for a single finding (structured output)
- `schema/report.json` — JSON Schema for a full analysis report
- `SKILL.md` — canonical protocol (this file is a self-contained copy)
