# Rendered from apply-discount.spec.yaml (Mode B). Level: unit.
# Non-false-green: the expected value (170) comes from the spec, not the code.
from shop.pricing import apply_discount


def test_apply_discount_15_percent_on_200_returns_170():
    # spec: apply_discount(price, rate) returns price minus rate*price
    result = apply_discount(200, 0.15)
    assert result == 170          # J2 oracle: 200 - (200 * 0.15) = 170
