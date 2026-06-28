# 0001 - J1-J6 protocol boundary: semantic skill vs static scanners

Status: Accepted

## Context

The ecosystem has two kinds of detector. The static scanners (falsegreen for Python, falsegreen-js
for JS/TS, robotframework-falsegreen for Robot) parse a file and prove structural facts: an
assertion that is missing, unreachable, swallowed, or always true. They never run the test and
never read intent. A different set of failure modes cannot be proven by structure: a mock that
stands in for the unit under test, an expected value copied from the code, a test that borrows
state from another. Judging those needs reading the test against an independent oracle.

## Decision

The skill is defined by the six judgments J1-J6, the per-test questions that decide whether a test
protects anything. The static scanners answer the subset of those judgments that a parser can
settle mechanically; the skill answers all six, including the ones that require reading production
intent (the semantic cases 10, 11, 12, 15, 18). The judgment set, not the language, is the
contract. A finding from either layer reports which judgment failed.

## Consequences

The boundary is explicit: a code that a parser can prove belongs to a scanner, and the skill
adjudicates it only when review is asked for; a code that needs intent is the skill's alone. The
five semantic cases are documented as skill-only and confirmed with mutation testing, which the
skill does not run itself. The judgments give the two layers a shared vocabulary, so a scanner
finding and a skill finding name the same failure in the same terms.
