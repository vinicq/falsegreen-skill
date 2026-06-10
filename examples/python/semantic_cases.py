"""
Semantic cases — require LLM judgment (no static rule can detect these).
Cases: 10, 11, 12, 15, 18

Static analysis can detect structural false positives (unreachable assertions,
tautologies, etc.) but it cannot reconstruct test intent. These five cases
need a model that reads the test as a whole and reasons about what it is
actually verifying.
"""
from unittest.mock import patch, MagicMock
import pytest


# ─── Case 10: Patches the unit under test ────────────────────────────────────

# BAD: the test patches the function it is supposed to test, then asserts
# the mock's return value. This tests nothing about the real implementation.
@patch("mymodule.add")
def test_add_case10(mock_add):
    mock_add.return_value = 5
    result = mock_add(2, 3)     # calling the mock, not the real function
    assert result == 5          # case 10 — asserts the mock config, not the SUT

# CLEAN: patch a dependency (the DB, the network), test the real function
@patch("mymodule.db.fetch")
def test_get_user_clean(mock_fetch):
    from mymodule import get_user
    mock_fetch.return_value = {"id": 1, "name": "Alice"}
    user = get_user(1)          # real function under test
    assert user["name"] == "Alice"


# ─── Case 11: Asserts the value fed to the mock (echo) ───────────────────────

# BAD: stubs `product.price` to 100, then asserts the result is 100.
# If `get_price` just returns `product.price`, the test is a tautology:
# it passes whether or not any computation happened.
def test_price_case11():
    mock_product = MagicMock()
    mock_product.price = 100
    from mymodule import get_price
    assert get_price(mock_product) == 100   # case 11 — echo: 100 in, 100 out

# CLEAN: stub the input, assert a derived result
def test_price_with_tax_clean():
    mock_product = MagicMock()
    mock_product.price = 100
    from mymodule import get_price_with_tax
    assert get_price_with_tax(mock_product) == 110  # spec: 100 + 10% = 110


# ─── Case 12: Re-implements the production formula as expected ───────────────

# BAD: the expected value is computed using the same formula as the SUT.
# If the formula has a bug, both sides agree — test still passes.
def test_total_case12():
    price, tax_rate = 100, 0.1
    expected = price + price * tax_rate      # copy of calculate_total's formula
    from mymodule import calculate_total
    assert calculate_total(price, tax_rate) == expected  # case 12

# CLEAN: expected comes from the spec, not from a code copy
def test_total_clean():
    from mymodule import calculate_total
    assert calculate_total(100, 0.1) == 110.0    # spec: 100 + 10% = 110


# ─── Case 15: Passes only when another test ran first ────────────────────────

_shared_cache: dict = {}

# BAD part 1: populates module-level state
def test_populate_cache():
    _shared_cache["key"] = "value"

# BAD part 2: case 15 — depends on test_populate_cache having run first
def test_read_cache():
    assert _shared_cache["key"] == "value"  # fails when run in isolation

# CLEAN: no shared state; each test sets up its own environment
def test_cache_isolated(tmp_path):
    cache = {}
    cache["key"] = "value"
    assert cache["key"] == "value"


# ─── Case 18: Expected value contradicts the spec ────────────────────────────

# BAD: the spec says apply_discount(200, 0.15) returns 170.
# This test asserts 200 — the undiscounted price.
# If the function is buggy and returns 200, the test passes and permanently
# freezes the bug as "correct" behavior. Requires an independent oracle to flag.
# Oracle: function docstring says "returns price minus (price * rate)".
def test_apply_discount_case18():
    from mymodule import apply_discount
    assert apply_discount(200, 0.15) == 200  # case 18 — asserts the bug

# CLEAN: expected from the spec
def test_apply_discount_clean():
    from mymodule import apply_discount
    assert apply_discount(200, 0.15) == 170.0  # 200 - (200 * 0.15) = 170
