/**
 * Family C - The test checks its own setup, not the program.
 * Codes: JS8
 *
 * The test mocks the very unit it claims to test, then asserts on the mock's
 * configured return value. The production code never runs, so the assertion
 * only confirms the test wired the mock correctly.
 *
 * TypeScript, Jest/Vitest idioms. Referenced symbols are illustrative.
 */

import { describe, it, expect, vi } from 'vitest';

// ─── JS8: mocks the unit under test and asserts it directly ──────────────────

// BAD: jest.mock replaces the whole calculator module. `add` is now a mock.
// The assertion reads back the value we told the mock to return. The real
// add() is never exercised.
import { add } from './calculator';
vi.mock('./calculator');

describe('add (JS8 - mocks the SUT)', () => {
  it('BAD: asserts the mock return, not the real function', () => {
    (add as unknown as ReturnType<typeof vi.fn>).mockReturnValue(5);
    expect(add(2, 3)).toBe(5); // JS8 - 5 came from the mock, add() never ran
  });
});

// BAD: vi.spyOn replaces the SUT method in place, then asserts the stub value
import * as validators from './validators';

describe('validateEmail (JS8 - spyOn replaces SUT)', () => {
  it('BAD: spy returns true, the validator logic is bypassed', () => {
    vi.spyOn(validators, 'validateEmail').mockReturnValue(true);
    expect(validators.validateEmail('not-an-email')).toBe(true); // JS8 - tests the spy
  });
});

// BAD: component under test stubbed to null, then asserted as "called".
// This checks the framework rendered the stub, not the component's behavior.
import * as PaymentFormModule from './PaymentForm';
import { render } from '@testing-library/react';

describe('CheckoutPage (JS8 - mocks the SUT component)', () => {
  it('BAD: asserts the mocked component was invoked', () => {
    vi.spyOn(PaymentFormModule, 'PaymentForm').mockReturnValue(null);
    render(<CheckoutPage />);
    expect(PaymentFormModule.PaymentForm).toHaveBeenCalled(); // JS8 - mock-the-SUT
  });
});


// ─── CLEAN: mock a real collaborator (edge), call the real SUT ───────────────

// CLEAN: mock the database, the dependency at the edge. getUser is the real
// function under test and its logic runs against the stubbed data.
import { getUser } from './userService';
import { db } from './database';
vi.mock('./database');

describe('getUser (CLEAN - mocks the edge, not the SUT)', () => {
  it('CLEAN: real getUser runs, db is the mocked collaborator', async () => {
    (db.query as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 1, name: 'Alice' }]);
    const user = await getUser(1); // real function under test
    expect(user.name).toBe('Alice'); // value produced by getUser, not the mock
  });
});

// CLEAN: spy on a side-effect dependency (console.warn), run the real validator
describe('validateEmail (CLEAN - spy on a side effect)', () => {
  it('CLEAN: real validator runs, the spy only observes the warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    validators.validateEmail('not-an-email'); // real logic executes
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('invalid'));
    warnSpy.mockRestore();
  });
});


// ─── Placeholder stubs ────────────────────────────────────────────────────────

declare function CheckoutPage(): JSX.Element;
