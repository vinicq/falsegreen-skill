/**
 * Diagnostic and coupling codes - opt-in (OFF by default).
 * Codes: D1, D3, D4, D6, D7, D8, M2, C37
 *
 * These are NOT false-green: the test still protects against regressions.
 * They hurt observability and maintainability. Enable them only on a
 * diagnostic pass (for example `severity = { D1 = "info" }` in config). They
 * never flag a test as a false positive on the default run.
 *
 * Jest / Vitest idioms. Function names (buildOrder, subtotal, compute) are
 * placeholders.
 */


// --- D1: Assertion Roulette (2+ asserts, none with a message) --------------

// BAD: when one of these fails, the output names only a line number. With no
// per-assertion message you cannot tell which expectation broke.
test('D1 - order totals', () => {
  const order = buildOrder(items)
  expect(subtotal(order)).toBe(30) // D1 - which one failed?
  expect(discount(order)).toBe(3) // D1
  expect(total(order)).toBe(27) // D1
})

// CLEAN: name each expectation (Jest: 2nd arg to some matchers, or split tests)
test('D1 clean - order totals', () => {
  const order = buildOrder(items)
  expect(subtotal(order), 'subtotal').toBe(30)
  expect(discount(order), 'discount').toBe(3)
  expect(total(order), 'total').toBe(27)
})

// CLEAN: a single assertion is never Assertion Roulette
test('D1 clean - single assert', () => {
  expect(total(buildOrder(items))).toBe(27)
})


// --- D3: Duplicate Assert (the same assertion written twice) ---------------

// BAD: the second line repeats the first and adds no coverage
test('D3 - duplicate assert', () => {
  const result = compute()
  expect(result).toBe(42) // D3 - first occurrence
  expect(result).toBe(42) // D3 - exact duplicate
})

// CLEAN: each assertion checks something distinct
test('D3 clean', () => {
  const result = compute()
  expect(result).toBe(42)
  expect(typeof result).toBe('number')
})


// --- D4: untitled it.each / test.each cases --------------------------------

// BAD: 3+ cases with no per-case title, so CI shows "case 1", "case 2", and a
// failure does not say which input broke.
test.each([
  ['alice', 'ALICE'],
  ['bob', 'BOB'],
  ['carol', 'CAROL'], // D4 - 3+ cases, no descriptive title template
])('D4 - upper', (input, expected) => {
  expect(input.toUpperCase()).toBe(expected)
})

// CLEAN: the title template names each case via its parameters
test.each([
  ['alice', 'ALICE'],
  ['bob', 'BOB'],
  ['carol', 'CAROL'],
])('D4 clean - uppercases %s to %s', (input, expected) => {
  expect(input.toUpperCase()).toBe(expected)
})


// --- D6: console.* in a test body ------------------------------------------

// BAD: a console.log left from a debugging session - noise in CI output
test('D6 - debug log', () => {
  const result = compute()
  console.log('DEBUG result =', result) // D6 - leftover debug output
  expect(result).toBe(42)
})

// CLEAN: remove the console call
test('D6 clean', () => {
  expect(compute()).toBe(42)
})


// --- D7: anonymous test (empty or missing description) ---------------------

// BAD: empty title gives CI a blank test name; failures are unidentifiable
test('', () => { // D7 - no description
  expect(compute()).toBe(42)
})

// CLEAN: a descriptive title
test('D7 clean - compute returns 42', () => {
  expect(compute()).toBe(42)
})


// --- D8: magic number in an assertion --------------------------------------

// BAD: 86400 with no name - the reader cannot tell what it represents
test('D8 - magic number', () => {
  expect(secondsPerDay()).toBe(86400) // D8 - unnamed constant
})

// CLEAN: name the constant so intent is explicit
test('D8 clean', () => {
  const SECONDS_PER_DAY = 24 * 60 * 60
  expect(secondsPerDay()).toBe(SECONDS_PER_DAY)
})


// --- M2: over-long test body -----------------------------------------------

// BAD: a 50+ line test that verifies many unrelated concerns at once. A
// structural signal to split into focused single-concern tests (abbreviated).
test('M2 - does everything', () => {
  const user = createUser('Alice')
  expect(user.name).toBe('Alice') // concern 1: name
  expect(user.role).toBe('guest') // concern 2: default role
  db.save(user)
  const loaded = db.load(user.id)
  expect(loaded.name).toBe('Alice') // concern 3: round-trip
  const token = auth.issueToken(user)
  expect(token.userId).toBe(user.id) // concern 4: token issue
  expect(token.isExpired()).toBe(false) // concern 5: expiry
  // ...45 more lines covering still more concerns... M2
})

// CLEAN: one concern per test
test('M2 clean - new user has a name', () => {
  expect(createUser('Alice').name).toBe('Alice')
})

test('M2 clean - new user defaults to guest', () => {
  expect(createUser('Alice').role).toBe('guest')
})


// --- C37: duplicate it.each / test.each case -------------------------------

// BAD: the (2, 3, 5) row appears twice; the second run adds no new coverage
test.each([
  [1, 1, 2],
  [2, 3, 5],
  [2, 3, 5], // C37 - exact duplicate of the row above
  [0, 0, 0],
])('C37 - add(%i, %i) === %i', (a, b, expected) => {
  expect(add(a, b)).toBe(expected)
})

// CLEAN: every row covers a distinct scenario
test.each([
  [1, 1, 2],
  [2, 3, 5],
  [-1, 1, 0],
  [0, 0, 0],
])('C37 clean - add(%i, %i) === %i', (a, b, expected) => {
  expect(add(a, b)).toBe(expected)
})
