/**
 * Semantic cases - require LLM judgment (no static rule can detect these).
 * Cases: 10, 11, 12, 15, 18
 *
 * Static analysis catches structural false positives (unreachable assertions,
 * tautologies, missing matchers). It cannot reconstruct intent. These five
 * cases need a model that reads the test as a whole and reasons about what it
 * actually verifies. Each BAD example is structurally well-formed: a single
 * clean assertion that runs and passes. Only the semantic pass flags it.
 *
 * Jest / Vitest idioms. Function names (add, getPrice, calculateTotal,
 * applyDiscount) are placeholders.
 */


// --- Case 10: patches the unit under test ----------------------------------

// BAD: the test mocks the very function it claims to test, then asserts the
// mock's return. Structurally perfect: one assertion, runs, passes. But the
// real add() never executes. Only intent-reasoning sees that the SUT is mocked.
jest.mock('./math')
const { add } = require('./math')

test('add returns the sum (case 10)', () => {
  add.mockReturnValue(5)
  const result = add(2, 3) // calling the mock, not the real add
  expect(result).toBe(5) // case 10 - asserts the mock config, not the SUT
})

// CLEAN: mock a dependency, exercise the real function
jest.mock('./db')
const { db } = require('./db')

test('getUser returns the user (clean)', () => {
  const { getUser } = jest.requireActual('./service')
  db.fetch.mockReturnValue({ id: 1, name: 'Alice' })
  expect(getUser(1).name).toBe('Alice') // real getUser under test
})


// --- Case 11: asserts the value fed to the mock (echo) ---------------------

// BAD: stubs product.price to 100, then asserts the result is 100. If
// getPrice just returns product.price, this is a tautology - it passes whether
// or not any computation happened. The number 100 appears on both sides.
test('getPrice returns the price (case 11)', () => {
  const product = { price: 100 }
  expect(getPrice(product)).toBe(100) // case 11 - echo: 100 in, 100 out
})

// CLEAN: stub the input, assert a DERIVED result
test('getPriceWithTax adds tax (clean)', () => {
  const product = { price: 100 }
  expect(getPriceWithTax(product)).toBe(110) // spec: 100 + 10% = 110
})


// --- Case 12: re-implements the production formula as the expected ---------

// BAD: the expected value is computed with the same formula as the SUT. If
// the formula has a bug, both sides share it and agree - the test still passes.
test('calculateTotal applies tax (case 12)', () => {
  const price = 100
  const taxRate = 0.1
  const expected = price + price * taxRate // copy of calculateTotal's formula
  expect(calculateTotal(price, taxRate)).toBe(expected) // case 12 - shared bug hides
})

// CLEAN: the expected comes from the spec, not from a code copy
test('calculateTotal applies tax (clean)', () => {
  expect(calculateTotal(100, 0.1)).toBe(110) // spec: 100 + 10% = 110
})


// --- Case 15: passes only when another test ran first ----------------------

// BAD: a module-level var hoists to file scope and is shared across tests.
// The second test depends on the first having populated it. Run in isolation
// (or with a different test order), it fails. Each test in isolation is
// structurally fine; the coupling is only visible across the file.
var sharedCache = {} // file-scoped, leaks between tests

test('populate cache (case 15 - part 1)', () => {
  sharedCache.key = 'value'
  expect(sharedCache.key).toBe('value')
})

test('read cache (case 15 - part 2)', () => {
  expect(sharedCache.key).toBe('value') // case 15 - fails if part 1 did not run first
})

// CLEAN: no shared state; each test builds its own
test('cache round-trips (clean)', () => {
  const cache = {}
  cache.key = 'value'
  expect(cache.key).toBe('value') // isolated, order-independent
})


// --- Case 18: expected value contradicts the spec --------------------------

// BAD: the spec says applyDiscount(200, 0.15) returns 170 (price minus 15%).
// This asserts 200 - the undiscounted price. If the function is buggy and
// returns 200, the test passes and freezes the bug as "correct". Structurally
// this is a normal, passing assertion. Only an oracle (the spec / JSDoc that
// says "returns price minus price * rate") reveals the expected value is wrong.
test('applyDiscount applies the discount (case 18)', () => {
  expect(applyDiscount(200, 0.15)).toBe(200) // case 18 - asserts the bug, not the spec
})

// CLEAN: expected derived from the spec
test('applyDiscount applies the discount (clean)', () => {
  expect(applyDiscount(200, 0.15)).toBe(170) // 200 - (200 * 0.15) = 170
})
