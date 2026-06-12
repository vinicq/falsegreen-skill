# falsegreen-skill

LLM-based semantic analysis for false-positive test detection. This skill
judges whether a test genuinely verifies correct behavior, across Python,
TypeScript, and JavaScript.

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

---

## Protocol (compact)

Work through these steps in order.

### Step 1: Detect language and framework

Identify the language (Python / TypeScript / JavaScript), the test framework
(pytest / unittest / Jest / Vitest / Mocha+Chai), and the layer context (unit,
integration, UI/E2E, web layer). Layer affects C6 and C14 exemptions.

### Step 2: Apply the Python structural catalog (Python only)

Scan against all falsegreen pattern families in order:

| Family | Codes | What to look for |
|---|---|---|
| A - never checks | C1, C2, C2b, C3, C4, C4b, C20, C21, CC | assertion unreachable, missing, swallowed, or uncollected |
| B - weak/always-true | C5, C6, C6b, C7, C8, C9, C11a, C13, C13b, C14, C16, C18, C25, C34 | tautology, truthiness-only, self-compare, broad exception, string repr |
| C - checks own setup | C19, C28, C29 | pytest.raises wraps too much, binding unread, env mutation |
| D - external state | C17, C23, C24, C27, C30, C31, C32, C35 | skip-on-failure, hard path, shared mutable, try/pass, flaky |
| E - wrong thing | C33, C36, C37 | metric not asserted, fail without reason, duplicate case |
| Optional / diagnostic (opt-in) | C22, D1, D3, D4, D5, D6, M2 | apply only when user requests |

Report each structural finding before proceeding to Steps 3-6.

For TypeScript and JavaScript, skip to Step 3.

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
CASE {number} ({J-code}) - {HIGH|LOW} - {language} - {intent}

Test: {function name, line range}
Finding: {one sentence describing what is wrong}
Evidence: {the specific line(s) that triggered this}
Oracle: {for case 18 only: cite the independent oracle}
Fix hint: {one sentence suggestion}
```

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

| Case | Judgment | Name | Rule |
|---|---|---|---|
| 10 | J3 | Mocks the unit under test | Patches/mocks the function being tested, then asserts on the mock's value |
| 11 | J2/J3 | Asserts the value fed to the mock | Stubs dependency to return X, then asserts result == X with no real logic in between |
| 12 | J2 | Re-implements the production formula | Expected value computed with the same formula as the SUT; both sides agree on the same wrong answer |
| 15 | J6 | Passes only if another test ran first | Reads shared mutable state written by a sibling test; fails when run alone |
| 18 | J2 | Expected value contradicts the spec | Asserts a value the independent oracle says is wrong; requires cited oracle before reporting |

Cases from the structural families (C1-C37, CC) apply to Python directly.
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

1. Never report case 18 without citing an independent oracle.
2. If a mock replaces a network/disk/time dependency (an edge), it is NOT
   case 10. Case 10 applies only when the mock replaces the unit being tested.
3. A characterization test is not a bug even if the expected value looks wrong.
   Classify first (Step 3) before judging.
4. A test under `@pytest.mark.skip` with an empty body is not C2.
5. In web/UI layer tests, a truthiness check on a response or locator object
   is NOT case 6. Presence of a response IS the assertion at that layer.

---

## Reference files

- `SKILL.md` - complete protocol with all steps, edge cases, and multi-agent mode
- `reference.md` - full case catalog with per-language patterns and look-alike exemptions
- `contexts/codex.md` - OpenAI API integration, structured output, batch processing
- `schema/report.json` - JSON schema for structured output reports
