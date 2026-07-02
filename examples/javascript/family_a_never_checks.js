/**
 * Family A - The test never checks anything.
 * Codes: C2, C2b, C20, C21, CC, JS1, JS2, JS4, JS5, JS6, JS7, JS9, JS11, JS13, JS17, JS18, JS21, JS22, JS23, JS25, JS26, JS29, JS31
 *
 * The assertion is missing, skipped, swallowed, never awaited, or never
 * collected by the runner. The test reports green whether or not the code
 * is correct.
 *
 * Jest / Vitest idioms primarily, with Testing Library and Mocha where natural.
 * Function names (getItems, createUser, process, db, render, findByText) are
 * placeholders: assume they are imported elsewhere. The examples never run.
 */


// --- C2: test with no assertion at all -------------------------------------

// BAD: only proves the call didn't throw, never checks what came back
test('C2 - creates a user', () => {
  createUser('Alice') // C2 - no expect(), always green
})

// BAD: empty body
test('C2 - empty body', () => {}) // C2 - nothing runs

// CLEAN: assert the result
test('C2 clean', () => {
  const user = createUser('Alice')
  expect(user.name).toBe('Alice')
})


// --- C2b: calls the unit but never asserts the result ----------------------

// BAD: result discarded
test('C2b - discards result', () => {
  const result = process(data) // C2b - result never asserted
})

// BAD: setup only, no check on what was saved
test('C2b - setup only', () => {
  const user = createUser('Alice')
  db.save(user) // C2b - no assertion on the saved state
})

// CLEAN
test('C2b clean', () => {
  const result = process(data)
  expect(result.status).toBe('ok')
})


// --- C20: assertion in dead code after return/throw ------------------------

// BAD: unreachable expect after return
test('C20 - dead assert after return', () => {
  const result = compute()
  return
  expect(result).toBe(42) // C20 - dead code, never runs
})

// BAD: unreachable after throw
test('C20 - dead assert after throw', () => {
  throw new Error('TODO')
  expect(compute()).toBe(42) // C20 - never reached
})

// CLEAN: assertion runs before any return
test('C20 clean', () => {
  expect(compute()).toBe(42)
})


// --- C21: every assertion is conditional, none runs unconditionally --------

// BAD: the only assertion sits inside the if, so when result is falsy the test
// runs zero assertions and still passes green.
test('C21 - all conditional', () => {
  const result = fetch()
  if (result) {
    expect(result.status).toBe('ok') // C21 - skipped when result is falsy
  }
})

// CLEAN: unconditional check first
test('C21 clean', () => {
  const result = fetch()
  expect(result).not.toBeNull() // runs every time
  expect(result.status).toBe('ok')
})


// --- CC: commented-out assertion -------------------------------------------

// BAD
test('CC - commented assertion', () => {
  const result = compute()
  // expect(result).toBe(42) // CC - check disabled, test always green
  log(result)
})

// CLEAN
test('CC clean', () => {
  const result = compute()
  expect(result).toBe(42)
})


// --- JS1: focused test (it.only / fit) silently skips the rest -------------

// BAD: it.only makes Jest run ONLY this test; every sibling test is skipped
// and stops protecting. Usually left behind from a debugging session.
it.only('JS1 - focused, skips the suite', () => { // JS1 - only this runs
  expect(compute()).toBe(42)
})

it('JS1 - this sibling never runs while .only is present', () => {
  expect(processOrder()).toBe(true) // silently skipped
})

// CLEAN: no focus marker, all tests in the suite run
it('JS1 clean', () => {
  expect(compute()).toBe(42)
})


// --- JS2: expect(x) with no matcher ----------------------------------------

// BAD: expect() returns a matcher object; with no matcher called, nothing
// is verified and the statement is a no-op.
test('JS2 - no matcher', () => {
  const result = compute()
  expect(result) // JS2 - no .toBe(...), checks nothing
})

// CLEAN
test('JS2 clean', () => {
  expect(compute()).toBe(42)
})


// --- JS4: skipped test (it.skip / xit / it.todo) ---------------------------

// BAD: permanently skipped, no reason, never revisited
it.skip('JS4 - skipped', () => { // JS4
  expect(compute()).toBe(42)
})

// BAD: xit alias
xit('JS4 - xit', () => { // JS4
  expect(process(data)).toBe('ok')
})

// BAD: todo with no body, easy to forget
it.todo('JS4 - implement discount rounding') // JS4

// CLEAN: an enabled test, or a skip with an explicit linked reason
it('JS4 clean', () => {
  expect(compute()).toBe(42)
})


// --- JS5: async query/event not awaited (Testing Library) ------------------

// BAD: findByText returns a Promise; without await the assertion runs on the
// pending Promise (always truthy) and the real DOM check never happens.
test('JS5 - findBy not awaited', () => {
  render(<Profile />)
  const node = screen.findByText('Alice') // JS5 - missing await
  expect(node).toBeTruthy() // asserts a Promise object, not the element
})

// BAD: waitFor not awaited - the callback may never settle before the test ends
test('JS5 - waitFor not awaited', () => {
  render(<Profile />)
  waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument()) // JS5
})

// BAD: user-event returns a Promise that is dropped
test('JS5 - user-event not awaited', () => {
  render(<Form />)
  userEvent.click(screen.getByRole('button')) // JS5 - not awaited
  expect(screen.getByText('Saved')).toBeInTheDocument()
})

// CLEAN: await every async query and interaction
test('JS5 clean', async () => {
  render(<Profile />)
  await userEvent.click(screen.getByRole('button'))
  expect(await screen.findByText('Saved')).toBeInTheDocument()
})


// --- JS6: empty describe / suite -------------------------------------------

// BAD: a describe block with no test inside reports green and protects nothing
describe('JS6 - order processing', () => {
  // JS6 - no it()/test() inside; suite is hollow
})

// CLEAN: the describe holds at least one real test
describe('JS6 clean - order processing', () => {
  it('computes the total', () => {
    expect(total(buildOrder())).toBe(27)
  })
})


// --- JS7: assertion in a non-awaited setTimeout / then callback ------------

// BAD: the expect fires inside a setTimeout that the test does not wait for.
// The test body returns first; the callback runs after the test boundary and
// its failure is ignored.
test('JS7 - assertion in setTimeout', () => {
  startTask()
  setTimeout(() => {
    expect(taskDone()).toBe(true) // JS7 - runs after the test already passed
  }, 10)
})

// BAD: assertion only inside a floating .then()
test('JS7 - assertion in dropped then', () => {
  fetchValue().then((v) => {
    expect(v).toBe(42) // JS7 - promise not returned/awaited, assertion may never run
  })
})

// CLEAN: await the timer (fake timers) or return/await the promise
test('JS7 clean', async () => {
  const v = await fetchValue()
  expect(v).toBe(42)
})


// --- JS9: assertion in a dead literal branch (if (false)) ------------------

// BAD: the branch guard is a literal false, so the assertion is unreachable
test('JS9 - dead literal branch', () => {
  const result = compute()
  if (false) { // JS9 - literally never true
    expect(result).toBe(42)
  }
})

// BAD: while(false) is equally dead
test('JS9 - dead while', () => {
  while (false) {
    expect(process(data)).toBe('ok') // JS9
  }
})

// CLEAN: a real runtime condition, with an unconditional check too
test('JS9 clean', () => {
  const result = compute()
  expect(result).toBe(42)
})


// --- JS11: try/catch swallows the assertion --------------------------------

// BAD: an empty catch absorbs the AssertionError; the test stays green even
// when the expect fails or when the SUT never throws.
test('JS11 - swallowed assertion', () => {
  try {
    expect(compute()).toBe(42) // JS11 - if this throws, the catch eats it
  } catch (e) {
    // swallowed, test still green
  }
})

// CLEAN: the try wraps only the SUT call (not the assertion), and the catch
// re-throws instead of returning, so the assertion afterward always runs.
test('JS11 clean', () => {
  let result
  try {
    result = riskyParse()
  } catch (e) {
    throw e // never swallow; let a real failure fail the test
  }
  expect(result).not.toBeNull() // runs unconditionally - no early return skips it
})


// --- JS13: getBy* / queryBy* query as a loose statement, never asserted ----

// BAD: getByText throws if the element is missing, so it looks like a check,
// but as a bare statement it verifies nothing about the element's content
// or state - and queryBy* does not even throw.
test('JS13 - query never asserted', () => {
  render(<Profile />)
  screen.getByText('Alice') // JS13 - result dropped, nothing asserted
  screen.queryByRole('alert') // JS13 - queryBy returns null silently, no throw
})

// CLEAN: assert on the queried element
test('JS13 clean', () => {
  render(<Profile />)
  expect(screen.getByText('Alice')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})


// --- JS17: commented-out test block ----------------------------------------

// BAD: an entire test commented out is invisible coverage; it reads as a
// passing suite but the case is gone.
// it('JS17 - validates the discount path', () => {   // JS17
//   expect(applyDiscount(200, 0.15)).toBe(170)
// })

// CLEAN: the test is enabled
it('JS17 clean', () => {
  expect(applyDiscount(200, 0.15)).toBe(170)
})


// --- JS18: done callback instead of async/await ----------------------------

// BAD: done() is called outside the assertion's success path. If expect throws,
// done() in finally still resolves the test green; the failure is lost.
test('JS18 - done in finally', (done) => {
  fetchData((err, data) => {
    try {
      expect(data.status).toBe('ok')
    } finally {
      done() // JS18 - resolves even when expect threw
    }
  })
})

// CLEAN: drop the done callback, use async/await
test('JS18 clean', async () => {
  const data = await fetchDataAsync()
  expect(data.status).toBe('ok')
})


// --- JS21: matcher referenced but never called (no parentheses) ------------

// BAD: .toBe is a function reference here, not a call. Nothing is compared.
test('JS21 - matcher not called', () => {
  const result = compute()
  expect(result).toBe // JS21 - missing (42), reads the matcher, runs nothing
})

// BAD: same trap with a spy matcher
test('JS21 - spy matcher not called', () => {
  const spy = jest.fn()
  doWork(spy)
  expect(spy).toHaveBeenCalled // JS21 - no (), check never executes
})

// CLEAN
test('JS21 clean', () => {
  const spy = jest.fn()
  doWork(spy)
  expect(spy).toHaveBeenCalled()
})


// --- JS22: empty it.each / test.each table ---------------------------------

// BAD: the table is empty, so the parametrized test runs zero times
test.each([])('JS22 - never runs for %p', (n) => { // JS22 - empty table
  expect(process(n)).toBeGreaterThan(0)
})

// CLEAN: populate the table
test.each([1, 2, 3])('JS22 clean - runs for %p', (n) => {
  expect(process(n)).toBeGreaterThan(0)
})


// --- JS23: expect.assertions(N) promises more asserts than actually run ----

// BAD: the count claims two assertions but only one runs unconditionally, so a
// second expect that gets skipped (early return, empty branch) goes unnoticed
// and the test still passes green.
test('JS23 - too few assertions for the count', async () => {
  expect.assertions(2) // JS23 - promises 2, only 1 unconditional expect below
  const result = await load()
  expect(result).toBe('ok')
})

// CLEAN: the promised count matches the unconditional expect calls
test('JS23 clean', async () => {
  expect.assertions(2)
  expect(await load()).toBe('ok')
  expect(await statusCode()).toBe(200)
})


// --- JS25: the only assertion lives inside an array-iterator callback -------

// BAD: forEach runs the callback once per element, so on an empty list it runs
// zero times and the test passes having checked nothing.
test('JS25 - assertion only in forEach', () => {
  getItems().forEach((item) => {
    expect(item.price).toBeGreaterThan(0) // JS25 - never runs if the list is empty
  })
})

// CLEAN: an own-scope assertion guards the empty-collection case
test('JS25 clean', () => {
  const items = getItems()
  expect(items).toHaveLength(3) // runs regardless of the loop
  items.forEach((item) => expect(item.price).toBeGreaterThan(0))
})


// --- JS26: fake timers installed but never advanced ------------------------

// BAD: the fake clock is installed, but nothing advances it, so the scheduled
// callback never fires and the assertion reads the un-mutated initial state.
test('JS26 - timers never advanced', () => {
  jest.useFakeTimers()
  let value = 0
  setTimeout(() => { value = 1 }, 100)
  expect(value).toBe(0) // JS26 - passes only because the timer never ran
})

// CLEAN: advance the timers so the callback fires before the assertion
test('JS26 clean', () => {
  jest.useFakeTimers()
  let value = 0
  setTimeout(() => { value = 1 }, 100)
  jest.advanceTimersByTime(100)
  expect(value).toBe(1)
})


// --- JS29: resolves/rejects chain not awaited or returned ------------------

// BAD: a bare expect(...).resolves chain returns a Promise the test drops. The
// runner marks the test done before the matcher settles, so a rejection or a
// wrong value never fails it.
test('JS29 - floating resolves', () => {
  expect(fetchValue()).resolves.toBe(42) // JS29 - not awaited, settles after the test
})

// BAD: same trap with rejects
test('JS29 - floating rejects', () => {
  expect(loadMissing()).rejects.toThrow('not found') // JS29 - dropped promise
})

// CLEAN: await the chain so the matcher settles inside the test
test('JS29 clean', async () => {
  await expect(fetchValue()).resolves.toBe(42)
})


// --- JS31: try/catch swallows a possible SUT throw, no assertion -----------

// BAD: if the unit stops throwing the try just succeeds; if it throws the empty
// catch eats it. Either way nothing is asserted, so the test stays green.
// Distinct from JS11: here the swallowed statement is the SUT call, not an
// expect() - so it is not a swallowed assertion, it is a swallowed throw.
test('JS31 - swallowed SUT throw', () => {
  try {
    withdraw(account, 1000) // expected to throw on overdraft
  } catch (e) {
    // JS31 - exception swallowed, nothing checked
  }
})

// CLEAN: assert on the caught exception, and guard with expect.assertions so a
// missing throw (catch never runs) also fails the test.
test('JS31 clean', () => {
  expect.assertions(1)
  try {
    withdraw(account, 1000)
  } catch (e) {
    expect(e).toBeInstanceOf(OverdraftError) // the throw is the contract
  }
})
