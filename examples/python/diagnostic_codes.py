"""
Diagnostic and coupling codes — opt-in (OFF by default).
Codes: D1, D3, D4, D5, D6, M2

These do not create false positives but hurt observability and maintainability.
Enable with `severity = { D1 = "info" }` in `.falsegreen.toml` or
`[tool.falsegreen]` in `pyproject.toml`.
"""
import pytest


# ─── D1: Assertion Roulette (2+ asserts, none with a message) ─────────────────

# BAD: when any assertion fails, the output says only the line number
def test_d1_assertion_roulette():
    order = build_order(items)
    assert subtotal(order) == 30    # D1 — which of the three failed?
    assert discount(order) == 3     # D1
    assert total(order) == 27       # D1

# CLEAN: at least one assertion has a message, or all do
def test_d1_with_messages():
    order = build_order(items)
    assert subtotal(order) == 30, "subtotal mismatch"
    assert discount(order) == 3,  "discount mismatch"
    assert total(order) == 27,    "total mismatch"

# CLEAN: single assertion — not Assertion Roulette
def test_d1_single_assert():
    assert total(build_order(items)) == 27


# ─── D3: Duplicate Assert (same assertion written twice) ─────────────────────

# BAD: the second assertion adds no coverage
def test_d3_duplicate_assert():
    result = compute()
    assert result == 42    # D3 — first occurrence
    assert result == 42    # D3 — exact duplicate

# BAD: identical assertion in different places
def test_d3_duplicate_in_branch():
    result = compute()
    if condition:
        assert result == 42
    assert result == 42    # D3 — also asserts outside the branch

# CLEAN: each assertion checks something distinct
def test_d3_clean():
    result = compute()
    assert result == 42
    assert isinstance(result, int)


# ─── D4: Unnamed Parametrize (3+ cases, no ids=) ────────────────────────────

# BAD: CI output shows test[0], test[1], test[2] — hard to debug
@pytest.mark.parametrize("value,expected", [
    ("alice", "ALICE"),
    ("bob",   "BOB"),
    ("carol", "CAROL"),     # D4 — 3+ cases, no ids=
])
def test_d4_unnamed(value, expected):
    assert value.upper() == expected

# CLEAN: human-readable IDs
@pytest.mark.parametrize("value,expected", [
    ("alice", "ALICE"),
    ("bob",   "BOB"),
    ("carol", "CAROL"),
], ids=["lowercase-name", "short-name", "another-name"])
def test_d4_with_ids(value, expected):
    assert value.upper() == expected


# ─── D5: Inline Setup Excess (too many setup statements before first assert) ──

# BAD: more than ~5 assignment/call statements before the first assert
def test_d5_excessive_setup():
    db = create_test_db()           # setup 1
    schema = load_schema("v2")      # setup 2
    user = create_user("Alice")     # setup 3
    session = db.open_session()     # setup 4
    session.save(user)              # setup 5
    role = Role("admin")            # setup 6
    user.assign_role(role)          # setup 7 — D5: too many inline setup lines
    assert user.has_role("admin")

# CLEAN: move setup to a fixture
@pytest.fixture
def admin_user(test_db):
    user = create_user("Alice")
    test_db.save(user)
    user.assign_role(Role("admin"))
    return user

def test_d5_clean(admin_user):
    assert admin_user.has_role("admin")


# ─── D6: Debug Print in test body ────────────────────────────────────────────

# BAD: print left over from debugging session
def test_d6_debug_print():
    result = compute()
    print(f"DEBUG result={result}")  # D6 — suppressed by pytest by default
    assert result == 42

# BAD: pprint
def test_d6_pprint():
    import pprint
    data = fetch_data()
    pprint.pprint(data)              # D6
    assert data["status"] == "ok"

# CLEAN: remove the print or replace with a proper log
def test_d6_clean():
    result = compute()
    assert result == 42


# ─── M2: Long Test Method ────────────────────────────────────────────────────

# BAD: a test body of 50+ lines tries to verify too many concerns at once.
# This is a structural signal to split into focused single-concern tests.

# Example of what NOT to do (abbreviated for readability):
def test_m2_too_long():
    # 50+ lines of setup + assertions testing multiple unrelated behaviors
    user = create_user("Alice")
    assert user.name == "Alice"           # concern 1: name
    assert user.role == "guest"           # concern 2: role default
    db.save(user)
    loaded = db.load(user.id)
    assert loaded.name == "Alice"         # concern 3: round-trip
    token = auth.issue_token(user)
    assert token.user_id == user.id       # concern 4: token issue
    assert not token.is_expired()         # concern 5: expiry
    # ... 45 more lines ...

# CLEAN: one test per concern
def test_m2_user_name_clean():
    assert create_user("Alice").name == "Alice"

def test_m2_user_default_role_clean():
    assert create_user("Alice").role == "guest"

def test_m2_user_round_trip_clean():
    user = create_user("Alice")
    db.save(user)
    assert db.load(user.id).name == "Alice"
