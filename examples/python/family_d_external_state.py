"""
Family D — Green depends on outside factors.
Codes: C17, C23, C24, C27, C30, C31, C32, C35

Time, file paths, shared mutable state, swallowed exceptions, unmocked HTTP,
discarded output captures, or retry decorators that mask non-determinism.
"""
import pytest
import os
import responses as responses_lib


# ─── C17: skip inside broad except ───────────────────────────────────────────

# BAD: a real assertion failure is silently turned into a skip
def test_c17_skip_on_failure():
    try:
        assert fetch_data() == expected   # if this fails...
    except Exception:
        pytest.skip("skipping")          # C17 — failure becomes a skip, stays green

# BAD: skipTest (unittest style)
def test_c17_skip_test():
    try:
        assert compute() == 42
    except Exception:
        import unittest
        raise unittest.SkipTest("env issue")  # C17

# CLEAN: skip on a specific, expected environment condition — not on assertion failure
def test_c17_env_condition_clean():
    if not os.environ.get("EXTERNAL_API_KEY"):
        pytest.skip("API key not configured")   # legitimate skip condition
    assert fetch_data() == expected


# ─── C23: hard-coded absolute or home-relative file path ─────────────────────

# BAD: path doesn't exist in CI or on another machine
def test_c23_absolute_path():
    data = open("/home/user/fixtures/data.csv").read()  # C23 — hard-coded path
    assert parse(data) == expected

# BAD: home-directory-relative
def test_c23_home_path():
    from pathlib import Path
    data = (Path.home() / "data" / "fixture.json").read_text()  # C23
    assert process(data) == expected

# CLEAN: relative to the test file
def test_c23_relative_path_clean():
    from pathlib import Path
    fixture = (Path(__file__).parent / "fixtures" / "data.csv").read_text()
    assert parse(fixture) == expected

# CLEAN: pytest tmp_path fixture
def test_c23_tmp_path_clean(tmp_path):
    fixture = tmp_path / "data.csv"
    fixture.write_text("a,b\n1,2")
    assert parse(fixture.read_text()) == expected


# ─── C24: module-level mutable state shared between tests ────────────────────

_cache: dict = {}   # module-level mutable — shared across all tests in this file

# BAD part 1: populates shared state
def test_c24_populate():
    _cache["key"] = "value"   # C24 — mutates module state, affects test_c24_read

# BAD part 2: depends on test_c24_populate having run first
def test_c24_read():
    assert _cache["key"] == "value"  # C24 — fails when run in isolation

# CLEAN: use a fixture with proper scope
@pytest.fixture
def fresh_cache():
    return {}

def test_c24_isolated_clean(fresh_cache):
    fresh_cache["key"] = "value"
    assert fresh_cache["key"] == "value"   # isolated — no leakage


# ─── C27: try/except/pass instead of pytest.raises ───────────────────────────

# BAD: success AND failure both leave the test green
def test_c27_try_pass():
    try:
        risky()                 # C27 — if risky() doesn't raise, still green
    except ValueError:          # if it raises, swallowed — still green
        pass

# BAD: no assertion anywhere in the try/except
def test_c27_no_assert():
    try:
        process(data)
    except Exception:
        pass                    # C27 — verifies nothing

# CLEAN: pytest.raises is explicit about intent
def test_c27_clean():
    with pytest.raises(ValueError, match="out of range"):
        risky()

# CLEAN: assertion after the try block
def test_c27_assert_after_clean():
    result = None
    try:
        result = compute()
    except ValueError:
        pass
    assert result is not None   # outside the try — runs either way


# ─── C30: responses.add() without activating the interceptor ─────────────────

# BAD: real HTTP request goes through — mock never used
def test_c30_no_activate():
    responses_lib.add(
        responses_lib.GET,
        "https://api.example.com/user/1",
        json={"id": 1, "name": "Alice"}
    )                           # C30 — interceptor not activated
    result = fetch_user(1)
    assert result["name"] == "Alice"   # real HTTP may succeed, fail, or time out

# CLEAN: decorator activates the interceptor
@responses_lib.activate
def test_c30_decorator_clean():
    responses_lib.add(
        responses_lib.GET,
        "https://api.example.com/user/1",
        json={"id": 1, "name": "Alice"}
    )
    result = fetch_user(1)
    assert result["name"] == "Alice"

# CLEAN: context manager
def test_c30_context_manager_clean():
    with responses_lib.RequestsMock() as rsps:
        rsps.add(responses_lib.GET, "https://api.example.com/user/1", json={"id": 1})
        result = fetch_user(1)
        assert result["id"] == 1


# ─── C31: capsys.readouterr() result discarded ───────────────────────────────

# BAD: capture called but output never verified
def test_c31_discard(capsys):
    run_command()
    capsys.readouterr()         # C31 — captured but nothing asserted

# BAD: assigned but never read in assertion
def test_c31_assigned_not_asserted(capsys):
    run_command()
    captured = capsys.readouterr()   # C31 — captured is never asserted
    do_something_else()

# CLEAN
def test_c31_clean(capsys):
    run_command()
    out, err = capsys.readouterr()
    assert out == "Processing done\n"
    assert err == ""


# ─── C32: @pytest.mark.skip without reason= ──────────────────────────────────

# BAD: no explanation — test may be forgotten permanently
@pytest.mark.skip
def test_c32_no_reason():
    assert compute() == expected   # C32

# BAD: skip() call without reason
def test_c32_skip_call_no_reason():
    pytest.skip()                  # C32

# CLEAN
@pytest.mark.skip(reason="blocked by issue #42 — network dependency")
def test_c32_with_reason():
    assert fetch_remote() == expected


# ─── C35: retry/flaky decorator masks non-determinism ────────────────────────

# BAD: retry hides the flakiness instead of fixing its root cause
@pytest.mark.flaky(reruns=3)
def test_c35_flaky():
    assert unstable_network_call() == expected   # C35 — retries hide the bug

@pytest.mark.retry(times=5)
def test_c35_retry():
    assert time_sensitive_check()                # C35

# CLEAN: fix the root cause (freeze time, mock the network, seed randomness)
def test_c35_clean(requests_mock):
    requests_mock.get("https://api.example.com/data", json={"value": 42})
    assert fetch_value() == 42   # deterministic — no retry needed
