---
name: falsegreen-skill
description: Analyze test files for false-positive smells, meaning tests that pass even when the code breaks. Use when the user asks to review tests for false positives, weak assertions, mock misuse, test smells, or asks whether a test can actually fail. Covers Python (pytest, unittest), TypeScript, JavaScript (Jest, Vitest, Mocha), and Robot Framework.
---

# falsegreen-skill: false-positive test detection

This skill is a thin entry point. The canonical protocol lives at the plugin
root. Read these files before judging any test:

1. `SKILL.md` at the plugin root (relative to this file: `../../SKILL.md`).
   It defines Steps 0-7 and the six judgments J1-J6. At ~36 KiB it is a
   large-context read: on a ~32 KiB host, work from this file plus the fragments
   it names and pull `../../SKILL.md` only for the long-form judgment wording or
   Mode B/C.
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
budget the floor is the part you keep and the language section is the part you
defer. The floor is three things: the structural code index below (~3 KiB, all 39
TS/JS, Robot and project-layer codes), `fragments/semantic-cases-compact.md`
(~4.7 KiB, a row per S-code), and `fragments/semantic-exemptions.md` (~2.8 KiB,
the look-alike exemptions). At ~10.5 KiB together they name every code and its
exemptions with no `reference.md` read at all, against ~19 KiB for the TS/JS
section alone. Add `fragments/precision-rules.md`, then pull the passage of the
`reference.md` language section that defines a code only when a finding needs its
full definition. The index has to come first: a passage cannot be requested for a
code the reader has never seen named, which is why deferring the section without
the index does not work.

## Structural code index (TS/JS, Robot, project layer)

Generated from `schema/code-catalog.json`, so it cannot drift from
`reference.md`. Severity `-` means the code carries no fixed severity.

<!-- fg:structural-codes-compact:start -->
| Code | Severity | What to look for |
|---|---|---|
| **TypeScript / JavaScript** | | 24 codes |
| JS1 | HIGH | focused test (`it.only`/`fit`) skips the rest of the suite |
| JS2 | HIGH | `expect(x)` with no matcher |
| JS3 | LOW | snapshot is the only assertion |
| JS4 | LOW | skipped test (`it.skip`/`xit`/`it.todo`) |
| JS5 | LOW | async query/event not awaited (`findBy*`/`waitFor`/user-event) |
| JS6 | HIGH | empty `describe`/`suite` |
| JS7 | LOW | assertion in a non-awaited `setTimeout`/`then` callback |
| JS8 | LOW | mocks the unit under test and asserts it directly |
| JS9 | HIGH | assertion in a dead literal branch (`if(false)`) |
| JS11 | LOW | `try/catch` swallows the assertion |
| JS13 | LOW | `queryBy*`/`queryAllBy*` query (returns null when absent) as a loose statement, never asserted - `getBy*`/`getAllBy*`/`findBy*`/`findAllBy*` throw on absence and ARE the assertion |
| JS15 | LOW | comparison wrapped in a boolean (`expect(a===b).toBe(true)`) |
| JS17 | LOW | commented-out test block (`// it(...)`) |
| JS18 | LOW | `done` callback instead of async/await |
| JS21 | HIGH | matcher referenced but never called (`expect(x).toBe` with no `()`) |
| JS22 | HIGH | empty `it.each`/`test.each` table |
| JS23 | HIGH | `expect.assertions(N)` with fewer unconditional reachable `expect()` calls than `N` |
| JS24 | LOW | Cypress `cy.get/find/contains` query statement with no `.should`/`.and`/`.then` assertion |
| JS25 | HIGH | the only assertion sits inside an array-iterator callback (`forEach`/`map`/`filter`/`some`/`every`/`flatMap`) - runs zero times on an empty collection |
| JS26 | LOW | fake timers installed but never advanced (`runAllTimers`/`advanceTimersByTime`/`tick`) - the scheduled callback never fires, so the assertion reads un-mutated state |
| JS27 | LOW | `toHaveBeenCalled*` is the sole oracle on a locally-created double - verifies wiring, not behaviour |
| JS29 | LOW | `expect(...).resolves`/`.rejects` chain is a bare statement, not awaited or returned - the test finishes green before the matcher settles |
| JS30 | HIGH | literal-vs-literal assertion (`expect(2).toBe(3)`, chai `expect(x).to.equal(y)`) - both operands are fixed at parse time |
| JS31 | LOW | `try/catch` swallows a possible throw with no assertion on the exception - a unit that stops throwing still passes green |
| **Robot Framework** | | 9 codes |
| R1 | - | Forced green |
| R2 | - | Hollow verifier keyword |
| R3 | - | Test Cases in a .resource |
| R4 | - | No Operation only |
| R5 | - | Empty [Template] |
| R6 | - | Should Be True on a string literal |
| R7 | - | Hollow [Template] keyword |
| R8 | - | Verification only in Setup |
| R8b | - | Verification only in Teardown |
| **Project layer** | | 6 codes |
| PL1 | - | Asserts stripped at runtime |
| PL2 | - | Warnings not promoted |
| PL7 | - | No coverage gate |
| PL8 | - | Run stops early |
| PL9 | - | Skip-on-failure run option |
| PL10 | - | passWithNoTests |
<!-- fg:structural-codes-compact:end -->

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
