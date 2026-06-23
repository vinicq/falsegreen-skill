/**
 * Family B - The check is weak or always true.
 * Codes: C5, C6, C7, C8, C9, C18, JS3, JS15
 *
 * The assertion passes by construction, accepts almost any output, or compares
 * a stringified form instead of the real value.
 *
 * Jest / Vitest idioms, with a little Mocha + Chai variety. Function names
 * (getResult, getUsers, getUser, computeRatio, divide, render) are placeholders.
 */


// --- C5: always-true check -------------------------------------------------

// BAD: both sides are literals - true by construction
test('C5 - literal vs literal', () => {
  expect(true).toBe(true) // C5 - passes regardless of any production code
})

// BAD: a non-empty object literal is always truthy
test('C5 - truthy literal', () => {
  expect({ ok: true }).toBeTruthy() // C5 - the literal is always truthy
})

// BAD: Chai style, equal literals
test('C5 - chai literals', () => {
  expect(1).to.equal(1) // C5
})

// CLEAN: compare the real result against an expected value
test('C5 clean', () => {
  expect(getResult()).toBe(expectedValue)
})


// --- C6: weak check (toBeTruthy / toBeDefined / .length > 0) ----------------

// BAD: toBeTruthy passes for any non-empty list, dict, or object
test('C6 - truthiness', () => {
  const result = getUsers()
  expect(result).toBeTruthy() // C6 - passes for [wrongUser], {}, anything truthy
})

// BAD: length > 0 does not verify the contents
test('C6 - length positive', () => {
  const result = getUsers()
  expect(result.length).toBeGreaterThan(0) // C6 - passes for [null], wrong data
})

// BAD: toBeDefined accepts null, 0, '', false - anything but undefined
test('C6 - defined only', () => {
  expect(getUser(1).role).toBeDefined() // C6 - 'wrong-role' passes too
})

// CLEAN: assert the actual value
test('C6 clean', () => {
  const result = getUsers()
  expect(result).toHaveLength(3)
  expect(result[0].name).toBe('Alice')
})

// CLEAN (not C6): toHaveProperty checks a key exists - a meaningful contract
test('C6 clean - property existence', () => {
  const response = buildResponse()
  expect(response).toHaveProperty('status')
  expect(response).toHaveProperty('data')
})


// --- C7: self-compare (expect(x).toBe(x)) ----------------------------------

// BAD: same reference on both sides - true by reflexivity
test('C7 - self compare', () => {
  const name = getName()
  expect(name).toBe(name) // C7 - always passes
})

// BAD: Chai self-equal
test('C7 - chai self', () => {
  const result = compute()
  expect(result).to.equal(result) // C7
})

// CLEAN: compare against an expected value
test('C7 clean', () => {
  expect(getName()).toBe('Alice')
})

// CLEAN (not C7): two separate calls - tests caching / identity behavior
test('C7 clean - caching', () => {
  expect(loadModule()).toBe(loadModule()) // verifies the loader returns a cached instance
})


// --- C8: exact equality on a float -----------------------------------------

// BAD: floating-point arithmetic makes exact equality unreliable
test('C8 - float exact', () => {
  expect(computeRatio()).toBe(3.14159) // C8 - may fail on rounding (0.1 + 0.2 problem)
})

// CLEAN: toBeCloseTo tolerates floating-point drift
test('C8 clean', () => {
  expect(computeRatio()).toBeCloseTo(3.14159, 5)
})

// CLEAN: 0 and 1 are safe exact sentinels
test('C8 clean - sentinels', () => {
  expect(emptyRatio()).toBe(0)
  expect(fullRatio()).toBe(1)
})


// --- C9: toThrow() with no error type or message ---------------------------

// BAD: bare toThrow passes for any error - including a typo in the test itself
test('C9 - bare toThrow', () => {
  expect(() => divide(a, b)).toThrow() // C9 - any throw passes, even an unrelated bug
})

// CLEAN: assert the error type and message
test('C9 clean', () => {
  expect(() => divide(10, 0)).toThrow(/division by zero/)
})

// CLEAN: specific error class
test('C9 clean - error class', () => {
  expect(() => divide(10, 0)).toThrow(RangeError)
})


// --- C18: stringified equality ---------------------------------------------

// BAD: String(obj) couples to the toString format, not the real values
test('C18 - String() compare', () => {
  const user = getUser(1)
  expect(String(user)).toBe('User(Alice, 30)') // C18 - checks formatting, not identity
})

// BAD: JSON.stringify is brittle - key order and serialization changes break it
test('C18 - JSON.stringify compare', () => {
  expect(JSON.stringify(getConfig())).toBe('{"debug":true,"level":"info"}') // C18
})

// BAD: template literal flattens the value to a string
test('C18 - template literal', () => {
  const ratio = computeRatio()
  expect(`${ratio.toFixed(2)}`).toBe('3.14') // C18 - repr formatting, not the number
})

// CLEAN: compare the structured value with toEqual / attributes
test('C18 clean', () => {
  const user = getUser(1)
  expect(user.name).toBe('Alice')
  expect(user.age).toBe(30)
})

// CLEAN: toEqual does deep value comparison without stringifying
test('C18 clean - toEqual', () => {
  expect(getConfig()).toEqual({ debug: true, level: 'info' })
})


// --- JS3: snapshot is the only assertion -----------------------------------

// BAD: toMatchSnapshot records whatever the component renders today, bugs
// included. The first run sets the baseline as "correct" with no oracle.
test('JS3 - snapshot only', () => {
  const { container } = render(<PriceTag amount={100} />)
  expect(container).toMatchSnapshot() // JS3 - no explicit assertion on the value
})

// CLEAN: snapshot is fine as a supplement, but assert the meaningful value too
test('JS3 clean', () => {
  render(<PriceTag amount={100} />)
  expect(screen.getByTestId('total')).toHaveTextContent('$110.00') // explicit oracle
})


// --- JS15: comparison wrapped in a boolean (expect(a === b).toBe(true)) ----

// BAD: the === is evaluated to a boolean before expect sees it. On failure
// Jest reports "false is not true" with no values, and a typo'd comparison
// (=== vs ==) hides silently.
test('JS15 - boolean-wrapped equality', () => {
  const result = compute()
  expect(result === 42).toBe(true) // JS15 - opaque, weak diagnostics
})

// BAD: negated form
test('JS15 - boolean-wrapped inequality', () => {
  expect(getStatus() !== 'error').toBe(true) // JS15
})

// CLEAN: let the matcher do the comparison so it can report both sides
test('JS15 clean', () => {
  expect(compute()).toBe(42)
})
