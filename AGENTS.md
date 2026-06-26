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
| A - never checks | C1, C2, C2b, C3, C4, C4b, C20, C21, C38, C39, C43, C45, CC | assertion unreachable, missing, swallowed, uncollected, name-shadowed, returned-not-asserted, mid-test skip, empty parametrize |
| B - weak/always-true | C5, C6, C6b, C7, C8, C9, C11a, C13, C13b, C14, C16, C18, C25, C34, C42, C44 | tautology, truthiness-only, self-compare, broad exception, string repr, generator/lambda truthy, numeric tautology |
| C - checks own setup | C19, C28, C29 | pytest.raises wraps too much, binding unread, env mutation |
| D - external state | C17, C23, C24, C27, C30, C31, C32, C35 | skip-on-failure, hard path, shared mutable, try/pass, flaky |
| E - wrong thing | C33, C36, C37, C41 | metric not asserted, fail without reason, duplicate case, None-returning mutator |
| Optional / diagnostic (opt-in) | C22, D1, D3, D4, D5, D6, M2 | apply only when user requests |

Report each structural finding before proceeding to Steps 3-6.

For TypeScript / JavaScript (JS1-JS22) and Robot Framework (R-codes), apply their
catalogs from `reference.md`, then proceed to Step 3.

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

<!-- fg:semantic-cases-compact:start -->
| Case | Judgment | Name | Rule |
|---|---|---|---|
| 10 | J3 | Mocks the unit under test | Patches/mocks the function being tested, then asserts on the mock's return value |
| 11 | J2/J3 | Asserts the value fed to the mock | Stubs dependency to return X, then asserts result == X with no real logic in between |
| 12 | J2 | Re-implements the production formula | Expected value computed with the same formula as the SUT; both sides agree on the same wrong answer |
| 15 | J6 | Passes only if another test ran first | Reads shared mutable state written by a sibling test; fails when run alone |
| 18 | J2 | Expected value contradicts what the code should do | Asserts a value the independent oracle says is wrong; requires cited oracle before reporting |
<!-- fg:semantic-cases-compact:end -->

Cases from the structural families (C1-C45, CC) apply to Python directly.
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
4. A test decorated with `@pytest.mark.skip`, `@pytest.mark.xfail`, or
   `@unittest.skip` that has no assertion body is NOT C2/C5. The skip marker
   stops it from running.
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
