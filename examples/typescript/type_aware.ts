/**
 * TypeScript-specific false positives and look-alikes.
 * Cases: branded type assertion collapse (J4), generic phantom test (J2),
 * discriminated union partial assertion (look-alike, not C6),
 * expectTypeOf compile-time assertion (look-alike, not C5).
 *
 * Several of these patterns exist only in TypeScript.
 * Python equivalents do not apply.
 */

import { describe, it, expect, expectTypeOf } from 'vitest';

// ─── Branded type assertion collapse (J4, LOW) ───────────────────────────────

// Branded types prevent mixing structurally identical primitives.
// Casting off the brand defeats the entire purpose.

type UserId = string & { readonly __brand: 'UserId' };
type OrderId = string & { readonly __brand: 'OrderId' };

function createUserId(raw: string): UserId {
    return raw as UserId;
}

// BAD: (id as string) strips the brand. The test now checks plain string equality.
// A function that returns the wrong branded type (OrderId instead of UserId)
// would still pass because both are strings under the hood.
describe('UserId branding (J4 - brand stripped)', () => {
    it('BAD: casts away the brand before asserting', () => {
        const id = createUserId('abc');
        expect(id as string).toBe('abc'); // J4 - brand erased, any string passes
    });

    // CLEAN: compare without stripping. The brand is preserved on both sides.
    it('CLEAN: compare without stripping the brand', () => {
        const id = createUserId('abc');
        expect(id).toBe('abc' as UserId); // brand preserved on expected side too
    });
});

// CLEAN (not a smell): casting through unknown to test a type guard IS legitimate.
// Type guards must reject bad input without triggering a compiler error.
// Using `as unknown as string` is the standard way to do this.
function isUserId(value: unknown): value is UserId {
    return typeof value === 'string' && value.startsWith('u_');
}

describe('isUserId type guard (look-alike - not J4)', () => {
    it('CLEAN: as unknown as T in a type guard test is not J4', () => {
        const badInput = 12345 as unknown as string; // deliberate bad input for type guard test
        expect(isUserId(badInput)).toBe(false); // not a smell: tests that guard rejects non-strings
    });
});

// ─── Generic type phantom test (J2, HIGH) ────────────────────────────────────

// A generic identity function with no transformation produces no coverage.
// The expected value equals the input. Any generic constraint bug is invisible.

function identity<T>(x: T): T {
    return x; // no transformation
}

// BAD: expected equals input. identity<string> could be broken in a dozen ways
// (wrong generic variance, constraint error) and this test would still pass.
describe('identity generic (J2 - phantom test)', () => {
    it('BAD: expected equals input, no transformation tested', () => {
        expect(identity<string>('hello')).toBe('hello'); // J2 - input == expected
    });
});

// CLEAN: test a generic that performs a transformation.
// Here, first<T extends { id: number }> picks the item with the smallest id.
// The assertion checks a derived property, not a pass-through.
interface HasId { id: number; name: string }

function first<T extends HasId>(arr: T[]): T | undefined {
    return arr.sort((a, b) => a.id - b.id)[0];
}

describe('first generic (CLEAN - transformation tested)', () => {
    it('CLEAN: asserts on derived property after a real transformation', () => {
        const items = [
            { id: 3, name: 'Charlie' },
            { id: 1, name: 'Alice' },
            { id: 2, name: 'Bob' },
        ];
        const result = first(items);
        expect(result?.id).toBe(1);       // lowest id
        expect(result?.name).toBe('Alice'); // correct item
    });
});

// ─── Discriminated union - partial assertion is CLEAN (look-alike, not C6) ───

// In a discriminated union, the discriminant field (`kind`) fully determines
// which union branch applies. Asserting only `kind` IS the meaningful assertion.
// This is not C6 (weak assertion) - it is the correct level of detail.
//
// Analogy: checking HTTP response.status in an HTTP test is not C6 because
// status IS the contract. Same logic applies to discriminated union discriminants.

type ApiResult =
    | { kind: 'ok'; data: string }
    | { kind: 'error'; message: string };

function parseApiResponse(raw: string): ApiResult {
    try {
        const parsed = JSON.parse(raw);
        return { kind: 'ok', data: parsed.value };
    } catch {
        return { kind: 'error', message: 'parse failure' };
    }
}

describe('ApiResult discriminated union (look-alike - not C6)', () => {
    it('CLEAN: asserting the discriminant alone is meaningful in a discriminated union', () => {
        const result = parseApiResponse('not-json');
        // This is NOT C6. In a discriminated union, `kind` is the contract.
        // Knowing kind === 'error' tells you the full shape of the result.
        // You can safely access result.message after this assertion.
        expect(result.kind).toBe('error');
    });

    it('CLEAN: toMatchObject on just the discriminant is not C6', () => {
        const result = parseApiResponse('not-json');
        expect(result).toMatchObject({ kind: 'error' }); // not C6: discriminant IS the assertion
    });
});

// ─── expectTypeOf: compile-time assertion (look-alike, not C5) ───────────────

// expectTypeOf() from vitest/expect-type produces compile-time type failures.
// Unlike expect(true).toBe(true), these DO catch real bugs - they fail at tsc
// if the type no longer matches. They are not C5 (always-true at runtime).

function getUserName(id: number): string {
    return `user-${id}`;
}

describe('getUserName type shape (look-alike - not C5)', () => {
    it('CLEAN: expectTypeOf is a compile-time check, not a runtime tautology', () => {
        // This assertion does nothing at runtime but WILL fail at tsc time
        // if getUserName's return type changes from string to something else.
        // It is not C5. Do not flag expectTypeOf().toEqualTypeOf<T>() calls.
        expectTypeOf(getUserName(1)).toEqualTypeOf<string>();
    });

    it('CLEAN: asserting against a union type is still not C5', () => {
        type MaybeString = string | null;
        const value: MaybeString = null;
        expectTypeOf(value).toEqualTypeOf<MaybeString>(); // not C5 - type must match exactly
    });
});
