# falsegreen-skill for Gemini

LLM-based semantic analysis for false-positive test detection. This skill
judges whether a test genuinely verifies correct behavior, across Python,
TypeScript, and JavaScript.

Full protocol: `SKILL.md`. Language patterns: `reference.md`.
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

**Step 1: Detect language and framework.**
Identify: Python / TypeScript / JavaScript; pytest / unittest / Jest / Vitest /
Mocha+Chai; unit / integration / web / E2E layer context.

**Step 2: Python structural pass.**
If Python, scan against all falsegreen families before semantic judgment:

| Family | Codes | What to look for |
|---|---|---|
| A - never checks | C1, C2, C2b, C3, C4, C4b, C20, C21, CC | assertion unreachable, missing, swallowed, or uncollected |
| B - weak/always-true | C5, C6, C6b, C7, C8, C9, C11a, C13, C13b, C14, C16, C18, C25, C34 | tautology, truthiness-only, self-compare, broad exception, string repr |
| C - checks own setup | C19, C28, C29 | pytest.raises wraps too much, binding unread, env mutation |
| D - external state | C17, C23, C24, C27, C30, C31, C32, C35 | skip-on-failure, hard path, shared mutable, try/pass, flaky |
| E - wrong thing | C33, C36, C37 | metric not asserted, fail without reason, duplicate case |
| Optional / diagnostic (opt-in) | C22, D1, D3, D4, D5, D6, M2 | apply only when user requests |

For TypeScript/JavaScript, skip to Step 3.

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

| Case | Judgment | Name | Rule |
|---|---|---|---|
| 10 | J3 | Mocks the unit under test | Patches/mocks the function being tested, then asserts on the mock's return value |
| 11 | J2/J3 | Asserts the value fed to the mock | Stubs dependency to return X, then asserts result == X with no real logic in between |
| 12 | J2 | Re-implements the production formula | Expected value computed using the same formula as the SUT; both sides agree on the same wrong answer |
| 15 | J6 | Passes only if another test ran first | Reads shared mutable state written by a sibling test; fails when run alone |
| 18 | J2 | Expected value contradicts what the code should do | Asserts a value the independent oracle says is wrong; requires cited oracle before reporting |

---

## Precision-first rules

1. Never report case 18 without citing an independent oracle.
2. A mock replacing a network/disk/time dependency is NOT case 10. Case 10
   applies only when the mock replaces the unit being tested.
3. A characterization test is not a bug even if the expected value looks wrong.
   Classify first (Step 3) before judging.
4. In web/UI layer tests, a truthiness check on a response or locator object
   is NOT case 6. Presence of a response IS the assertion at that layer.
5. A test decorated with `@pytest.mark.skip`, `@pytest.mark.xfail`, or
   `@unittest.skip` that has no assertion body is NOT C2. The skip marker
   stops it from running.
6. Tests decorated with `@given`, `@hypothesis`, or `@fuzz` that have no
   explicit `assert` are NOT C2. These frameworks generate and check
   assertions internally.

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

HIGH only when there is no plausible legitimate interpretation. Precision over
recall: a wrong HIGH is worse than a missed LOW.
