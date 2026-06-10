"""
Family E — The test passes but checks the wrong thing.
Codes: C33, C36, C37

The assertion runs against a real result, yet the expected value
contradicts intent, a metric is never verified, or duplicate cases
provide false confidence in coverage.
"""
import pytest
from sklearn.metrics import accuracy_score, f1_score


# ─── C33: sklearn/ML metric computed but never asserted ──────────────────────

# BAD: metric computed but result discarded
def test_c33_metric_discarded(model, X_test, y_test):
    y_pred = model.predict(X_test)
    accuracy_score(y_test, y_pred)  # C33 — result is a bare expression, never checked

# BAD: assigned but not asserted
def test_c33_assigned_not_asserted(model, X_test, y_test):
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)   # C33 — acc is never read in an assertion
    f1 = f1_score(y_test, y_pred, average="weighted")  # C33 — same

# BAD: model.score() result ignored
def test_c33_score_ignored(model, X_test, y_test):
    model.score(X_test, y_test)     # C33 — return value discarded

# CLEAN: assert the metric against a meaningful threshold
def test_c33_clean(model, X_test, y_test):
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    assert acc >= 0.90, f"Expected accuracy >= 0.90, got {acc:.3f}"

def test_c33_f1_clean(model, X_test, y_test):
    y_pred = model.predict(X_test)
    f1 = f1_score(y_test, y_pred, average="weighted")
    assert f1 >= 0.85


# ─── C36: pytest.fail() without reason ───────────────────────────────────────

# BAD: empty failure message makes CI output unreadable
def test_c36_no_reason():
    if not condition_met():
        pytest.fail()               # C36 — no message, CI shows just "FAILED"

# BAD: empty string
def test_c36_empty_string():
    if result != expected:
        pytest.fail("")             # C36

# CLEAN: descriptive failure message
def test_c36_clean():
    if not condition_met():
        pytest.fail("Condition not met after 3 retries — check service health")

# CLEAN: reason= keyword
def test_c36_reason_clean():
    if result != expected:
        pytest.fail(reason=f"Expected {expected!r}, got {result!r}")


# ─── C37: duplicate case in @pytest.mark.parametrize ─────────────────────────

# BAD: (2, 3, 5) appears twice — second run provides no new coverage
@pytest.mark.parametrize("a, b, expected", [
    (1, 1, 2),
    (2, 3, 5),
    (2, 3, 5),  # C37 — exact duplicate of line above
    (0, 0, 0),
])
def test_c37_duplicate_case(a, b, expected):
    assert add(a, b) == expected

# BAD: same inputs, same expected — only string representation differs
@pytest.mark.parametrize("value", [
    "hello",
    "hello",    # C37 — identical to previous case
    "world",
])
def test_c37_duplicate_string(value):
    assert process(value) is not None

# CLEAN: each case covers a distinct scenario
@pytest.mark.parametrize("a, b, expected", [
    (1, 1, 2),
    (2, 3, 5),
    (-1, 1, 0),
    (0, 0, 0),
])
def test_c37_clean(a, b, expected):
    assert add(a, b) == expected

# CLEAN: parametrize with ids for readability
@pytest.mark.parametrize("value,expected", [
    ("hello", "HELLO"),
    ("world", "WORLD"),
    ("", ""),
], ids=["greeting", "target", "empty"])
def test_c37_with_ids_clean(value, expected):
    assert value.upper() == expected
