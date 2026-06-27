/**
 * Diagnostic and coupling codes - opt-in (OFF by default).
 * Codes: D1, D3, D4, D6, D7, D8, M2, C37
 *
 * These are NOT false-green. The test still protects against regressions; the
 * codes flag observability and maintainability problems. They run only on a
 * diagnostic pass, never as part of the default false-green detection.
 *
 * Enable with `severity = { D1 = "info" }` in the falsegreen config.
 *
 * TypeScript, Jest/Vitest idioms. Referenced symbols are illustrative.
 */

import { describe, it, test, expect } from 'vitest';
import { buildOrder, compute, fetchData } from './mymodule';

// ─── D1: Assertion Roulette (2+ asserts, none with a message) ────────────────

// BAD: when one of these fails, the output names only a line, not which check.
it('BAD d1 assertion roulette', () => {
  const order = buildOrder(items);
  expect(subtotal(order)).toBe(30); // D1 - which of the three failed?
  expect(discount(order)).toBe(3);  // D1
  expect(total(order)).toBe(27);    // D1
});

// CLEAN: each assertion carries a message
it('CLEAN d1 with messages', () => {
  const order = buildOrder(items);
  expect(subtotal(order), 'subtotal').toBe(30);
  expect(discount(order), 'discount').toBe(3);
  expect(total(order), 'total').toBe(27);
});


// ─── D3: Duplicate Assert (same assertion written twice) ─────────────────────

// BAD: the second assertion adds no coverage
it('BAD d3 duplicate assert', () => {
  const result = compute();
  expect(result).toBe(42); // D3 - first occurrence
  expect(result).toBe(42); // D3 - exact duplicate
});

// CLEAN: each assertion checks something distinct
it('CLEAN d3', () => {
  const result = compute();
  expect(result).toBe(42);
  expect(typeof result).toBe('number');
});


// ─── D4: Untitled it.each cases (no %/$ placeholder in the title) ─────────────

// BAD: a static title with no placeholder - every generated case shares the same
// name, so CI cannot tell them apart on failure.
it.each([
  ['alice', 'ALICE'],
  ['bob', 'BOB'],
  ['carol', 'CAROL'], // D4 - title has no placeholder, cases are indistinguishable
])('BAD d4 uppercases the input', (value, expected) => {
  expect(value.toUpperCase()).toBe(expected);
});

// CLEAN: a title with a placeholder gives each case a distinct, readable name
it.each([
  ['alice', 'ALICE'],
  ['bob', 'BOB'],
  ['carol', 'CAROL'],
])('CLEAN d4 uppercases %s to %s', (value, expected) => {
  expect(value.toUpperCase()).toBe(expected);
});


// ─── D6: console.* in a test body ─────────────────────────────────────────────

// BAD: a console.log left over from debugging clutters CI output
it('BAD d6 console.log', () => {
  const result = compute();
  console.log('DEBUG result=', result); // D6 - leftover debug output
  expect(result).toBe(42);
});

// BAD: console.debug is the same noise
it('BAD d6 console.debug', () => {
  const data = fetchData();
  console.debug(data); // D6
  expect(data.status).toBe('ok');
});

// CLEAN: no stray logging
it('CLEAN d6', () => {
  expect(compute()).toBe(42);
});


// ─── D7: Anonymous test (empty or missing description) ───────────────────────

// BAD: empty title - CI reports a blank test name
it('', () => {
  expect(compute()).toBe(42); // D7 - no description
});

// BAD: test() with only a callback and no name (where the runner allows it)
test(() => {
  expect(compute()).toBe(42); // D7 - anonymous
});

// CLEAN: a descriptive title
it('compute returns 42 for the default input', () => {
  expect(compute()).toBe(42);
});


// ─── D8: Magic number in an assertion ─────────────────────────────────────────

// BAD: 86400 and 30 carry meaning that the reader has to decode
it('BAD d8 magic numbers', () => {
  expect(secondsPerDay()).toBe(86400); // D8 - what is 86400?
  expect(retentionWindow()).toBe(2592000); // D8 - 30 days in seconds, unexplained
});

// CLEAN: name the constants so the assertion reads as intent
it('CLEAN d8 named constants', () => {
  const SECONDS_PER_DAY = 24 * 60 * 60;
  const RETENTION_DAYS = 30;
  expect(secondsPerDay()).toBe(SECONDS_PER_DAY);
  expect(retentionWindow()).toBe(RETENTION_DAYS * SECONDS_PER_DAY);
});


// ─── M2: Over-long test body ──────────────────────────────────────────────────

// BAD: one test verifies many unrelated concerns. A failure does not localize,
// and the body is hard to read. This is a structural signal to split it up.
it('BAD m2 too long', () => {
  const user = createUser('Alice');
  expect(user.name).toBe('Alice');        // concern 1: name
  expect(user.role).toBe('guest');        // concern 2: default role
  db.save(user);
  const loaded = db.load(user.id);
  expect(loaded.name).toBe('Alice');      // concern 3: round trip
  const token = auth.issueToken(user);
  expect(token.userId).toBe(user.id);     // concern 4: token issue
  expect(token.isExpired()).toBe(false);  // concern 5: expiry
  // ...many more concerns in the real case...
});

// CLEAN: one focused test per concern
it('CLEAN m2 name', () => {
  expect(createUser('Alice').name).toBe('Alice');
});
it('CLEAN m2 default role', () => {
  expect(createUser('Alice').role).toBe('guest');
});
it('CLEAN m2 round trip', () => {
  const user = createUser('Alice');
  db.save(user);
  expect(db.load(user.id).name).toBe('Alice');
});


// ─── C37: Duplicate it.each / test.each case ─────────────────────────────────

// BAD: (2, 3, 5) appears twice - the second run adds no coverage
it.each([
  [1, 1, 2],
  [2, 3, 5],
  [2, 3, 5], // C37 - exact duplicate of the line above
  [0, 0, 0],
])('BAD c37 add(%i, %i) === %i', (a, b, expected) => {
  expect(add(a, b)).toBe(expected);
});

// CLEAN: every case covers a distinct scenario
it.each([
  [1, 1, 2],
  [2, 3, 5],
  [-1, 1, 0],
  [0, 0, 0],
])('CLEAN c37 add(%i, %i) === %i', (a, b, expected) => {
  expect(add(a, b)).toBe(expected);
});


// ─── Placeholder stubs ────────────────────────────────────────────────────────

declare const items: unknown;
declare function subtotal(o: unknown): number;
declare function discount(o: unknown): number;
declare function total(o: unknown): number;
declare function secondsPerDay(): number;
declare function retentionWindow(): number;
declare function createUser(name: string): { id: number; name: string; role: string };
declare const db: { save(u: unknown): void; load(id: number): { name: string } };
declare const auth: { issueToken(u: unknown): { userId: number; isExpired(): boolean } };
declare function add(a: number, b: number): number;
