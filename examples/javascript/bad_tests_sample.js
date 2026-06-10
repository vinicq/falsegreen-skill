/**
 * False-positive test patterns in JavaScript/Jest.
 *
 * Covers: C10 (mock hoisting, ESM dynamic import), J1 (done() in finally,
 * floating promise), C6 (weak assertion on dynamic property), C27 (swallowed
 * exception via try/catch).
 *
 * Every BAD test passes green but does not verify correct behavior.
 * CLEAN alternatives follow each bad pattern.
 *
 * Function names (fetchData, processOrder, db, getUser, parse, buildResponse)
 * are placeholders -- assume they are imported or defined elsewhere.
 * Patterns apply to Jest (noted where Mocha/Chai differs).
 */


// ─── C10: CJS jest.mock hoisting trap ────────────────────────────────────────

// BAD: jest.mock is hoisted above the require(), so the require gets the mock.
// processOrder is already jest.fn() when the module loads -- the real function
// never runs. The test only exercises the mock configuration, not the SUT.
const { processOrder } = require('./orders')
jest.mock('./orders') // hoisted to top of file by babel-jest / jest transform

test('processOrder returns confirmation', () => {
  processOrder.mockReturnValue({ ok: true })
  expect(processOrder({ id: 1 })).toEqual({ ok: true }) // C10 -- tests the mock config
})

// CLEAN: mock a dependency of orders (the db layer), not orders itself.
// The real processOrder implementation runs; only db.save is replaced.
const { db } = require('./db')
jest.mock('./db')

test('processOrder saves to db', async () => {
  db.save.mockResolvedValue({ id: 42 })
  const { processOrder: realProcessOrder } = jest.requireActual('./orders')
  const result = await realProcessOrder({ item: 'widget' })
  expect(result.id).toBe(42) // asserts on a derived result, not on the mock value
})


// ─── C10: ESM dynamic import mock (Jest ESM mode) ────────────────────────────

// BAD: jest.unstable_mockModule replaces the module under test, then the test
// imports and calls it directly. All assertions land on the mock, not on any
// real logic. Works the same as the CJS hoisting trap -- just ESM syntax.
//
// (Mocha/Chai: same risk with esmock or proxyquire replacing the SUT.)

describe('C10 -- ESM mock', () => {
  beforeAll(() => {
    jest.unstable_mockModule('./formatter', () => ({
      formatDate: jest.fn(() => '2024-01-01'), // BAD: mocking the SUT
    }))
  })

  test('formatDate returns formatted string', async () => {
    const { formatDate } = await import('./formatter') // gets the mock
    expect(formatDate(new Date())).toBe('2024-01-01') // C10 -- tests mock config
  })
})

// CLEAN: mock the dependency (the locale adapter), import the real formatter.
describe('C10 -- ESM mock clean', () => {
  beforeAll(() => {
    jest.unstable_mockModule('./localeAdapter', () => ({
      getLocale: jest.fn(() => 'en-US'), // mocking a dependency, not the SUT
    }))
  })

  test('formatDate uses locale from adapter', async () => {
    const { formatDate } = await import('./formatter') // real implementation
    const result = formatDate(new Date('2024-01-01T00:00:00Z'))
    expect(result).toMatch(/2024/) // asserts on behavior, not on mock value
  })
})


// ─── J1: done() in finally (callback-based async) ────────────────────────────

// BAD: done() fires in the finally block, so it runs even when expect() throws.
// The test exits green whether or not the assertion passed.
//
// (Mocha/Chai: same trap -- done() in finally always resolves the test.)
test('async callback delivers data', (done) => {
  fetchData((err, data) => {
    try {
      expect(data.status).toBe('ok')
    } finally {
      done() // J1 -- done fires even if expect threw; assertion failure is silenced
    }
  })
})

// CLEAN (option A): return a Promise -- no done() needed.
// Jest/Mocha both treat a returned Promise as the test boundary.
test('async callback delivers data -- promise clean', () => {
  return new Promise((resolve, reject) => {
    fetchData((err, data) => {
      if (err) return reject(err)
      try {
        expect(data.status).toBe('ok')
        resolve()
      } catch (e) {
        reject(e) // assertion error propagates -- test fails correctly
      }
    })
  })
})

// CLEAN (option B): done only in the success branch; done.fail in catch.
test('async callback delivers data -- done.fail clean', (done) => {
  fetchData((err, data) => {
    if (err) return done.fail(err)
    try {
      expect(data.status).toBe('ok')
      done()
    } catch (e) {
      done.fail(e) // not done() -- prevents silent green on assertion error
    }
  })
})


// ─── J1: floating promise (unhandled rejection) ───────────────────────────────

// BAD: db.save is async but is not awaited and not returned.
// The test function returns undefined synchronously, Jest marks it green,
// and the rejection (if any) fires after the test boundary.
//
// (Mocha/Chai without --allow-uncaught: same behavior -- test exits before reject.)
const record = { id: 1, name: 'widget' }

test('saves the record', () => {
  db.save(record) // J1 -- async, not awaited; rejection is unhandled
  expect(db.records).toHaveLength(1) // checks state before async write completes
})

// CLEAN: await the async call so the test body suspends until it settles.
test('saves the record -- await clean', async () => {
  await db.save(record)
  expect(db.records).toHaveLength(1) // state is settled before assertion
})

// CLEAN: returning the promise also works (no async/await required).
test('saves the record -- return clean', () => {
  return db.save(record).then(() => {
    expect(db.records).toHaveLength(1)
  })
})


// ─── C6: dynamic property access with weak assertion ─────────────────────────

// BAD: toBeTruthy() on a dynamic property passes for 'admin', 'guest',
// the string 'undefined', 0, or anything except null/false/empty-string/''.
// The bracket notation alone does not indicate a C6 smell -- the weak check does.
test('user has a role', () => {
  const user = getUser(1)
  expect(user['role']).toBeTruthy() // C6 -- passes for any truthy value, including wrong ones
})

// CLEAN: assert the exact expected value.
test('user has the correct role', () => {
  const user = getUser(1)
  expect(user.role).toBe('admin')
})

// CLEAN (not C6): toHaveProperty checks that the key exists on the object.
// Checking key existence is a meaningful assertion, not a weak one.
test('response has required fields', () => {
  const response = buildResponse()
  expect(response).toHaveProperty('status') // existence check -- not weak
  expect(response).toHaveProperty('data')
})

// CLEAN (not C6): toBeDefined() is meaningful when the contract says
// "this field must be present" without prescribing its value.
test('user object has a name field', () => {
  const user = getUser(1)
  expect(user.name).toBeDefined()
  expect(typeof user.name).toBe('string')
})


// ─── C27: try/catch/pass instead of expect().toThrow() ───────────────────────

// BAD: if parse(null) does NOT throw, execution skips the catch block and the
// test exits green with zero assertions. Both paths (throws / does not throw)
// leave the test green.
//
// (Mocha/Chai: same trap -- empty catch swallows the assertion failure.)
test('throws on invalid input', () => {
  try {
    parse(null)
  } catch (e) {
    // C27 -- swallowed. If parse(null) doesn't throw, test still passes.
  }
})

// BAD: the catch asserts on the message, but if parse(null) does not throw,
// no assertion runs at all. C2 (no assertion) and C27 at the same time.
test('error message is correct', () => {
  try {
    parse(null)
    // if parse does not throw, execution falls through here -- no assertion runs
  } catch (e) {
    expect(e.message).toBe('input required')
  }
})

// CLEAN: Jest/Vitest idiomatic -- expect().toThrow() handles both the throw
// check and the message check in one readable assertion.
test('throws on invalid input -- clean', () => {
  expect(() => parse(null)).toThrow('input required')
})

// CLEAN: async variant -- rejectsWith for async functions that reject.
test('async parse rejects on invalid input -- clean', async () => {
  await expect(parseAsync(null)).rejects.toThrow('input required')
})

// CLEAN: if you need the error object for further inspection, use a manual
// try/catch but always add a fail-safe assertion before the try block.
test('throws ValidationError with code -- clean', () => {
  expect.assertions(2) // guards against the empty-catch path
  try {
    parse(null)
  } catch (e) {
    expect(e).toBeInstanceOf(ValidationError)
    expect(e.code).toBe('ERR_NULL_INPUT')
  }
})


// ─── Placeholder stubs (not imported -- defined inline for IDE clarity) ───────

function fetchData(cb) { cb(null, { status: 'ok' }) }
function processOrder() {}
function getUser(id) { return { id, role: 'admin', name: 'Alice' } }
function buildResponse() { return { status: 200, data: {} } }
function parse(input) { if (input === null) throw new Error('input required') }
async function parseAsync(input) { if (input === null) throw new Error('input required') }
class ValidationError extends Error { constructor(msg, code) { super(msg); this.code = code } }
