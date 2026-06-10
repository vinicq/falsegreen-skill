"""
Family A — The test never checks anything.
Codes: C1, C2, C2b, C3, C4, C4b, C20, C21, CC

The assertion is skipped, missing, swallowed, or the test is never collected
by the runner. The test is green regardless of whether the code is correct.
"""
import pytest
from unittest.mock import patch


# ─── C1: assert inside if/for that may not run ────────────────────────────────

# BAD: if items is empty the assert never runs — always green
def test_c1_conditional_assert():
    items = get_items()
    if items:
        assert items[0].valid   # C1 — skipped when items == []

# BAD: for loop asserts nothing when the list is empty
def test_c1_loop_assert():
    for item in get_items():    # C1 — vacuous when list is []
        assert item.valid

# CLEAN: unconditional check before the loop
def test_c1_clean():
    items = get_items()
    assert len(items) > 0
    for item in items:
        assert item.valid

# CLEAN: literal non-empty tuple — loop always iterates
def test_c1_literal_loop_clean():
    for x in (1, 2, 3):
        assert x > 0


# ─── C2: test with no assertion at all ────────────────────────────────────────

# BAD: only proves the function didn't crash, not that it returned anything useful
def test_c2_no_assert():
    create_user("Alice")    # C2 — no assertion, always green

# BAD: pass body
def test_c2_pass():
    pass                    # C2 — empty body

# CLEAN: hypothesis test — framework generates the assertions internally
@pytest.mark.skip(reason="requires hypothesis")
def test_c2_hypothesis_not_flagged():
    # @given(st.integers()) decorated functions are exempt from C2
    pass

# CLEAN: xfail tests with empty body are explicitly disabled — not C2
@pytest.mark.xfail(reason="known bug #42")
def test_c2_xfail_not_flagged():
    pass


# ─── C2b: test calls SUT but never verifies the result ───────────────────────

# BAD: calls the function, discards the result
def test_c2b_discards_result():
    result = process(data)  # C2b — result never asserted

# BAD: setup statements only
def test_c2b_setup_only():
    user = create_user("Alice")
    db.save(user)
    # C2b — no check on what was saved


# ─── C3: assert inside try whose except swallows it ──────────────────────────

# BAD: AssertionError from the assert is caught and silenced
def test_c3_swallows_assertion():
    try:
        assert compute() == 42
    except Exception:       # C3 — catches AssertionError, test stays green
        pass

# BAD: bare except
def test_c3_bare_except():
    try:
        assert fetch() is not None
    except:                 # C3 — even broader
        pass

# CLEAN: except catches a specific, non-assertion exception
def test_c3_specific_except_clean():
    try:
        result = risky_parse()
    except ValueError:      # only ValueError — AssertionError propagates
        pytest.skip("unparseable input in this environment")
    assert result is not None

# CLEAN: handler re-raises
def test_c3_reraise_clean():
    try:
        assert compute() == 42
    except Exception:
        raise               # re-raises — assertion failure propagates


# ─── C4: test never collected by pytest ──────────────────────────────────────

# BAD: nested def — pytest does not collect functions defined inside other functions
def test_c4_outer():
    setup()

    def test_inner():       # C4 — never collected, pytest sees only test_c4_outer
        assert compute() == 42

# CLEAN: top-level function
def test_c4_top_level():
    assert compute() == 42


# ─── C4b: Test class with __init__ (pytest skips it) ─────────────────────────

# BAD
class TestProcessorBad:
    def __init__(self):     # C4b — pytest skips classes with __init__
        self.proc = Processor()

    def test_run(self):
        assert self.proc.run() == expected

# CLEAN: use a fixture instead
class TestProcessorClean:
    def test_run(self, processor):  # fixture injected, no __init__
        assert processor.run() == expected


# ─── C20: assertion after unconditional return/raise/fail ────────────────────

# BAD: unreachable assert after return
def test_c20_dead_assert():
    if not flag:
        return
    assert compute() == 42
    return                  # unconditional return
    assert True             # C20 — dead code, never runs

# BAD: unreachable after raise
def test_c20_after_raise():
    raise NotImplementedError("TODO")
    assert compute() == 42  # C20 — dead code


# ─── C21: every assert is conditional, none runs unconditionally ──────────────

# BAD: test always green when both branches avoid asserting
def test_c21_all_conditional():
    result = fetch()
    if result:
        assert result.status == "ok"    # C21 — if result is falsy, zero asserts run
    else:
        assert result is None           # unreachable if result is always truthy

# CLEAN: unconditional check first
def test_c21_clean():
    result = fetch()
    assert result is not None           # unconditional — always runs
    assert result.status == "ok"


# ─── CC: commented-out assert ─────────────────────────────────────────────────

# BAD
def test_cc_commented():
    result = compute()
    # assert result == 42   # CC — check was disabled, test always green
    log(result)

# CLEAN: re-enable the assertion
def test_cc_clean():
    result = compute()
    assert result == 42
