/**
 * HTTP integration test false-positive patterns — JavaScript (Jest / Mocha + supertest).
 *
 * Patterns covered:
 *   - C27 / J1: try/catch-only for exception assertion (assertion in catch, no guard before)
 *   - J4 (HTTP-case): PascalCase header key lookup in supertest always returns undefined
 *   - J4 (coercion): ~~undefined === 0 masks an absent header
 *   - C2b: HTTP call with no assertion on response body
 *
 * Evidence: patterns observed in koajs/koa test suite (throw.test.js, respond.test.js).
 * Function names are illustrative; replace with your actual imports.
 */

'use strict'


// ─── C27 / J1: try/catch-only for exception assertion ────────────────────────
//
// BAD: the real intention is to assert properties of the thrown error.
// But if ctx.throw() stops throwing (a regression removes the error path),
// the catch block is never entered, all assertions are silently skipped,
// and the test reports green with zero checks executed.
//
// This is the dominant pattern in koajs/koa throw.test.js — all 11 tests
// are structured this way, making the entire file unable to detect regressions
// that remove the throw.
//
// (Mocha/Chai: same behavior — empty or skipped catch leaves the test green.)

const assert = require('node:assert/strict')

test('throws with status 400 (BAD: assertions only in catch)', () => {
  try {
    ctx.throw(400, 'name required')
  } catch (err) {
    // C27 / J1 — if ctx.throw() stops throwing, nothing below runs
    assert.strictEqual(err.message, 'name required')
    assert.strictEqual(err.status, 400)
    assert.strictEqual(err.expose, true)
  }
})

// CLEAN option A: assert.throws — synchronous, one-liner.
// Test fails explicitly if ctx.throw() does not throw.
test('throws with status 400 (CLEAN: assert.throws)', () => {
  assert.throws(
    () => ctx.throw(400, 'name required'),
    (err) => {
      assert.strictEqual(err.message, 'name required')
      assert.strictEqual(err.status, 400)
      return true
    }
  )
})

// CLEAN option B: expect().toThrow() — Jest/Vitest idiom.
test('throws with status 400 (CLEAN: expect().toThrow)', () => {
  expect(() => ctx.throw(400, 'name required')).toThrow('name required')
})

// CLEAN option C: manual try/catch with expect.assertions guard.
// If ctx.throw() does not throw, expect.assertions(2) fails the test.
test('throws with status 400 (CLEAN: expect.assertions guard)', () => {
  expect.assertions(2)
  try {
    ctx.throw(400, 'name required')
  } catch (err) {
    expect(err.message).toBe('name required')
    expect(err.status).toBe(400)
  }
})


// ─── J4: HTTP header case sensitivity trap (supertest) ───────────────────────
//
// BAD: supertest normalizes all response header names to lowercase.
// res.headers is keyed as { 'content-type': '...', 'content-length': '...' }.
// A PascalCase key like 'Content-Type' never exists on the object, so
// hasOwnProperty('Content-Type') is always false and the assertion vacuously
// passes — even if the server does send a Content-Type header.
//
// Evidence: koajs/koa respond.test.js — 12 tests in 9 describe blocks use
// PascalCase keys (status 204, 205, 304, null body, undefined body).
// These tests cannot detect a bug that adds an unwanted Content-Type header.

const request = require('supertest')
const app     = require('./app')

test('204 response has no content-type (BAD: PascalCase key)', async () => {
  const res = await request(app).get('/no-content')

  // J4 — 'Content-Type' (PascalCase) never exists in supertest res.headers.
  // hasOwnProperty always returns false, regardless of what the server sends.
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(res.headers, 'Content-Type'),
    false
  )
})

// CLEAN: use the normalized lowercase key that supertest actually produces.
test('204 response has no content-type (CLEAN: lowercase key)', async () => {
  const res = await request(app).get('/no-content')
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(res.headers, 'content-type'),
    false
  )
})

// CLEAN alternative: supertest's own .expect() method handles case normalization.
test('204 response has no content-type (CLEAN: supertest .expect)', async () => {
  await request(app)
    .get('/no-content')
    .expect(204)
    .expect((res) => {
      if (res.headers['content-type']) {
        throw new Error('unexpected Content-Type header')
      }
    })
})


// ─── J4: bitwise coercion masking an absent header (~~) ──────────────────────
//
// BAD: ~~value is a JavaScript idiom for Math.trunc(value).
// ~~undefined === 0 and ~~null === 0, so if the 'content-length' header is
// absent from the response, the assertion compares 0 === expectedLength,
// which may pass coincidentally (expectedLength === 0) or fail with a
// misleading message ("0 !== 4") instead of "header missing".
//
// Evidence: koajs/koa respond.test.js line ~174.

test('response has correct content-length (BAD: ~~ coercion)', async () => {
  const res = await request(app).get('/data')
  const expectedLength = 4

  // J4 — if 'content-length' is absent, ~~undefined === 0, not 4.
  // The assertion either silently passes (if expectedLength is 0) or
  // fails with a confusing numeric mismatch instead of "header absent".
  assert.strictEqual(~~res.header['content-length'], expectedLength)
})

// CLEAN: check header presence explicitly before asserting its value.
test('response has correct content-length (CLEAN: explicit presence check)', async () => {
  const res = await request(app).get('/data')
  const expectedLength = 4

  assert.ok(
    res.header['content-length'] !== undefined,
    'content-length header must be present'
  )
  assert.strictEqual(
    parseInt(res.header['content-length'], 10),
    expectedLength
  )
})

// CLEAN alternative: supertest's .expect('content-length', '4') checks both
// presence and value in one assertion and uses the correct lowercase key.
test('response has correct content-length (CLEAN: supertest .expect)', async () => {
  await request(app)
    .get('/data')
    .expect(200)
    .expect('content-length', '4')
})


// ─── C2b: HTTP smoke test with no assertion on response body ─────────────────
//
// BAD: only checks that the request did not reject with a network error.
// Does not verify status code, response body, or headers.
// Passes even if the server returns 500 with an error payload.

test('GET /users returns data (BAD: smoke test, no assertions)', async () => {
  const res = await request(app).get('/users')
  // C2b — res exists (no network error) but nothing about it is checked
})

// CLEAN: assert the status code and at least one meaningful response property.
test('GET /users returns data (CLEAN)', async () => {
  const res = await request(app)
    .get('/users')
    .expect(200)
    .expect('content-type', /json/)

  assert.ok(Array.isArray(res.body), 'body should be an array')
  assert.ok(res.body.length > 0, 'response should contain at least one user')
})


// ─── Stub definitions (not imported — inline for clarity) ────────────────────

const ctx = {
  throw(status, message) {
    const err = new Error(message)
    err.status = status
    err.expose = true
    throw err
  }
}
