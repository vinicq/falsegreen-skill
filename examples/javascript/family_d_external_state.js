/**
 * Family D - Green depends on outside factors.
 * Codes: C16, C23
 *
 * The result rides on the wall clock, randomness, a real file at a fixed path,
 * or a hard-coded remote URL. The test can flip between green and red without
 * any change to the production code.
 *
 * Jest / Vitest idioms. Function names (isExpired, pickWinner, parse, fetchUser)
 * are placeholders.
 */

const fs = require('node:fs')
const path = require('node:path')


// --- C16: depends on Date.now / Math.random / a fixed timer ----------------

// BAD: Date.now() is the live clock, so this test means something different
// every run. Today it is green; at a TTL boundary it flips.
test('C16 - live Date.now', () => {
  const issuedAt = Date.now()
  expect(isExpired(issuedAt, 0)).toBe(false) // C16 - clock not frozen, flaky
})

// BAD: Math.random with no seed - the assertion only checks membership, so it
// passes by luck and proves nothing about the selection logic.
test('C16 - unseeded random', () => {
  const winner = pickWinner(candidates) // uses Math.random internally
  expect(candidates).toContain(winner) // C16 - vacuous, any candidate passes
})

// BAD: real setTimeout makes the test race CI load
test('C16 - real timer', (done) => {
  startTask()
  setTimeout(() => {
    expect(taskDone()).toBe(true) // C16 - fragile wall-clock wait
    done()
  }, 100)
})

// CLEAN: fake timers freeze the clock to a known instant
test('C16 clean - fake timers', () => {
  jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'))
  const issuedAt = Date.now()
  expect(isExpired(issuedAt, 3600)).toBe(false) // deterministic
  jest.useRealTimers()
})

// CLEAN: stub Math.random to a fixed draw, then assert the exact winner
test('C16 clean - seeded random', () => {
  jest.spyOn(Math, 'random').mockReturnValue(0.0) // first candidate
  expect(pickWinner(candidates)).toBe(candidates[0]) // exact, reproducible
})

// CLEAN: advance fake timers instead of waiting on the real clock
test('C16 clean - advance timers', () => {
  jest.useFakeTimers()
  startTask()
  jest.advanceTimersByTime(100)
  expect(taskDone()).toBe(true)
  jest.useRealTimers()
})


// --- C23: reads a real file at a literal path / hard-coded URL --------------

// BAD: an absolute path that exists on the author's machine but not in CI
test('C23 - absolute file path', () => {
  const data = fs.readFileSync('/home/user/fixtures/data.csv', 'utf8') // C23
  expect(parse(data)).toEqual(expected)
})

// BAD: home-relative path - same mystery guest problem
test('C23 - home-relative path', () => {
  const home = require('node:os').homedir()
  const data = fs.readFileSync(path.join(home, 'data', 'fixture.json'), 'utf8') // C23
  expect(process(data)).toEqual(expected)
})

// BAD: hard-coded remote URL - the test hits a live server it does not control
test('C23 - hard-coded URL', async () => {
  const res = await fetch('https://api.example.com/user/1') // C23 - real network call
  const user = await res.json()
  expect(user.name).toBe('Alice') // green or red depends on the remote server
})

// CLEAN: resolve a fixture relative to this test file
test('C23 clean - fixture beside the test', () => {
  const fixture = path.join(__dirname, 'fixtures', 'data.csv')
  const data = fs.readFileSync(fixture, 'utf8')
  expect(parse(data)).toEqual(expected)
})

// CLEAN: write to a temp dir the test owns and cleans up
test('C23 clean - temp file', () => {
  const tmp = path.join(require('node:os').tmpdir(), `fg-${Date.now()}.csv`)
  fs.writeFileSync(tmp, 'a,b\n1,2')
  try {
    expect(parse(fs.readFileSync(tmp, 'utf8'))).toEqual(expected)
  } finally {
    fs.unlinkSync(tmp)
  }
})

// CLEAN: stub the network instead of reaching a hard-coded URL
test('C23 clean - mocked fetch', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    json: async () => ({ id: 1, name: 'Alice' }),
  })
  const user = await fetchUser(1)
  expect(user.name).toBe('Alice') // deterministic, no live server
})
