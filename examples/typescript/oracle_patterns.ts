/**
 * Oracle failure patterns — TypeScript (Vitest / Jest).
 * Case: J2 — the expected value does not come from an independent source.
 *
 * Patterns covered:
 *   - Self-referential timestamp oracle (result read-back as its own expected value)
 *   - Sign-then-verify tautology (JWT / HMAC)
 *   - Unawaited DML before assertion (race condition masked by driver serialization)
 *
 * Evidence: drizzle-team/drizzle-orm (pg-common.ts, sqlite-common.ts),
 *           honojs/hono (jwt.test.ts).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { JWT } from './jwt';

// ─── J2: self-referential timestamp oracle ────────────────────────────────────
//
// BAD: the test inserts a row with a server-generated timestamp (createdAt).
// The expected value in toEqual() is read back from the same result object:
//   createdAt: result[0]!.createdAt
//
// This assertion is a tautology — it is always true by construction.
// Any bug in how the ORM encodes or returns the timestamp (wrong timezone,
// wrong type, missing milliseconds) is completely invisible because both
// sides of the equality come from the same query result.
//
// Evidence: drizzle-team/drizzle-orm pg-common.ts line ~684 and ~2724.
// The pattern appears 8-12 times per file, covering every 'select all fields' test.

describe('User.select all fields (J2 - self-referential oracle)', () => {
  it('BAD: createdAt compared to itself — any encoding bug passes', async () => {
    await db.insert('users').values({ id: 1, name: 'Alice' });
    const result = await db.select().from('users');

    expect(result).toEqual([{
      id: 1,
      name: 'Alice',
      createdAt: result[0]!.createdAt, // J2 — always equal to itself
    }]);
  });

  // CLEAN option A: use a fixed timestamp so the oracle is independent.
  // Insert a known timestamp; assert against that same literal.
  it('CLEAN: insert fixed timestamp, assert against the literal', async () => {
    const knownTime = new Date('2024-01-15T10:00:00.000Z');
    await db.insert('users').values({ id: 1, name: 'Alice', createdAt: knownTime });
    const result = await db.select().from('users');

    expect(result).toEqual([{
      id: 1,
      name: 'Alice',
      createdAt: knownTime, // independent oracle — fails if encoding is wrong
    }]);
  });

  // CLEAN option B: when timestamp is server-generated and unpredictable,
  // assert its TYPE and plausibility rather than its exact value.
  it('CLEAN: assert timestamp type and plausibility', async () => {
    await db.insert('users').values({ id: 1, name: 'Alice' });
    const [user] = await db.select().from('users');

    expect(user.id).toBe(1);
    expect(user.name).toBe('Alice');
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.createdAt.getTime()).toBeGreaterThan(0);
    // Verify it was set within the last minute (server time)
    expect(Date.now() - user.createdAt.getTime()).toBeLessThan(60_000);
  });
});


// ─── J2: sign-then-verify tautology (JWT / HMAC) ─────────────────────────────
//
// BAD: the test signs a payload and then verifies it with the same key.
// Even if JWT.verify() returns the decoded payload without checking the
// signature at all, the assertion passes — because the payload was signed
// correctly and toEqual() only checks the payload content, not the signature.
//
// Severity is LOW when the suite also has adjacent negative tests (wrong key,
// tampered token) that would catch a broken verify(). Severity rises to HIGH
// when the positive test is the only coverage.
//
// Evidence: honojs/hono jwt.test.ts.

describe('JWT.sign + verify (J2 - tautology)', () => {
  const secret = 'test-secret';
  const payload = { sub: 'user123', role: 'admin' };

  it('BAD: sign-then-verify with same key — passes even without signature check', async () => {
    const token = await JWT.sign(payload, secret, 'HS256');
    const verified = await JWT.verify(token, secret, 'HS256');

    // J2 — if verify() decodes without checking the signature, this still passes
    expect(verified).toEqual(payload);
  });

  // CLEAN: the positive test must be accompanied by negative tests that prove
  // verify() actually enforces the signature. Without these, the positive test
  // cannot distinguish "signature verified" from "signature ignored".

  it('CLEAN (mitigating test A): wrong key must reject', async () => {
    const token = await JWT.sign(payload, secret, 'HS256');
    await expect(
      JWT.verify(token, 'wrong-secret', 'HS256')
    ).rejects.toThrow();
  });

  it('CLEAN (mitigating test B): tampered payload must reject', async () => {
    const token = await JWT.sign(payload, secret, 'HS256');
    const [header, , sig] = token.split('.');
    // Replace payload with a different one, keep original signature
    const tamperedPayload = btoa(JSON.stringify({ sub: 'attacker', role: 'root' }));
    const tampered = `${header}.${tamperedPayload}.${sig}`;

    await expect(
      JWT.verify(tampered, secret, 'HS256')
    ).rejects.toThrow();
  });
});


// ─── J1: unawaited DML before assertion (masked race condition) ───────────────
//
// BAD: db.run() / .run() without await initiates a query but returns before
// it completes. The subsequent await on the SELECT may observe the table state
// from before the INSERT/DDL. Tests pass because most database drivers
// serialize writes internally — but the serialization is an implementation
// detail, not a guarantee. A driver upgrade, parallel test runner, or
// different isolation level can expose the race.
//
// Evidence: drizzle-team/drizzle-orm sqlite-common.ts lines ~1983, ~2374.
// Pattern: db.insert().run() (no await) followed by await db.select().

describe('async DDL before assertion (J1 - unawaited DML)', () => {
  it('BAD: unawaited .run() before SELECT — race masked by driver serialization', () => {
    // J1 — these DML calls are fire-and-forget; no await
    db.run('DROP TABLE IF EXISTS users');
    db.run('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
    db.insert('users').values({ id: 1, name: 'Alice' }).run(); // also not awaited

    // The SELECT may see the table before CREATE completes
    const result = db.select().from('users').all();
    expect(result).toHaveLength(1);
  });

  // CLEAN: await every DML operation in the setup.
  it('CLEAN: await all DML before asserting', async () => {
    await db.run('DROP TABLE IF EXISTS users');
    await db.run('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
    await db.insert('users').values({ id: 1, name: 'Alice' });

    const result = await db.select().from('users');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice');
  });

  // CLEAN: use beforeEach for schema setup so each test starts clean.
  beforeEach(async () => {
    await db.run('DROP TABLE IF EXISTS users');
    await db.run('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)');
  });

  it('CLEAN: schema in beforeEach, DML in test', async () => {
    await db.insert('users').values({ id: 1, name: 'Alice' });
    const [user] = await db.select().from('users');
    expect(user.name).toBe('Alice');
  });
});
