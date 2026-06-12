---
name: falsegreen-llm
description: Analyze test files for false-positive smells, meaning tests that pass even when the code breaks. Use when the user asks to review tests for false positives, weak assertions, mock misuse, test smells, or asks whether a test can actually fail. Covers Python (pytest, unittest), TypeScript, and JavaScript (Jest, Vitest, Mocha).
---

# falsegreen-llm: false-positive test detection

This skill is a thin entry point. The canonical protocol lives at the plugin
root. Read these files before judging any test:

1. `SKILL.md` at the plugin root (relative to this file: `../../SKILL.md`).
   It defines Steps 0-7 and the six
   judgments J1-J6.
2. `reference.md` at the plugin root: the per-language pattern catalog with
   look-alike exemptions. Consult it before flagging anything as HIGH.

## Protocol in one paragraph

A test is useful only if it fails when the code breaks. Detect the language and
framework, classify the test intent (spec, characterization, regression,
behavior), then apply the six judgments: J1 does the assertion run, J2 is the
expected value from an independent oracle, J3 is the real unit under test, J4
does the assertion verify enough, J5 is the test coupled to implementation
internals, J6 does the test pass in isolation. For Python, also run the full
structural catalog (families A-E, codes C1-C37). Flag only the first failing
judgment per test.

## Non-negotiable rules

- Never report case 18 (expected value contradicts the spec) without citing an
  independent oracle, and always run the adversarial verify pass first.
- Precision over recall: a wrong HIGH finding is worse than a missed LOW one.
- Check the look-alike exemptions in `reference.md` before flagging.

## Output

Use the CASE / SUMMARY format defined in the root `SKILL.md` Step 6:

```
CASE {number} ({J-code}) - {HIGH|LOW} - {language} - {intent}
Test / Finding / Evidence / Oracle (case 18 only) / Fix hint
```
