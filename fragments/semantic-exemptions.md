Look-alikes - do NOT flag: a deliberately narrow unit test whose scope the spec confirms
(S6 needs a stated broader contract); a constant that the spec genuinely endorses (not S3);
a sanitizer test that already pairs the negative check with a positive one (not S11); a test
of a filter whose contract is to drop the input entirely - a blocklist sanitizer, a
guard that returns empty on a forbidden value, a redactor that suppresses the whole field -
where empty output is the correct behavior, so the negative-only assertion legitimately
passes and a positive "content survived" assertion would contradict the design (not S11); a
mock on a genuine external edge - DB, network, clock (not S12); a `jest.spyOn(instance, 'methodA')` / `vi.spyOn` that stubs a DIFFERENT method than the one under test, to isolate an orchestrator from a sibling sub-unit (the assertion is on the composed result, not the stub) - S12 fires only when the patched symbol is a method of the SUT instance itself or the assertion echoes the stub value (not S12); a constructor-injected or module-level collaborator mock - repository, db, auth, or HTTP client (a clean case-10 external edge, not S12); a stub-config call made on the very library under test - `mockingoose`, `tinyspy`, `jsdom-testing-mocks` - where the mocking library IS the SUT, so the stub setup is production code (not S5/S8/C11a); a test whose shared state is
reset by an autouse/`beforeEach` teardown (not S13); a structural or contract assertion on a
model output - valid JSON, required keys present, a cited source id matches, a refusal on a
banned prompt, a deterministic post-processing step - or a mocked/stubbed model whose return is
fixture data (not S14); a sanctioned async-settling wait - Robot `Wait Until Keyword Succeeds`,
Testing Library `waitFor`/`findBy*`, Playwright/Cypress auto-wait, `await expect(...).toPass()` -
that polls a real settle condition and still fails hard on timeout (not S15); a call-only
assertion where the interaction IS the contract - a fire-and-forget event, an audit-log or
telemetry write, a queue publish - or a `toHaveBeenCalledWith`/`assert_called_once_with` that
pins the specific arguments, or any call-verification paired with an assertion on the SUT's return value or state - S16 requires the call-verification to be the SOLE oracle (not S16); a `pytest.raises(SpecificError, match=...)` bound to the SUT line (not S17); a stub fed a value the collaborator's contract can actually return (not S18); a test under `*.problem.*` / `*.solution.*` / `exercises/` / `katas/` / `playground/` - a teaching or TDD-spec fixture whose expected value is intentional (the exercise IS the spec), not a frozen bug (not case 18, not S3); a deterministic rubric, structural validator, or frozen human-labeled judge set rather than a live model verdict (not S21).
