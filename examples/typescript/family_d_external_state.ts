/**
 * Family D - Green depends on outside factors.
 * Codes: C16, C23
 *
 * The result hinges on the clock, randomness, a real filesystem path, or a
 * hard-coded URL. The test can pass or fail for reasons unrelated to the code.
 *
 * TypeScript, Jest/Vitest idioms. Referenced symbols are illustrative.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { isExpired, pickWinner, fetchUser, parse, process } from './mymodule';

// ─── C16: depends on Date.now / Math.random / fixed timer ────────────────────

// BAD: Date.now() is the real wall clock. The expected value drifts with time
// and the test gives no real coverage of the expiry logic.
it('BAD c16 real Date.now', () => {
  const token = { issuedAt: Date.now() };
  expect(isExpired(token, 3600)).toBe(false); // C16 - clock not controlled
});

// BAD: Math.random() without a seed - the assertion only checks membership
it('BAD c16 Math.random', () => {
  const winner = pickWinner(candidates); // uses Math.random internally
  expect(candidates).toContain(winner); // C16 - passes but proves nothing specific
});

// BAD: a real setTimeout wall-clock wait makes the test flaky under CI load
it('BAD c16 setTimeout wait', async () => {
  startTask();
  await new Promise((r) => setTimeout(r, 100)); // C16 - fragile timing
  expect(taskDone()).toBe(true);
});

// CLEAN: fake the timer so "now" is fixed and deterministic
describe('isExpired (CLEAN - faked timers)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('CLEAN c16 faked clock', () => {
    const token = { issuedAt: Date.now() }; // fixed to 2024-01-01
    expect(isExpired(token, 3600)).toBe(false);
  });
});

// CLEAN: seed randomness by stubbing Math.random, then assert the exact pick
it('CLEAN c16 seeded random', () => {
  const spy = vi.spyOn(Math, 'random').mockReturnValue(0.0); // deterministic
  expect(pickWinner(candidates)).toBe(candidates[0]);
  spy.mockRestore();
});


// ─── C23: reads a real file at a literal path / hard-coded URL ───────────────

// BAD: an absolute path that exists on one machine and not in CI (mystery guest)
it('BAD c23 absolute path', () => {
  const data = readFileSync('/home/user/fixtures/data.csv', 'utf8'); // C23
  expect(parse(data)).toEqual(expected);
});

// BAD: a hard-coded remote URL - the test talks to a live service
it('BAD c23 hard-coded url', async () => {
  const res = await fetch('https://api.example.com/user/1'); // C23 - real network
  const user = await res.json();
  expect(user.name).toBe('Alice');
});

// CLEAN: resolve a fixture relative to the test file
it('CLEAN c23 fixture relative path', () => {
  const fixture = new URL('./fixtures/data.csv', import.meta.url);
  const data = readFileSync(fixture, 'utf8');
  expect(parse(data)).toEqual(expected);
});

// CLEAN: write a temp file the test owns, then read it back
it('CLEAN c23 temp file', async () => {
  const { mkdtemp, writeFile, readFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'fg-'));
  const file = join(dir, 'data.csv');
  await writeFile(file, 'a,b\n1,2');
  expect(parse(await readFile(file, 'utf8'))).toEqual(expected);
});

// CLEAN: mock the network so the URL never hits a live service
it('CLEAN c23 mocked fetch', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: async () => ({ id: 1, name: 'Alice' }),
  }));
  const user = await fetchUser(1);
  expect(user.name).toBe('Alice');
  vi.unstubAllGlobals();
});


// ─── Placeholder stubs ────────────────────────────────────────────────────────

declare const candidates: string[];
declare const expected: unknown;
declare function startTask(): void;
declare function taskDone(): boolean;
