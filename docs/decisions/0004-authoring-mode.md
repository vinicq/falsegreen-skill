# 0004 - Mode B (authoring) and its J1-J6 self-check

Status: Accepted

## Context

The catalog detects false-green tests. The same knowledge can generate them: an LLM asked to write
tests will, by default, produce a characterization test built from the code's current output, which
is false-green by construction (it freezes whatever the code does today as correct). A generator
that does not guard against its own catalog would emit exactly the tests the catalog flags.

## Decision

The skill has two modes. Mode A (analysis) judges a given test. Mode B (authoring) writes tests, and
the catalog becomes a generation guard: a test the skill writes must pass the same J1-J6 it would be
judged by, so it does not ship a false-green *shape*. The guard is on the shape, not the oracle's
truth: it refuses to generate from the code's current output, but it cannot tell a hand-written wrong
oracle from a right one (no static read recovers the expected value's provenance). Mode B asks the
user for what only they can supply (the pyramid level, the language and framework, the behavior and
its independent oracle, the doubled boundaries) and then self-checks the draft against the judgments
before emitting it.

## Consequences

A generated test carries an oracle that is independent of the code, not a snapshot of it. The self-
check closes the loop: authoring runs the analysis judgments on its own output, so Mode B cannot
produce a test that Mode A would flag. The cost is that authoring is not zero-prompt: it must ask
for the oracle, because without one it can only freeze current behavior, which is the failure it
exists to avoid.

## CLI surface (added after the decision)

Mode B first shipped host-only, because the elicitation (level, language, oracle, doubles) is a
conversation. The CLI now exposes the non-interactive slice: `falsegreen-skill generate <spec-file>
--lang <language>` takes a `schema/test-spec.json` file - where the oracle is already written down -
renders it into one stack, and runs the Mode A self-check on the result (bounded to one revision so
it stays a command, not an agent loop). The interactive elicitation stays host-only; the CLI refuses
a spec with no oracle rather than guessing one. This keeps the guarantee (no generation from current
output) while making the deterministic render+self-check step scriptable and CI-friendly.
