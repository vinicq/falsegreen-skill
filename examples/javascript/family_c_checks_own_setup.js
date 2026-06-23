/**
 * Family C - The test checks its own setup, not the program.
 * Codes: JS8
 *
 * The test mocks the very unit it claims to test, then asserts the mock's
 * configured return value. The real implementation never runs, so the test
 * passes no matter how broken the production code is.
 *
 * Jest / Vitest idioms. Function names (processOrder, formatDate, getUser, db)
 * are placeholders. jest.mock hoists above the require/import.
 */


// --- JS8: mocks the unit under test and asserts it directly (CommonJS) -----

// BAD: jest.mock('./orders') replaces processOrder with a jest.fn() before the
// module loads. The test configures the mock and asserts the mock value back.
// processOrder's real logic is never exercised.
const { processOrder } = require('./orders')
jest.mock('./orders') // hoisted to the top; processOrder is a mock here

test('JS8 - asserts the mocked SUT', () => {
  processOrder.mockReturnValue({ ok: true })
  expect(processOrder({ id: 1 })).toEqual({ ok: true }) // JS8 - tests the mock config
})

// CLEAN: mock a collaborator (the db layer), run the REAL processOrder.
// Only db.save is replaced; the unit under test still executes.
const { db } = require('./db')
jest.mock('./db')

test('JS8 clean - mocks the collaborator, runs the real SUT', async () => {
  db.save.mockResolvedValue({ id: 42 })
  const { processOrder: realProcessOrder } = jest.requireActual('./orders')
  const result = await realProcessOrder({ item: 'widget' })
  expect(result.id).toBe(42) // asserts a derived result, not the mock value
})


// --- JS8: ESM module mock variant ------------------------------------------

// BAD: unstable_mockModule replaces the SUT module, then the test imports and
// calls it. Every assertion lands on the mock, not on real logic.
describe('JS8 - ESM mocks the SUT', () => {
  beforeAll(() => {
    jest.unstable_mockModule('./formatter', () => ({
      formatDate: jest.fn(() => '2024-01-01'), // JS8 - mocking the SUT itself
    }))
  })

  test('formatDate returns a formatted string', async () => {
    const { formatDate } = await import('./formatter') // gets the mock
    expect(formatDate(new Date())).toBe('2024-01-01') // JS8 - tests the mock
  })
})

// CLEAN: mock the dependency (the locale adapter), import the real formatter
describe('JS8 clean - ESM mocks the dependency', () => {
  beforeAll(() => {
    jest.unstable_mockModule('./localeAdapter', () => ({
      getLocale: jest.fn(() => 'en-US'), // a real collaborator, not the SUT
    }))
  })

  test('formatDate uses the locale from the adapter', async () => {
    const { formatDate } = await import('./formatter') // real implementation
    const result = formatDate(new Date('2024-01-01T00:00:00Z'))
    expect(result).toMatch(/2024/) // asserts behavior, not a mock value
  })
})


// --- JS8: spying on the SUT then asserting the spy --------------------------

// BAD: spyOn replaces getUser's implementation with a stub, then the test
// asserts the stubbed return. The module's own getUser logic is bypassed.
const orders = require('./orders')

test('JS8 - spy replaces the SUT', () => {
  jest.spyOn(orders, 'getUser').mockReturnValue({ id: 1, name: 'Alice' })
  expect(orders.getUser(1)).toEqual({ id: 1, name: 'Alice' }) // JS8 - asserts the stub
})

// CLEAN: spy on a collaborator the SUT calls, then assert the SUT's output
test('JS8 clean - spy on a collaborator', () => {
  jest.spyOn(db, 'fetch').mockReturnValue({ id: 1, name: 'Alice' })
  const summary = orders.getUserSummary(1) // real function under test
  expect(summary).toBe('Alice (#1)') // derived from the stubbed dependency
})
