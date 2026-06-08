/**
 * Examples of false-positive test patterns in TypeScript/Jest.
 * Each test passes green but does not verify correct behavior.
 * See reference.md for the case number and judgment.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ─── Case 10: Mocks the unit under test ────────────────────────────────────

// BAD: jest.mock replaces the SUT (add), then asserts on the mock's return
jest.mock('./calculator');
import { add } from './calculator';

describe('case 10 example', () => {
    it('asserts the mock value (false positive)', () => {
        (add as jest.Mock).mockReturnValue(5);
        expect(add(2, 3)).toBe(5);  // tests the mock, not the function
    });
});

// ─── Case 11: Asserts the value fed to the mock ────────────────────────────

import { UserService } from './userService';
import { db } from './db';

jest.mock('./db');

describe('case 11 example', () => {
    it('echoes the stub (false positive)', async () => {
        const stubUser = { id: 1, name: 'Alice' };
        (db.findById as jest.Mock).mockResolvedValue(stubUser);
        const result = await UserService.getUser(1);
        expect(result).toEqual(stubUser); // C11 if getUser just returns db.findById result
    });
});

// ─── Case 12: Re-implements the production formula ─────────────────────────

describe('case 12 example', () => {
    it('re-computes instead of using the spec', () => {
        const price = 100;
        const taxRate = 0.1;
        const expected = price + price * taxRate; // same formula as the SUT
        // If calculateTotal(p, r) = p + p * r, this test never catches a formula bug
        // expect(calculateTotal(price, taxRate)).toBe(expected); // C12
    });
});

// ─── Case: async test that never awaits ────────────────────────────────────

describe('async liar example', () => {
    it('never awaits the SUT (always passes)', () => {
        const result = fetchData();  // returns a Promise, not awaited
        expect(result).toBeTruthy(); // checks the Promise object, not the resolved value
    });
});

// ─── Case: done() called before assertion ──────────────────────────────────

describe('done callback example', () => {
    it('done before assert (false positive)', (done) => {
        fetchAsync((data) => {
            done();                     // done called before the assertion
            expect(data.id).toBe(1);    // this assertion does not block the test
        });
    });
});

// Helper stubs
async function fetchData() { return {}; }
async function fetchAsync(cb: (d: { id: number }) => void) { cb({ id: 1 }); }
