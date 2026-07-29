---
name: falsegreen-skill
description: Analyze test files for false-positive smells, meaning tests that pass even when the code breaks. Use when the user asks to review tests for false positives, weak assertions, mock misuse, test smells, or asks whether a test can actually fail. Covers Python (pytest, unittest), TypeScript, JavaScript (Jest, Vitest, Mocha), and Robot Framework.
---

# falsegreen-skill: false-positive test detection

This skill is a thin entry point. The canonical protocol lives at the plugin
root. Read these files before judging any test:

1. `SKILL.md` at the plugin root (relative to this file: `../../SKILL.md`).
   It defines Steps 0-7 and the six
   judgments J1-J6.
2. `reference.md` at the plugin root: the per-language pattern catalog with
   look-alike exemptions.

**Mandatory for every language, Python included: load the semantic catalog.** The
S-series (S1-S18, S21) is language-agnostic and lives in `reference.md` under
`## Patterns only the semantic pass can catch (AI-only)`, above the per-language
sections. The root `SKILL.md` names only S3 and S17, so a run that loads a
language section alone never sees the rest. Read that section of `reference.md`,
or read the compact table in `fragments/semantic-cases-compact.md`, which carries
a row for every S-code. Either way you also need the exemptions, in
`fragments/semantic-exemptions.md` or in the "Look-alikes - do NOT flag"
paragraph that closes the same `reference.md` section: the S-series without its
exemptions produces false positives, which this skill treats as worse than a
miss.

**Mandatory for any non-Python file (JavaScript, TypeScript, Robot Framework,
Gherkin, Tavern): also read the matching language section of `reference.md` before
you judge.** The tables in the root `SKILL.md` carry the complete structural
catalog only for Python; for every other language they are a summary, and the full
emitted code set (all JS-series codes, the Robot R-codes, the PL config-audit
codes) lives only in `reference.md`. Skipping this step silently under-detects
non-Python tests.

Load sections, not the whole file. `reference.md` is ~92 KiB, so an eager full
read overruns a small host-context budget (Codex CLI allows roughly 32 KiB) and
truncates mid-file, which degrades the analysis without any warning. On a tight
budget the semantic floor is the part you keep and the language section is the
part you defer. The floor is two fragments:
`fragments/semantic-cases-compact.md` (~4.7 KiB, a row per S-code) plus
`fragments/semantic-exemptions.md` (~2.8 KiB, the look-alike exemptions). At
7.5 KiB it covers every S-code and its exemptions with no `reference.md` read at
all, against ~13 KiB for the equivalent prose section, which leaves no room
beside Python (~27 KiB) or TS/JS (~19 KiB). Start from those two plus
`fragments/precision-rules.md`, then pull the passage of the `reference.md`
language section that defines the code you are about to report. Pull the passage,
not the section: a whole-section read is 15 to 19 KiB for Robot or TS/JS and does
not co-reside with an eager host file.

## Protocol in one paragraph

A test is useful only if it fails when the code breaks. Detect the language and
framework, classify the test intent (spec, characterization, regression,
behavior), then apply the six judgments: J1 does the assertion run, J2 is the
expected value from an independent oracle, J3 is the real unit under test, J4
does the assertion verify enough, J5 is the test coupled to implementation
internals, J6 does the test pass in isolation. For Python, also run the full
structural catalog (families A-E, the 56 emitted C-codes). Flag only the first failing
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
