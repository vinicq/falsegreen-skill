# falsegreen-skill

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**LLM-based semantic analysis for false-positive test detection.** Companion
to [falsegreen](https://github.com/vinicq/falsegreen), the Python static
scanner.

falsegreen catches mechanical false-positive patterns at commit time. This
skill handles the cases a parser cannot see: mocking the unit under test,
asserting the value fed to the mock, re-implementing the production formula,
tests that freeze a bug as "correct". It also covers every language the Python
scanner does not: TypeScript, JavaScript, Java, C#, PHP, Ruby, and C++.

---

## What it catches

The same 18-case catalog as falsegreen, applied semantically:

| Case | What is wrong | Judgment |
|---|---|---|
| 10 | The test mocks the unit under test | J3 |
| 11 | The assertion checks the value fed to the mock, not a real result | J2/J3 |
| 12 | The test re-implements the production formula as its expected value | J2 |
| 15 | The test passes only because a sibling test ran first | J6 |
| 18 | The expected value contradicts what the code is supposed to do | J2 |

For non-Python code, the skill also handles the structural cases (1-9,
13-14, 16-17, 19-22) that the Python scanner covers deterministically.

---

## How to use

Install [Claude Code](https://github.com/anthropics/claude-code), then invoke
the skill inside a session:

```
/falsegreen-skill
```

Attach a test file or paste a snippet. The skill identifies the language and
framework, classifies the test intent, applies the six-judgment protocol, and
reports findings with case numbers, confidence levels, and fix hints.

For Python, run the static scanner first:

```bash
pip install falsegreen
falsegreen tests/
```

Then use this skill for the findings the scanner flags as needing semantic
review, and for the semantic-only cases (10/11/12/15/18).

---

## Supported languages and frameworks

| Language | Frameworks |
|---|---|
| Python | pytest, unittest |
| TypeScript | Jest, Vitest, Mocha + Chai |
| JavaScript | Jest, Vitest, Mocha + Chai, Jasmine |
| Java | JUnit 4, JUnit 5, TestNG |
| C# | NUnit, xUnit.net, MSTest |
| PHP | PHPUnit |
| Ruby | RSpec, Minitest |
| C++ | GoogleTest, Catch2, Boost.Test |

---

## The methodology

One rule sits under everything: a test is useful only if it fails when the
code breaks. The six-judgment framework (J1-J6) structures the analysis:

- **J1:** Does the assertion run?
- **J2:** Is the expected value from an independent oracle?
- **J3:** Is the real unit under test (not a mock of it)?
- **J4:** Does the assertion verify enough?
- **J5:** Is the test coupled to implementation internals?
- **J6:** Does the test pass in isolation?

The methodology and its research basis are documented in
[falsegreen CREDITS.md](https://github.com/vinicq/falsegreen/blob/main/CREDITS.md)
and in this repo's [CREDITS.md](CREDITS.md).

---

## Precision over recall

A finding that wrongly flags a legitimate test is worse than a missed
finding. The skill applies the same guardrail as the scanner:

- Case 18 requires a cited independent oracle: spec, docstring, API contract.
  No oracle, no finding.
- An adversarial verification pass runs on every case 18 HIGH finding.
- Characterization tests (intentionally freezing current behavior) are not
  false positives.
- In web/UI layer tests, a truthiness check on a response or locator object
  is not a weak assertion.

Full protocol: [SKILL.md](SKILL.md).

---

## Project layout

```
falsegreen-skill/
  SKILL.md          the skill protocol loaded by Claude Code
  reference.md      per-language case catalog and framework cues
  CREDITS.md        the research this skill builds on
  examples/         test snippets per language (bad and clean)
    python/
    typescript/
    javascript/
    java/
    csharp/
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). The main contribution paths are
language-specific patterns and look-alike examples in `reference.md`.

License: **MIT**, see [LICENSE](LICENSE).
