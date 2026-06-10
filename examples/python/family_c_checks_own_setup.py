"""
Family C — The test checks its own setup, not the program.
Codes: C19, C28, C29

The test configures something (exception type, environment variable, fixture)
and then verifies only that the configuration took effect, not that the
production code behaved correctly.
"""
import pytest
import os


# ─── C19: pytest.raises wraps more than one call ─────────────────────────────

# BAD: if setup_data() raises, the SUT never executes
def test_c19_multiple_calls():
    with pytest.raises(ValueError):    # C19 — which call raised?
        setup_data()                   # could raise here...
        sut.process(data)              # ...target never reached

# BAD: fixture call inside the raises block
def test_c19_fixture_inside():
    with pytest.raises(TypeError):    # C19
        item = build_item()           # setup
        validate(item)                # target

# CLEAN: only the target call inside the block
def test_c19_clean():
    data = setup_data()               # setup outside
    with pytest.raises(ValueError):
        sut.process(data)             # only the SUT call inside


# ─── C28: pytest.raises binding variable never read ──────────────────────────

# BAD: exc captured but message never checked
def test_c28_binding_not_read():
    with pytest.raises(ValueError) as exc:   # C28 — exc never used
        process(bad_input)
    # test ends here; exception type was checked but not its content

# BAD: bound but only used in a way that doesn't inspect the exception
def test_c28_bound_but_unused():
    with pytest.raises(ValueError) as exc:   # C28
        process(bad_input)
    log_error(exc)  # not an assertion — still C28 if no assert follows

# CLEAN: exception content is checked
def test_c28_clean():
    with pytest.raises(ValueError) as exc:
        process(bad_input)
    assert "must be positive" in str(exc.value)

# CLEAN: using match= instead of binding
def test_c28_match_clean():
    with pytest.raises(ValueError, match="must be positive"):
        process(bad_input)


# ─── C29: os.environ mutated directly ────────────────────────────────────────

# BAD: mutation persists across tests in the same process
def test_c29_direct_mutation():
    os.environ["API_KEY"] = "test-secret"    # C29 — leaks to sibling tests
    assert client.authenticate() is True

# BAD: os.environ.update also leaks
def test_c29_update():
    os.environ.update({"DEBUG": "1", "LOG_LEVEL": "INFO"})  # C29
    assert app.is_debug_mode()

# BAD: os.putenv
def test_c29_putenv():
    os.putenv("FEATURE_FLAG", "enabled")     # C29
    assert feature_enabled()

# CLEAN: monkeypatch restores the original value automatically
def test_c29_monkeypatch_clean(monkeypatch):
    monkeypatch.setenv("API_KEY", "test-secret")
    assert client.authenticate() is True
    # env is restored after the test — no leakage

# CLEAN: context manager approach
def test_c29_context_clean():
    with mock.patch.dict(os.environ, {"API_KEY": "test-secret"}):
        assert client.authenticate() is True
