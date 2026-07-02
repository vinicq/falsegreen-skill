/**
 * Family E - The test passes but checks the wrong thing.
 *
 * This file is the structural bridge into the semantic layer. The patterns
 * here are visible from the surface: a matcher that compares identity instead
 * of value, or an assertion that echoes a stubbed value straight back.
 *
 * The harder cases - an expected value that contradicts the spec, or a test
 * that re-implements the production formula - cannot be judged from structure
 * alone. Those live in semantic_cases.ts and need the LLM pass.
 *
 * TypeScript, Jest/Vitest idioms. Referenced symbols are illustrative.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildUser, getDisplayName } from './mymodule';

// ─── toBe vs toEqual on objects: identity, not value ─────────────────────────

// BAD: toBe uses Object.is - reference identity. Two structurally equal objects
// are not the same reference, so this can fail for a correct result, or pass
// only because the SUT returned the very object the test built. Either way the
// matcher is checking the wrong relationship.
it('BAD toBe on objects checks identity', () => {
  const user = buildUser('Alice');
  expect(user).toBe({ name: 'Alice', role: 'guest' }); // wrong: identity, never equal
});

// BAD: the test passes only because the SUT returns the exact input reference,
// so toBe succeeds. That is identity coupling, not a value check.
it('BAD toBe passes by reference coupling', () => {
  const input = { name: 'Alice' };
  expect(echo(input)).toBe(input); // passes by identity, ignores the fields
});

// CLEAN: toEqual compares by value, which is what an object assertion means
it('CLEAN toEqual on objects', () => {
  const user = buildUser('Alice');
  expect(user).toEqual({ name: 'Alice', role: 'guest' });
});


// ─── Asserting a stubbed value back (structural echo) ────────────────────────

// BAD: getUser is stubbed to return { name: 'Alice' }. The assertion then
// checks that getDisplayName returns 'Alice'. If getDisplayName just returns
// user.name, the value never passes through any real logic - the test echoes
// the stub. Structurally this is the value flowing straight back; whether it is
// truly vacuous depends on what getDisplayName does (see case 11 in the
// semantic file).
it('BAD echoes the stubbed value', () => {
  vi.spyOn(userService, 'getUser').mockReturnValue({ name: 'Alice' });
  expect(getDisplayName(1)).toBe('Alice'); // echo if getDisplayName returns user.name
});

// CLEAN: stub the input, assert a derived result the production code computes
it('CLEAN asserts a derived value', () => {
  vi.spyOn(userService, 'getUser').mockReturnValue({ firstName: 'Alice', lastName: 'Smith' });
  expect(getDisplayName(1)).toBe('A. Smith'); // initial + surname: real logic ran
});


// ─── JS27: toHaveBeenCalled* as the sole oracle on a local double ────────────

// BAD: the only check is that a locally-created spy was called. That verifies
// the wiring, not the unit's output. Distinct from JS8: the SUT is not mocked -
// the assertion just targets call-tracking instead of a returned value.
it('BAD js27 only asserts the spy was called', () => {
  const spy = vi.fn();
  run(spy);
  expect(spy).toHaveBeenCalled(); // JS27 - wiring only, no behavior checked
});

// CLEAN: assert the unit's own output alongside the call
it('CLEAN js27 also asserts the result', () => {
  const spy = vi.fn();
  const result = run(spy);
  expect(spy).toHaveBeenCalled();
  expect(result).toBe(2); // behavior verified, not just wiring
});

// CLEAN: toHaveBeenCalledWith carrying real arguments checks the call contract,
// not merely that it happened.
it('CLEAN js27 asserts the call arguments', () => {
  const spy = vi.fn();
  submit(spy, { id: 1 });
  expect(spy).toHaveBeenCalledWith({ id: 1 }); // the arguments are the contract
});


// ─── Note on the semantic boundary ───────────────────────────────────────────
//
// The two cases above are catchable from structure: a toBe/toEqual mismatch and
// a stub-then-echo shape. The cases that are NOT catchable from structure are:
//
//   - expected value contradicts the spec (the number is simply wrong)
//   - expected value re-derives the production formula (both sides agree on the
//     same bug)
//   - the test passes only because a sibling test ran first
//
// Those require reading intent against an independent oracle. They are in
// semantic_cases.ts and only the LLM pass flags them.


// ─── Placeholder stubs ────────────────────────────────────────────────────────

declare const userService: { getUser(id: number): any };
declare function echo<T>(x: T): T;
declare function run(cb: (...args: any[]) => any): number;
declare function submit(cb: (...args: any[]) => any, payload: unknown): void;
