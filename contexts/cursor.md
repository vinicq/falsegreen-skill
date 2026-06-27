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
globs: ["**/*.test.ts", "**/*.test.tsx", "**/*.test.js", "**/*.test.jsx", "**/*.spec.ts", "**/*.spec.tsx", "**/*.spec.js", "**/*.spec.jsx", "**/test_*.py", "**/*_test.py", "**/*.robot", "**/*.resource"]
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
call in a unit test is itself the smell. The full catalog for TS/JS (JS1-JS22),
Robot (R-codes), the new Python codes, and the AI-only S-codes is in `reference.md`.
Report the level in each finding.

### Step 2: For Python — apply the structural pattern catalog

Scan the file against all falsegreen codes before semantic analysis. Apply each
family in order, then report structural findings with code and confidence before
proceeding:

**Family A — test never checks anything**
- C1: assert inside if/for/while that may never run (LOW)
- C2: test body has no assert at all (HIGH) — exemption: @skip, @xfail(strict=True), @given (plain @xfail still runs, XPASS keeps exit 0)
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

For TypeScript and JavaScript, apply the falsegreen-js code set (shared C-codes
plus JS1-JS13; see reference.md), then proceed to Step 3 for the semantic judgments.

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

Semantic cases (LLM only):
- Case 10 (J3, HIGH): mocks the unit under test, asserts the mock value
- Case 11 (J2/J3, HIGH): stubs a dependency to return X, then asserts result == X — echo
- Case 12 (J2, HIGH): expected computed using the same formula as the SUT
- Case 15 (J6, HIGH): reads shared mutable state written by a sibling test
- Case 18 (J2, HIGH): expected value contradicts what the code should do — frozen bug

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
   it from running (skip) or fails it on XPASS (strict xfail). Plain
   `@pytest.mark.xfail` is NOT exempt: a non-strict xfail still executes and an
   XPASS keeps exit status 0, so a no-assertion test stays false-green.
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
| `claude-sonnet-4-6` | Default choice. Best balance of precision and speed for J1-J6. |
| `gpt-4o` | Solid alternative. Slightly less precise on case 18. |
| `claude-opus-4-8` | Case 18 deep analysis only. Slower and more expensive. |
| `o3` | Case 18 deep analysis with extended reasoning. Use when the oracle is ambiguous. |

For routine test reviews, `claude-sonnet-4-6` or `gpt-4o` is enough. Switch to
`claude-opus-4-8` or `o3` only when you need to confirm a suspected case 18 before
acting on it.

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

The scanner covers all Python structural codes (C1-C45) without an LLM. The Cursor
skill covers semantic cases and TypeScript/JavaScript, where no static scanner exists.
