// Rendered from apply-discount.spec.yaml (Mode B). Level: unit.
// Non-false-green: the expected value (170) comes from the spec, not the code.
const { test, expect } = require("@jest/globals");
const { applyDiscount } = require("../../src/pricing");

test("a 15% discount on 200 returns 170", () => {
  // spec: applyDiscount(price, rate) returns price minus rate*price
  const result = applyDiscount(200, 0.15);
  expect(result).toBe(170); // J2 oracle: 200 - (200 * 0.15) = 170
});
