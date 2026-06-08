"""
Examples of false-positive test patterns in Python/pytest.
Each test passes green but does not verify correct behavior.
These illustrate the semantic cases (10/11/12/15/18) that the
falsegreen scanner flags for LLM review, plus common weak patterns.
"""
from unittest.mock import patch, MagicMock
import pytest


# ─── Case 10: Mocks the unit under test ────────────────────────────────────

@patch("mymodule.add")
def test_add_case10(mock_add):
    """BAD: patches the SUT itself, then asserts the mock's return value."""
    mock_add.return_value = 5
    result = mock_add(2, 3)     # calling the mock, not the real function
    assert result == 5          # C10 — tests the mock config


@patch("mymodule.db.fetch")
def test_get_user_clean(mock_fetch):
    """CLEAN: patches an edge (db), tests the real function."""
    from mymodule import get_user
    mock_fetch.return_value = {"id": 1, "name": "Alice"}
    user = get_user(1)          # real function under test
    assert user["name"] == "Alice"


# ─── Case 11: Asserts the value fed to the mock ────────────────────────────

def test_price_case11():
    """BAD: stubs price to 100, asserts result equals 100.
    If get_price() just returns mock.price, this is an echo."""
    mock_product = MagicMock()
    mock_product.price = 100
    from mymodule import get_price
    assert get_price(mock_product) == 100   # C11 if get_price returns product.price


def test_price_with_tax_clean():
    """CLEAN: stubs base price, asserts the tax was applied."""
    mock_product = MagicMock()
    mock_product.price = 100
    from mymodule import get_price_with_tax
    assert get_price_with_tax(mock_product) == 110  # 100 + 10% = 110 (from spec)


# ─── Case 12: Re-implements the production formula ─────────────────────────

def test_total_case12():
    """BAD: expected re-implements the formula — both agree on the same
    wrong number if the formula has a bug."""
    price, tax_rate = 100, 0.1
    expected = price + price * tax_rate      # same as calculate_total
    from mymodule import calculate_total
    assert calculate_total(price, tax_rate) == expected  # C12


def test_total_clean():
    """CLEAN: expected comes from the spec, not from a formula copy."""
    from mymodule import calculate_total
    assert calculate_total(100, 0.1) == 110.0    # spec: 100 + 10% = 110


# ─── Case 15: Passes only if another test ran first ────────────────────────

_shared_cache: dict = {}

def test_populate_cache():
    """BAD part 1: populates shared state."""
    _shared_cache["key"] = "value"


def test_read_cache():
    """BAD part 2: C15 — passes only after test_populate_cache ran first."""
    assert _shared_cache["key"] == "value"


# ─── Case 18: Expected contradicts the spec ────────────────────────────────

def test_apply_discount_case18():
    """BAD: the spec says apply_discount(200, 0.15) must return 170.
    This test asserts 200 — no discount was applied.
    If the function is buggy and returns 200, this test passes and freezes
    the bug as 'correct behavior'.
    Oracle: docstring says 'returns price minus (price * rate)'."""
    from mymodule import apply_discount
    assert apply_discount(200, 0.15) == 200  # C18 — asserts the bug


def test_apply_discount_clean():
    """CLEAN: expected from the spec (price - price * rate = 170)."""
    from mymodule import apply_discount
    assert apply_discount(200, 0.15) == 170.0
