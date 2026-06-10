/**
 * Async/await and Promise false positives in TypeScript (Jest / Vitest).
 * Case: J1 — assertion never executes because the Promise resolves after the test ends.
 *
 * Four patterns: missing await on expect().resolves, Promise not returned,
 * done() called in finally (fires even when expect throws), floating promise.
 *
 * All BAD tests pass green. None of them verify anything.
 */

import { describe, it, expect } from 'vitest';

// ─── Missing await on assertion (J1) ─────────────────────────────────────────

// BAD pattern A: .resolves without await in an async test.
// The test function returns before the Promise inside resolves.
// Vitest / Jest marks the test done, assertion never fires.
async function fetchUserStatus(id: number): Promise<string> {
    return id > 0 ? 'active' : 'inactive';
}

describe('fetchUserStatus (J1 - missing await)', () => {
    it('BAD: .resolves without await - test ends before promise resolves', async () => {
        // J1: no await before expect(...).resolves. The assertion is scheduled
        // but the async function returns before it settles.
        expect(fetchUserStatus(1)).resolves.toBe('active'); // missing await
    });

    // BAD pattern B: result is the Promise object, not the resolved value.
    it('BAD: result is a Promise, not the resolved value', async () => {
        const result = fetchUserStatus(1); // result: Promise<string>
        expect(result).toBe('active'); // J1 - comparing a Promise object to a string
    });

    // CLEAN: await the call, then assert on the resolved value.
    it('CLEAN: await the call, then assert', async () => {
        const result = await fetchUserStatus(1);
        expect(result).toBe('active');
    });

    // CLEAN: await on the resolves chain is also correct.
    it('CLEAN: await with .resolves', async () => {
        await expect(fetchUserStatus(1)).resolves.toBe('active');
    });
});

// ─── Promise not returned (J1) ───────────────────────────────────────────────

// BAD: non-async test that creates a Promise assertion but does not return it.
// Jest / Vitest sees the test function return undefined, marks it done,
// and the Promise assertion settles after the test runner has moved on.
describe('Promise.resolve (J1 - promise not returned)', () => {
    it('BAD: Promise assertion created but not returned - test exits immediately', () => {
        // J1: the expect().resolves chain creates a Promise but nothing awaits it.
        expect(Promise.resolve(42)).resolves.toBe(42); // missing return
    });

    // CLEAN option 1: return the Promise so Jest/Vitest waits for it.
    it('CLEAN: return the Promise assertion', () => {
        return expect(Promise.resolve(42)).resolves.toBe(42);
    });

    // CLEAN option 2: use async/await.
    it('CLEAN: async/await instead of returning', async () => {
        await expect(Promise.resolve(42)).resolves.toBe(42);
    });
});

// ─── done() called in finally - assertion after done (J1) ────────────────────

// BAD: done() is in a finally block. If expect() throws, done() has already
// run inside the finally before the error propagates. The runner sees the test
// as complete and ignores the assertion failure.
//
// Equivalent to the "done before assert" pattern but more subtle because the
// finally block always runs, including before an exception unwinds.

type StatusPayload = { status: string };

function loadPayloadAsync(cb: (err: Error | null, data: StatusPayload | null) => void): void {
    setTimeout(() => cb(null, { status: 'ok' }), 0);
}

describe('loadPayloadAsync done() callback (J1 - done in finally)', () => {
    it('BAD: done() fires in finally even when expect throws', (done) => {
        loadPayloadAsync((err, data) => {
            try {
                expect(data!.status).toBe('ok');
            } finally {
                done(); // J1: done fires even if expect threw above
            }
        });
    });

    // CLEAN: return a Promise instead of using done().
    // If the assertion throws, the rejected Promise fails the test correctly.
    it('CLEAN: return a Promise, skip done()', () => {
        return new Promise<void>((resolve, reject) => {
            loadPayloadAsync((err, data) => {
                try {
                    expect(data!.status).toBe('ok');
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });
    });
});

// ─── Floating promise (unhandled rejection, J1) ──────────────────────────────

// BAD: calling an async function without await or return.
// If the async call rejects (or an assertion inside it fails), the rejection
// is unhandled. The test runner sees a synchronous return and marks the test
// as passed before the Promise settles.

async function writeAuditLog(entry: string): Promise<void> {
    if (!entry) throw new Error('entry required');
    // real implementation would write to DB
}

describe('writeAuditLog (J1 - floating promise)', () => {
    it('BAD: async call not awaited - rejection silently ignored', () => {
        writeAuditLog('login event'); // J1 - Promise floats, rejection would be unhandled
        expect(true).toBe(true);     // this assertion always passes; the real check never runs
    });

    it('BAD: assertion inside an unawaited then() callback', () => {
        writeAuditLog('login event').then(() => {
            expect(1).toBe(2); // J1 - this assertion fires after the test is already done
        });
        // test returns here, .then() callback runs later and its failure is swallowed
    });

    // CLEAN: always await async calls inside tests.
    it('CLEAN: await the async call', async () => {
        await writeAuditLog('login event');
        // no assertion needed here: if writeAuditLog rejects, the test fails correctly
    });

    it('CLEAN: await an assertion about the resolved value', async () => {
        await expect(writeAuditLog('login event')).resolves.toBeUndefined();
    });
});
