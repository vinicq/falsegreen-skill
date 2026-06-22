# falsegreen-skill

**LLM-based semantic analysis for false-positive test detection.** This skill
judges whether a test genuinely verifies correct behavior, across Python,
TypeScript, and JavaScript.

For Python, this skill applies the complete falsegreen catalog directly — all
structural and semantic patterns — without requiring the static scanner to run
first. The companion [falsegreen](https://github.com/vinicq/falsegreen) scanner
is a faster batch alternative for Python; results must be consistent with this
skill. For TypeScript and JavaScript, this skill is the primary detection tool.

Invoke by attaching a test file or pasting a test snippet and asking for
false-positive analysis.

---

## The one rule

A test is useful only if it fails when the code breaks. Every pattern this
skill looks for is a variation on tests that do not fail: tests that pass
while the code is wrong, tests that check the wrong thing, or tests that
borrow correctness from elsewhere.

---

## Protocol

Work through these steps in order. Do not skip steps.

### Step 0 (optional): Load project conventions

If the user supplies a `conventions:` block, incorporate it before applying any judgments.
This block declares project-specific context that affects the look-alike rules.

Example:
```
conventions:
  custom_assertion_helpers:
    - conftest.assert_model_valid()   # wraps assert + validation logic
    - helpers.assert_valid_uuid()
  test_layer_overrides:
    - tests/integration/ is web-layer  # apply C6 HTTP exemption here
  excluded_codes:
    - C8   # project uses Decimal, not float
```

The conventions block does NOT disable severity levels. It only extends the look-alike
exemptions in reference.md. HIGH findings that survive after exemptions are still reported as HIGH.

If no conventions block is provided, proceed directly to Step 1.

### Step 1: Detect language and framework

Identify:
- Language: Python / TypeScript / JavaScript
- Test framework: pytest / unittest (Python) · Jest / Vitest / Mocha+Chai (TS/JS)
- Layer context: unit test, integration test, UI/E2E, or web layer test?
  (affects C6 and C14 — see reference.md)

See `reference.md` for framework-detection cues.

### Step 2: Apply the full Python pattern catalog (Python only)

If the language is Python, scan the file against **all** falsegreen patterns
before proceeding to the semantic judgments. These patterns are organized in
`reference.md` under "Python" by family. Apply them in order:

| Family | Codes | What to look for |
|---|---|---|
| A — never checks | C1, C2, C2b, C3, C4, C4b, C20, C21, CC | assertion unreachable, missing, swallowed, or uncollected |
| B — weak/always-true | C5, C6, C6b, C7, C8, C9, C11a, C13, C13b, C14, C16, C18, C25, C34 | tautology, truthiness-only, self-compare, broad exception, string repr |
| C — checks own setup | C19, C28, C29 | pytest.raises wraps too much, binding unread, env mutation |
| D — external state | C17, C23, C24, C27, C30, C31, C32, C35 | skip-on-failure, hard path, shared mutable, try/pass, flaky |
| E — wrong thing | C33, C36, C37 | metric not asserted, fail without reason, duplicate case |
| Optional / diagnostic (opt-in) | C22, D1, D3, D4, D5, D6, M2 | apply only when user requests diagnostic pass |

Report each structural finding with its code number and confidence level before
proceeding to Steps 3-6.

**Relationship with the falsegreen scanner:** if the user has already run
`falsegreen <file>` and provides its output, use that as the structural pass
result and proceed directly to Step 3 for findings the scanner marked as
needing semantic review. If no scanner output is provided, apply Step 2 fully.

For TypeScript and JavaScript, apply the TS/JS catalog below, then proceed to Step 3.

### Step 2b: Apply the TypeScript / JavaScript pattern catalog (TS/JS only)

The companion static scanner for these languages is
[falsegreen-js](https://github.com/vinicq/falsegreen-js). It shares the C-codes
where the smell is the same concept and adds JS-specific codes. Apply the catalog,
then proceed to Step 3 for the semantic judgments no static pass can make.

| Family | Codes | What to look for |
|---|---|---|
| A - never checks | C2, C2b, C21, CC, JS2, JS4, JS6, JS9, JS11 | empty test, no assertion, every assertion conditional, commented-out assertion, `expect()` without a matcher, skipped (`it.skip`/`xit`), empty `describe`, dead literal branch, swallowed `try/catch` |
| B - weak / always-true | C5, C7, C8, C9, C16, C18, JS3 | tautology, self-compare, exact float equality, `toThrow()` with no error type, time/randomness, stringified equality, snapshot-only |
| C - focus / async | JS1, JS5, JS7 | focused test (`it.only`/`fit`), async query/event not awaited, assertion in a non-awaited callback |
| D - duplicate | C37 | duplicate `it.each`/`test.each` case |
| F - query without assert | JS13 | `getBy*`/`queryBy*` query as a loose statement, result never asserted |
| Optional / diagnostic (opt-in) | D1, D3, D4, D6, D7, M2 | maintainability; apply only when the user requests a diagnostic pass |

If the user has run `falsegreen-js <file>` and provides its JSON output, use that as
the structural pass and proceed to Step 3 for findings that need semantic review.
Full TS/JS pattern detail and look-alikes: see `reference.md`.

### Step 3: Classify test intent

Before judging the expected value, classify each test:

| Class | Meaning | Oracle |
|---|---|---|
| **spec/TDD** | the test is the spec; code must match it | the test itself |
| **characterization** | intentionally freezes current behavior | current output is the oracle |
| **regression** | records a known bug fix | the bug report is the oracle |
| **behavior** | verifies a production rule or contract | spec / docstring / types |

A failing TDD test is not a false positive. A labeled characterization
snapshot is not a frozen bug. Misclassifying here causes false alarms.

### Step 4: Apply the six judgments

Judge each test across J1-J6. Flag only the first judgment that fails; do not double-report the same root cause.

**J1: Does the assertion run?**
Does at least one assertion execute when the test is run normally? An
assertion inside a branch that never fires, or after an unconditional return,
passes vacuously.

**J2: Is the expected value from an independent oracle?**
Is the expected value derived from the spec, the API contract, or independent
human judgment, NOT from the current code output? If the test asserts
`result == current_implementation()`, both sides agree on the same wrong
number. An assertion that re-implements the production formula has the same
problem.

**J3: Is the real unit under test?**
Is the test verifying the actual production unit, or a mock of it? Mocking
the function/class under test and then asserting the mock value is not a test
of the production code.

**J4: Does the assertion verify enough, and the right thing?**
Does the assertion check a meaningful property of the result? Checking only
that the result is truthy, or that an exception was raised without verifying
its type, does not protect the behavior being tested.

**J5: Is the test coupled to implementation internals?**
Does the test fail when internals change - private methods, internal state,
call order - even though the public contract still holds?

**J6: Does the test pass in isolation?**
Does the test depend on execution order, shared mutable state, or fixtures set
up by a sibling test? A test that passes only in a specific order is not
reliably testing anything.

### Step 5: Adversarial verify for case 18

Case 18 (expected value contradicts what the code should do) is the highest-
stakes finding: it means the test is freezing a bug as "correct". Before
reporting it:

1. Cite the independent oracle: spec, docstring, type annotation, API
   contract, or domain rule. If you cannot cite one, do not report case 18.
2. Run an adversarial check: assume the expected value is correct and argue
   why. If the argument holds, withdraw the finding.
3. Report only when the oracle clearly contradicts the expected value and the
   adversarial argument does not hold.

Never report case 18 based on gut feeling or pattern-matching alone.

### Step 6: Output the report

For each finding, output:

```
CASE {number} ({J1-J6}) - {confidence: HIGH | LOW} - {language} - {intent: spec|char|regression|behavior}

Test: {function name, line range}
Finding: {one sentence describing what is wrong}
Evidence: {the specific line(s) that triggered this}
Oracle: {for case 18 only: cite the independent oracle}
Fix hint: {one sentence suggestion}
```

Intent is the classification from Step 3. Include it in every finding - it is required for dataset analysis.

Then a summary block:

```
SUMMARY
Tests reviewed: N
Findings: M (H high, L low)
Clean: N-M
```

Use HIGH only when there is no plausible legitimate interpretation.
Precision over recall: a wrong HIGH finding is worse than a missed LOW one.

### Step 7 (optional): Suggest project conventions

Run this step only when the report contains 3 or more findings of the same code or pattern.

Add a note at the end of the SUMMARY block:

```
Pattern note: {code or pattern} appears {N} times. If intentional in this project,
add it to the conventions: block (Step 0) to suppress future findings.
```

Do not run Step 7 for reports with fewer than 3 findings. Do not call a separate model -
append the note to the existing SUMMARY using what you already know from the analysis.

---

## Case reference (quick lookup)

| Case | Judgment | Name | Caught by |
|---|---|---|---|
| 10 | J3 | Mocks the unit under test | Semantic |
| 11 | J2/J3 | Asserts the value fed to the mock | Semantic |
| 12 | J2 | Re-implements the production formula | Semantic |
| 15 | J6 | Passes only if another test ran first | Semantic |
| 18 | J2 | Expected value contradicts what the code should do | Semantic + adversarial verify |

Structural codes are handled by the static scanners - [falsegreen](https://github.com/vinicq/falsegreen)
for Python (C1-C37) and [falsegreen-js](https://github.com/vinicq/falsegreen-js)
for TypeScript/JavaScript (shared C-codes plus JS1-JS13). This skill adjudicates
scanner findings when review is needed, and handles the same patterns directly for
any language. The five semantic cases above need the LLM regardless of language.

Full case catalog with language examples: see `reference.md`.

---

## Precision-first rules

1. Never report a case 18 without citing an independent oracle.
2. If a mock replaces a network/disk/time dependency (an edge), it is NOT
   case 10. Case 10 applies only when the mock replaces the unit being tested.
3. A characterization test is not a bug even if the expected value looks wrong.
   Classify first (Step 3) before judging.
4. A test that uses `assert True` in a `@pytest.mark.skip` block is not C5.
   The skip marker stops it from running.
5. In web/UI layer tests, a truthiness check on a response or locator object
   is NOT case 6. Presence of a response IS the assertion at that layer.

---

## Multi-agent mode (case 18 deep analysis)

For a case 18 finding that requires high confidence (blocking a deploy,
cited in a report), run a two-pass adversarial check:

**Pass 1 (finder):** Identify the expected value and the oracle. Report
the finding with the cited oracle.

**Pass 2 (refuter):** Given the case 18 finding, argue that the expected
value is actually correct. Consider: is this a characterization test? Is the
oracle you cited authoritative for this specific test? Does the domain have
a convention that makes the expected value correct?

If the refuter provides a plausible argument, downgrade to LOW or withdraw.
Report case 18 HIGH only when the refuter cannot mount a credible defense.

---

## What this skill does not do

- It does not suggest code fixes unless asked.
- It does not run the tests.
- It does not analyze production code unless the test snippet includes it.
- It does not flag maintainability smells **by default** (bad names, missing
  messages, Eager Test, Lazy Test, long tests). Those are not false-positive risks.
  They are available as an **opt-in diagnostic pass** (codes D1/D3/D4/D5/D6/D7/M2),
  applied only when the user asks for it - mirroring the diagnostic/coupling group
  in falsegreen and falsegreen-js. For a dedicated linter layer, `ruff`'s `PT` rules
  (Python) or eslint-plugin-jest (JS/TS) also cover this ground.
