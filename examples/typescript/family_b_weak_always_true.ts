/**
 * Family B - The check is weak or always true.
 * Codes: C5, C6, C7, C8, C9, C18, JS3, JS15
 *
 * The assertion runs, but it passes by construction, accepts almost any
 * output, or checks a formatting detail instead of the value that matters.
 *
 * TypeScript, Jest/Vitest idioms (with a little Mocha + Chai variety).
 * Referenced symbols are illustrative and need not exist.
 */

import { describe, it, expect, vi } from 'vitest';
import { computeRatio, getUser, getUsers, divide, parse, render, compute } from './mymodule';

// ─── C5: always-true check ────────────────────────────────────────────────────

// BAD: both sides are the same literal, true by construction
it('BAD c5 literal vs literal', () => {
  expect(true).toBe(true); // C5 - passes regardless of production code
});

// BAD: a non-empty array literal is always truthy
it('BAD c5 truthy literal', () => {
  expect([1, 2]).toBeTruthy(); // C5 - a populated array is always truthy
});

// BAD: Chai dialect, same tautology
it('BAD c5 chai', () => {
  chai.assert.equal(1, 1); // C5 - 1 always equals 1
});

// CLEAN: assert the real result against an expected value
it('CLEAN c5', () => {
  expect(compute()).toBe(42);
});


// ─── C6: weak check (toBeTruthy / toBeDefined / .length > 0) ─────────────────

// BAD: toBeTruthy passes for any non-null result, including the wrong one
it('BAD c6 truthy', () => {
  expect(getUsers()).toBeTruthy(); // C6 - passes for [], [wrongUser], anything truthy
});

// BAD: toBeDefined accepts null, 0, '', false - anything except undefined
it('BAD c6 defined', () => {
  expect(getUser(1)).toBeDefined(); // C6 - too permissive
});

// BAD: length > 0 does not verify what is in the array
it('BAD c6 length positive', () => {
  expect(getUsers().length).toBeGreaterThan(0); // C6 - [null] also passes
});

// CLEAN: assert the actual contents
it('CLEAN c6', () => {
  const users = getUsers();
  expect(users).toHaveLength(3);
  expect(users[0].name).toBe('Alice');
});

// CLEAN (not C6): in a discriminated union the discriminant IS the contract
it('CLEAN c6 discriminant', () => {
  const result = parse('not-json'); // { kind: 'error', message } | { kind: 'ok', data }
  expect(result.kind).toBe('error'); // knowing kind fixes the whole shape
});


// ─── C7: self-compare (expect(x).toBe(x)) ────────────────────────────────────

// BAD: both sides are the same reference, true by reflexivity
it('BAD c7 self compare', () => {
  const name = getUser(1).name;
  expect(name).toBe(name); // C7 - always true
});

// BAD: Chai self-comparison
it('BAD c7 chai', () => {
  const result = compute();
  chai.expect(result).to.equal(result); // C7
});

// CLEAN: compare against an expected value
it('CLEAN c7', () => {
  expect(getUser(1).name).toBe('Alice');
});

// CLEAN (not C7): two separate calls test caching, not reflexivity
it('CLEAN c7 two calls', () => {
  expect(loadModule()).toBe(loadModule()); // tests the loader returns a cached instance
});


// ─── C8: exact equality on a float ────────────────────────────────────────────

// BAD: floating-point arithmetic makes exact equality unreliable
it('BAD c8 float equality', () => {
  expect(computeRatio()).toBe(3.14159); // C8 - may fail on rounding
});

// BAD: 0.1 + 0.2 is the classic case
it('BAD c8 float sum', () => {
  expect(0.1 + 0.2).toBe(0.3); // C8 - actually 0.30000000000000004
});

// CLEAN: toBeCloseTo tolerates rounding
it('CLEAN c8', () => {
  expect(computeRatio()).toBeCloseTo(3.14159, 5);
});

// CLEAN: 0 and 1 are exact sentinels, toBe is fine
it('CLEAN c8 sentinel', () => {
  expect(emptyRatio()).toBe(0);
  expect(fullRatio()).toBe(1);
});


// ─── C9: toThrow() with no error type or message ─────────────────────────────

// BAD: any throw passes, including a typo in the test itself
it('BAD c9 bare toThrow', () => {
  expect(() => divide(10, 0)).toThrow(); // C9 - accepts any error
});

// BAD: Chai .throw with no argument is the same gap
it('BAD c9 chai throw', () => {
  chai.expect(() => parse('bad')).to.throw(); // C9
});

// CLEAN: assert the specific error type and message
it('CLEAN c9', () => {
  expect(() => divide(10, 0)).toThrow(/division by zero/);
});


// ─── C18: stringified equality (String(x) / JSON.stringify / template) ───────

// BAD: comparing JSON.stringify couples to key order and formatting
it('BAD c18 json stringify', () => {
  const user = getUser(1);
  expect(JSON.stringify(user)).toBe('{"name":"Alice","age":30}'); // C18 - format, not value
});

// BAD: String(x) compares the printed form, not the object
it('BAD c18 String()', () => {
  const user = getUser(1);
  expect(String(user)).toBe('User(Alice, 30)'); // C18 - depends on toString
});

// BAD: template literal stringifies before the comparison
it('BAD c18 template literal', () => {
  const ratio = computeRatio();
  expect(`${ratio.toFixed(2)}`).toBe('3.14'); // C18 - checks formatting, not the float
});

// CLEAN: compare the structured value directly
it('CLEAN c18', () => {
  const user = getUser(1);
  expect(user).toEqual({ name: 'Alice', age: 30 });
});


// ─── JS3: snapshot is the only assertion ──────────────────────────────────────

// BAD: a snapshot records whatever the component renders today, bugs included.
// On first run it always passes; later it only catches that the output changed,
// not that it is correct.
it('BAD js3 snapshot only', () => {
  const { container } = render(<Invoice total={27} />);
  expect(container).toMatchSnapshot(); // JS3 - the only assertion, no oracle
});

// CLEAN: assert specific, meaningful values alongside (or instead of) a snapshot
it('CLEAN js3', () => {
  render(<Invoice total={27} />);
  expect(screen.getByTestId('total')).toHaveTextContent('$27.00');
});


// ─── JS15: comparison wrapped in a boolean (expect(a===b).toBe(true)) ────────

// BAD: collapsing the comparison to a boolean throws away the diff on failure.
// You learn "expected false to be true", never the two values.
it('BAD js15 boolean wrapped', () => {
  const result = compute();
  expect(result === 42).toBe(true); // JS15 - opaque, also passes for any === pair
});

// BAD: inequality wrapped the same way
it('BAD js15 boolean wrapped not equal', () => {
  expect(getUsers().length !== 0).toBe(true); // JS15 - weak and diff-less
});

// CLEAN: let the matcher do the comparison so failures show both sides
it('CLEAN js15', () => {
  expect(compute()).toBe(42);
});


// ─── Placeholder stubs ────────────────────────────────────────────────────────

declare const chai: { assert: { equal(a: unknown, b: unknown): void }; expect(x: unknown): any };
declare const screen: { getByTestId(id: string): HTMLElement };
declare function emptyRatio(): number;
declare function fullRatio(): number;
declare function loadModule(): object;
declare function Invoice(props: { total: number }): JSX.Element;
