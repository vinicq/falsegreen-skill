"""
Family C — The test checks its own setup, not the program.
Codes: C19, C28, C29, C48

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


# ─── C48: dark patch — flips a test-mode flag then asserts ───────────────────
# The test forces a known test-mode toggle (a name that means "we are under
# test") into test mode, then asserts. The product then takes its test-only
# branch (`if TESTING: ...`) and the test never exercises real behaviour.
# Note the C48-vs-C29 boundary: these os.environ writes are also C29 (env leak),
# but the dark-patch smell is distinct — it is about *which branch* runs.

# BAD: forces TESTING=1 then asserts — exercises the product's test-only branch.
def test_c48_dark_patch_env():
    os.environ["TESTING"] = "1"    # C48 (also C29) — test-mode toggle
    assert compute() == "ok"

# BAD: a settings flag named TESTING set to True, then asserted.
def test_c48_dark_patch_flag():
    settings.TESTING = True        # C48 — flips test-mode, then asserts
    assert compute() == "ok"

# CLEAN: DATABASE_URL is configuration, not a test-mode toggle — no C48.
def test_c48_config_value_clean():
    os.environ["DATABASE_URL"] = "sqlite://"
    assert compute() == "ok"

# CLEAN: a product feature flag is real behaviour under test, not a dark patch.
def test_c48_feature_flag_clean():
    settings.FEATURE_X = True
    assert compute() == "ok"

# CLEAN: the flag write has no assertion after it — setup, not a dark-patch test.
def test_c48_setup_only_clean():
    os.environ["TESTING"] = "1"
    do_setup()
