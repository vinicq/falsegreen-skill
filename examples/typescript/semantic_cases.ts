/**
 * Semantic cases - require LLM judgment (no static rule can detect these).
 * Cases: 10, 11, 12, 15, 18, plus the JWT/HMAC sign-then-verify tautology
 *
 * Static analysis catches structural false positives (missing assertions,
 * tautologies, dead branches). It cannot reconstruct intent. These five cases
 * need a model that reads the test as a whole and reasons about what it is
 * actually verifying against an independent oracle.
 *
 * TypeScript, Jest/Vitest idioms. Referenced symbols are illustrative.
 */

import { describe, it, expect, vi } from 'vitest';

// ─── Case 10: Mocks the unit under test ──────────────────────────────────────

// BAD: the test mocks add(), the function it claims to test, then asserts the
// mock's return value. Nothing about the real implementation is exercised.
// Only the semantic pass spots that the mock target equals the SUT.
import { add } from './calculator';
vi.mock('./calculator');

it('BAD case10 mocks the SUT', () => {
  (add as unknown as ReturnType<typeof vi.fn>).mockReturnValue(5);
  expect(add(2, 3)).toBe(5); // case 10 - asserts the mock config, not add()
});

// CLEAN: mock a dependency (the DB), run the real function under test
import { getUser } from './userService';
import { db } from './database';
vi.mock('./database');

it('CLEAN case10', async () => {
  (db.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1, name: 'Alice' });
  const user = await getUser(1); // real SUT
  expect(user.name).toBe('Alice');
});


// ─── Case 11: Asserts the value fed to the mock (echo) ───────────────────────

// BAD: stubs product.price to 100, then asserts the result is 100. If getPrice
// just returns product.price, the test passes whether or not any computation
// happened. The model has to read getPrice to know the value never transformed.
import { getPrice, getPriceWithTax } from './pricing';

it('BAD case11 echoes the stub', () => {
  const product = { price: 100 } as any;
  expect(getPrice(product)).toBe(100); // case 11 - 100 in, 100 out
});

// CLEAN: stub the input, assert a derived result from the spec
it('CLEAN case11', () => {
  const product = { price: 100 } as any;
  expect(getPriceWithTax(product)).toBe(110); // spec: 100 + 10% = 110
});


// ─── Case 12: Re-implements the production formula as expected ───────────────

// BAD: the expected value is computed with the same formula the SUT uses. A bug
// in the formula is mirrored on both sides, so the test never fails. Catching
// this needs the model to notice expected re-derives calculateTotal's logic.
import { calculateTotal } from './calculator';

it('BAD case12 re-implements the formula', () => {
  const price = 100;
  const taxRate = 0.1;
  const expected = price + price * taxRate; // copy of calculateTotal's formula
  expect(calculateTotal(price, taxRate)).toBe(expected); // case 12
});

// CLEAN: the expected value comes from the spec, hand-computed
it('CLEAN case12', () => {
  expect(calculateTotal(100, 0.1)).toBe(110); // spec fact: 100 + 10% = 110
});


// ─── Case 15: Passes only when another test ran first ────────────────────────

// BAD: a module-level cache shared across tests. test_readCache passes only if
// test_populateCache ran first in the same process. Run in isolation it fails.
// The model has to see the cross-test dependency on shared state.
const sharedCache: Record<string, string> = {};

it('case15 populate (runs first)', () => {
  sharedCache.key = 'value';
});

it('BAD case15 reads cache populated by a sibling', () => {
  expect(sharedCache.key).toBe('value'); // case 15 - fails when run alone
});

// CLEAN: each test sets up its own state, no ordering dependency
it('CLEAN case15 isolated', () => {
  const cache: Record<string, string> = {};
  cache.key = 'value';
  expect(cache.key).toBe('value');
});


// ─── Case 18: Expected value contradicts the spec ────────────────────────────

// BAD: the spec says applyDiscount(200, 0.15) returns 170. This test asserts
// 200, the undiscounted price. If the function is buggy and returns 200, the
// test passes and freezes the bug as correct. Only an independent oracle (the
// docstring/spec: "returns price minus price * rate") reveals the contradiction.
import { applyDiscount } from './pricing';

it('BAD case18 expected contradicts the spec', () => {
  expect(applyDiscount(200, 0.15)).toBe(200); // case 18 - asserts the bug
});

// CLEAN: expected derived from the spec
it('CLEAN case18', () => {
  expect(applyDiscount(200, 0.15)).toBe(170); // 200 - (200 * 0.15) = 170
});


// ─── Sign-then-verify tautology: JWT / HMAC positive test only (J2) ──────────

// BAD in isolation: signs a payload and immediately verifies it with the same
// key, asserting the round-trip matches. This stays green even if verify() skips
// the signature check, because the happy path never exercises rejection. The
// model has to notice there is no negative test proving verification is enforced.
import { JWT } from './jwt';

it('BAD jwt sign-then-verify only', async () => {
  const payload = { sub: 'alice' };
  const signingKey = 'example-not-a-real-key';
  const token = await JWT.sign(payload, signingKey, 'HS256');
  const verified = await JWT.verify(token, signingKey, 'HS256');
  expect(verified).toMatchObject(payload); // passes even without sig verification
});

// CLEAN: keep the round-trip, but add the negative tests that make verification
// load-bearing. A wrong key and a tampered token must both be rejected; if
// verify() skipped the signature, these would fail and expose it.
it('CLEAN jwt rejects a wrong key', async () => {
  const token = await JWT.sign({ sub: 'alice' }, 'example-not-a-real-key', 'HS256');
  await expect(JWT.verify(token, 'placeholder-wrong-key', 'HS256')).rejects.toThrow(
    /signature/i,
  );
});

it('CLEAN jwt rejects a tampered token', async () => {
  const token = await JWT.sign({ sub: 'alice' }, 'example-not-a-real-key', 'HS256');
  const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
  await expect(JWT.verify(tampered, 'example-not-a-real-key', 'HS256')).rejects.toThrow(
    /signature/i,
  );
});
