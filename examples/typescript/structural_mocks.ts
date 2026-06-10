/**
 * Structural mock false positives in TypeScript (Vitest + Jest).
 * Cases: C10 (vi.spyOn replaces SUT), C10 (jest.mock hoisting), C13 (misspelled assertion), C13b (untyped mock).
 *
 * Each BAD test passes green but verifies nothing about the real implementation.
 * The SUT is mocked out, misnamed, or left without type enforcement.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateEmail, processOrder, sendNotification } from './mymodule';

// ─── C10: vi.spyOn replaces the SUT (Vitest) ─────────────────────────────────

// BAD: spyOn + mockImplementation replaces the real validateEmail.
// The test calls validators.validateEmail but gets back whatever we told the spy.
// Nothing about the real validation logic is exercised.
describe('validateEmail (C10 - spyOn replaces SUT)', () => {
    it('BAD: checks the spy return, not the real validator', () => {
        const validators = { validateEmail };
        vi.spyOn(validators, 'validateEmail').mockImplementation(() => true);

        const result = validators.validateEmail('not-an-email');
        expect(result).toBe(true); // C10 - the mock returned true, not the function
    });

    // CLEAN: spy on a side-effect dependency, not the function under test.
    // Here we spy on console.warn to verify the validator logs invalid input.
    it('CLEAN: spies on a side effect, not the SUT itself', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        validateEmail('not-an-email'); // real function executes
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('invalid'));

        warnSpy.mockRestore();
    });
});

// ─── C10: jest.mock() hoisting trap (CJS / CommonJS Jest) ────────────────────

// BAD: jest.mock() is hoisted to the top of the file by Babel/Jest transform.
// By the time `const { processOrder } = require('./orders')` runs, the module
// is already fully replaced. processOrder is a jest.fn(), not the real export.
// The test only verifies that calling a jest.fn() returns what we configured.
//
// To reproduce: in a Jest + CommonJS project:
//
//   const { processOrder } = require('./orders');  // gets jest.fn()
//   jest.mock('./orders');                          // hoisted above the require
//
//   test('BAD: tests the mock, not the SUT', () => {
//       processOrder.mockReturnValue({ ok: true });
//       const result = processOrder({ id: 1 });
//       expect(result).toEqual({ ok: true }); // C10 - echo of mock config
//   });

// CLEAN: mock a dependency of ./orders, not ./orders itself.
// jest.mock('./database') replaces the DB layer; processOrder is the real SUT.
//
//   jest.mock('./database');
//   const { processOrder } = require('./orders'); // real processOrder
//   const { db } = require('./database');         // mocked db
//
//   test('CLEAN: mocks the dependency, calls the real SUT', () => {
//       db.find.mockResolvedValue({ id: 1, items: [] });
//       const result = await processOrder({ id: 1 });
//       expect(result.status).toBe('processed'); // real logic ran
//   });

// ─── C13: mock assertion misspelled or not called (Jest / Vitest) ─────────────

describe('sendNotification (C13 - misspelled assertion)', () => {
    it('BAD: toHaveBeenCalledOnce is not a Jest matcher - no () means nothing runs', () => {
        const mockFn = vi.fn();
        sendNotification('user@example.com');

        // C13: 'toHaveBeenCalledOnce' does not exist in Jest. Accessing it as
        // a property returns undefined; the check silently does nothing.
        // In Vitest it exists, but omitting () is still wrong in Jest.
        (expect(mockFn) as any).toHaveBeenCalledOnce; // C13 - no parentheses
    });

    it('BAD: toHaveBeenCalledTimes without calling it - accesses as property', () => {
        const mockFn = vi.fn();
        sendNotification('user@example.com');

        // C13: attribute access, not a function call. The check never executes.
        (expect(mockFn) as any).toHaveBeenCalledTimes; // C13 - missing ()
    });

    // CLEAN: use the correct matcher name with parentheses.
    it('CLEAN: correct matcher with call count', () => {
        const mockFn = vi.fn();
        mockFn('user@example.com');
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('CLEAN: assert on the specific argument', () => {
        const mockFn = vi.fn();
        mockFn('user@example.com');
        expect(mockFn).toHaveBeenCalledWith('user@example.com');
    });
});

// ─── C13b: mock without type checking ────────────────────────────────────────

// BAD: the mock is cast to `any`, so TypeScript can't catch wrong argument types.
// If sendNotification changes its signature, this test still compiles and passes.
describe('sendNotification (C13b - untyped mock)', () => {
    it('BAD: mockReturnValue with wrong type - TypeScript does not catch it', () => {
        const mockFn = vi.fn() as any; // cast strips the type
        mockFn.mockReturnValue(12345); // wrong type: number instead of void

        // TypeScript accepts this because mockFn is any.
        // A real signature change won't be caught here.
        mockFn('user@example.com');
        expect(mockFn).toHaveBeenCalled();
    });

    // CLEAN: vi.mocked() preserves the original function's type signature.
    // If sendNotification changes from (email: string) to (email: string, retry: boolean),
    // the call below will produce a TypeScript compile error.
    it('CLEAN: vi.mocked() preserves the function type', () => {
        vi.mock('./mymodule');
        const typedMock = vi.mocked(sendNotification);
        typedMock.mockImplementation((_email: string) => {}); // typed correctly

        sendNotification('user@example.com');
        expect(typedMock).toHaveBeenCalledWith('user@example.com');

        vi.restoreAllMocks();
    });
});
