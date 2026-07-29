| Case | Judgment | Severity | Name | Rule |
|---|---|---|---|---|
| 10 | J3 | HIGH | Mocks the unit under test | Patches/mocks the function being tested, then asserts on the mock's return value |
| 11 | J2/J3 | HIGH | Asserts the value fed to the mock | Stubs dependency to return X, then asserts result == X with no real logic in between |
| 12 | J2 | HIGH | Re-implements the production formula | Expected value computed with the same formula as the SUT; both sides agree on the same wrong answer |
| 15 | J6 | HIGH | Passes only if another test ran first | Reads shared mutable state written by a sibling test; fails when run alone |
| 18 | J2 | HIGH | Expected value contradicts what the code should do | Asserts a value the independent oracle says is wrong; requires cited oracle before reporting |
| S1 | J4 | - | Intent mismatch | The name or docstring claims to verify X, the assertion checks Y or a trivial property (`test_applies_discount` that only asserts the call did not raise) |
| S2 | J4 | - | Irrelevant oracle | The assertion checks a property unrelated to the behavior under test: a test of the computed total that only asserts the response is not null |
| S3 | J2 | - | Plausible-but-wrong expected value | The expected constant looks reasonable but contradicts the spec (off-by-one, wrong rounding, wrong sign); derive the correct value from the spec and compare |
| S4 | J4 | - | Oracle cannot distinguish correct from a likely bug | The assertion passes for the right output and for a plausible wrong one: `len(result) == 3` when the suspected bug also yields three items |
| S5 | J3 | - | Tests the framework, not the code | The assertion exercises a language or library guarantee (a dict stores a key, the ORM returns what was just saved) instead of the code under test |
| S6 | J4 | - | Happy-path only against a stated contract | The spec or docstring promises error handling or boundaries, the test covers only the nominal path |
| S7 | J2 | - | Expected lifted from the output | The expected value was copied from a run of the current code (a pasted dict, a captured response), so the test can only confirm the code matches itself |
| S8 | J3 | - | Mock return reaches the assertion through an indirection | The stub's value flows through one or two trivial steps to the assertion, so the test still echoes the stub instead of verifying real behavior |
| S9 | J2 | - | Self-fulfilling arrangement | The test arranges the exact state it then asserts, with no transformation by the unit under test |
| S10 | J4 | - | Asserts the log, not the effect | The only check is that a message was logged, not the state change the message describes |
| S11 | J4 | - | Negative-only assertion on a security filter | A sanitizer, redactor, or auth test asserts only that the bad thing is absent (`"password" not in response`); it passes when the output is empty or dropped, so require a paired positive assertion |
| S12 | J3 | - | Patches core logic instead of an external edge | The test patches a private method or a direct collaborator on the class under test, so the assertion reads the stub, not the unit's own logic; patching a genuine external edge is legitimate |
| S13 | J6 | - | Passes only via shared state a sibling set up | The test relies on module-global, fixture, or hoisted state that another test or an import mutates, so it passes only in a given execution order |
| S14 | J2 | - | Recorded model output as the oracle | Asserts `==` against a snapshotted LLM/model result; green means the model still emits what it once emitted, not that the output is correct |
| S15 | J6 | LOW | Hand-rolled retry/poll loop masking flakiness | Wraps action+assertion in a retry/poll and passes if any attempt succeeds; only the swallow-and-pass form (a retry that re-raises on exhaustion is a sanctioned settle, not S15) |
| S16 | J4 | LOW | Call-verification as the sole oracle | The only check is that a collaborator was called (`assert_called_once`/`toHaveBeenCalled`), with no assertion on the unit's own return value or state |
| S17 | J4 | HIGH | Exception-path oracle blindness | `pytest.raises(Exception)`/`expect(fn).toThrow()` with no type or message on a documented error contract; goes green when the exception came from arrange (typo, missing import, None-deref) and the SUT never reached its raise |
| S18 | J3 | LOW | Contract-impossible stub value | A legitimate edge stub is configured to return a value the real collaborator can never emit (negative price, schema-violating row, `None` where non-null is guaranteed); the SUT handles an unreachable branch while the real defect goes untouched |
| S21 | J2 | LOW | Self-judging LLM/agent assertion | The oracle is a live model call (`judge_llm(...) == "yes"`, embedding-similarity against a model-generated reference, agent grading its own transcript); circular, passes whenever the judge is wrong in the same direction as the SUT |
