/**
 * Family E - The test passes but checks the wrong thing.
 *
 * This file is the structural bridge to the semantic layer. The patterns here
 * are still catchable by a careful structural reader: identity-vs-value
 * confusion (toBe on objects) and asserting a stubbed value straight back.
 *
 * The truly semantic cases - where the EXPECTED value contradicts the intent
 * and only an oracle (spec, docstring, sibling test) can tell right from wrong
 * - live in semantic_cases.js and need the LLM pass.
 *
 * Jest / Vitest idioms. Function names (buildConfig, getUser, getPrice) are
 * placeholders.
 */


// --- toBe vs toEqual on objects: identity instead of value -----------------

// BAD: toBe uses Object.is (reference identity). Two structurally equal objects
// are different references, so this compares identity, not the values the test
// claims to check. It happens to pass only when both sides are the SAME object.
test('config matches expected (BAD: toBe on objects)', () => {
  const expected = { debug: true, level: 'info' }
  const config = expected // same reference - the only way toBe passes here
  expect(config).toBe(expected) // checks identity, not that buildConfig is correct
})

// BAD subtler: the test means to compare values but toBe will fail for equal
// objects from different sources - then someone "fixes" it by aliasing, which
// silently turns it into an identity check that proves nothing.
test('build returns the right config (BAD: aliased to pass toBe)', () => {
  const config = buildConfig()
  const expected = config // aliasing to make toBe pass - now a tautology
  expect(config).toBe(expected) // always true, buildConfig output never verified
})

// CLEAN: toEqual does a deep value comparison
test('build returns the right config (CLEAN: toEqual)', () => {
  expect(buildConfig()).toEqual({ debug: true, level: 'info' })
})

// CLEAN (not a smell): toBe is correct for primitives and for deliberate
// identity checks (same cached instance, same enum member)
test('loader is cached (CLEAN: toBe is the point)', () => {
  expect(loadModule()).toBe(loadModule()) // identity IS the contract here
})


// --- asserting a stubbed value straight back -------------------------------

// BAD: the test stubs getUser to return a fixed object, then asserts the SUT
// returned that same object. If getUserName just forwards the stub, the check
// passes whether or not any real logic ran. Structural readers can spot the
// echo: the expected value is the stub's return.
test('getUserName returns the name (BAD: echoes the stub)', () => {
  jest.spyOn(db, 'fetchUser').mockReturnValue({ id: 1, name: 'Alice' })
  expect(getUserName(1)).toBe('Alice') // 'Alice' was fed in via the stub
})

// CLEAN: stub the raw input, assert a value the SUT had to DERIVE
test('formatUserLabel derives a label (CLEAN: asserts a transform)', () => {
  jest.spyOn(db, 'fetchUser').mockReturnValue({ id: 1, name: 'alice', tier: 2 })
  expect(formatUserLabel(1)).toBe('Alice (gold)') // derived: capitalize + tier->name
})


// --- JS27: toHaveBeenCalled* as the sole oracle on a local double ----------

// BAD: the only check is that a locally-created spy was called. That verifies
// the wiring (run invokes its callback) but nothing about the unit's output or
// behavior. Distinct from JS8: the SUT is not mocked here - the assertion
// simply targets call-tracking instead of a returned value.
test('JS27 - only asserts the spy was called', () => {
  const spy = jest.fn()
  run(spy)
  expect(spy).toHaveBeenCalled() // JS27 - wiring only, no behavior checked
})

// BAD: toHaveBeenNthCalledWith carrying only the call index is still a bare
// counter - it asserts an Nth call happened, not any argument value.
test('JS27 - nth call index only', () => {
  const spy = jest.fn()
  run(spy)
  expect(spy).toHaveBeenNthCalledWith(1) // JS27 - index only, no argument asserted
})

// CLEAN: assert the unit's own output alongside the call
test('JS27 clean - also asserts the result', () => {
  const spy = jest.fn()
  const result = run(spy)
  expect(spy).toHaveBeenCalled()
  expect(result).toBe(2) // behavior is verified, not just wiring
})

// CLEAN: toHaveBeenCalledWith carrying real arguments checks the contract of
// the call, not merely that it happened.
test('JS27 clean - asserts the call arguments', () => {
  const spy = jest.fn()
  submit(spy, { id: 1 })
  expect(spy).toHaveBeenCalledWith({ id: 1 }) // the arguments are the contract
})


// --- pointer to the semantic layer -----------------------------------------

// The next step up is invisible to structure alone. When getPrice(product)
// returns product.price unchanged, `expect(getPrice(p)).toBe(p.price)` looks
// like a normal value assertion - nothing structural is off. Only reasoning
// about intent (is the SUT supposed to transform the value, or pass it through?)
// reveals the tautology. Those cases - echo, re-implemented formula,
// spec-contradicting expected value, order-dependent green - are in
// semantic_cases.js and require the LLM semantic pass to flag.
