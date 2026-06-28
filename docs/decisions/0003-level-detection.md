# 0003 - Level detection (the pyramid) and level-aware oracle reading

Status: Accepted

## Context

The same code pattern is a smell at one pyramid level and correct at another. A weak check
(`assert response`) is a real false-green in a unit test, but at the API integration level the
presence of a response IS the contract. A real database hit is the point of an integration test and
a smell inside something that claims to be a unit test. Judging a test without knowing its level
produces false positives.

## Decision

The skill reads the pyramid level from signals before judging, and does not guess. Precedence,
strongest first: a doubled or intercepted boundary keeps the test at unit/component (the mock IS the
boundary); else a real boundary makes it integration; else a browser or mobile driver makes it E2E;
else, with no signal, it is unit. A project `conventions:` block overrides the signals. The oracle
expected at each level differs (an `assert` at unit, a response or row at integration, a visible
locator at E2E), and the weak-check codes relax in the web layer accordingly.

## Consequences

A valid pattern at one level is not flagged at another, which keeps the false-positive rate down.
Real I/O in a test with no level signal is itself the smell (mystery guest, resource optimism, state
leak), not the level, so the codes for those forms (`C23`, `C29`, `C30`) still fire. The level cue
lists are long and live in `reference.md`; they need maintenance as frameworks change, which is the
cost of reading the level instead of guessing it.
