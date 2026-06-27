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

For Python, this skill covers the complete falsegreen catalog (C1-C45, semantic
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
`reference.md` (JS1-JS22, the shared C-codes, and the Robot R-codes), then proceed
to Step 3. The full multi-stack catalog and the AI-only semantic codes (S1-S13)
live in `reference.md`; this file carries the Python catalog inline as the most
common case.

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

## Semantic cases — all three languages and Robot

Semantic cases require LLM judgment. No static rule can detect them. The five
numbered cases below are the core; the AI-only S-series (S1-S13) in `reference.md`
extends them (intent mismatch, irrelevant oracle, plausible-but-wrong expected
value, oracle too coarse to fail, tests the framework not the code, and more).

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
