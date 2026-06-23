/**
 * Family A - The test never checks anything.
 * Codes: C2, C2b, C20, C21, CC, JS1, JS2, JS4, JS5, JS6, JS7, JS9,
 *        JS11, JS13, JS17, JS18, JS21, JS22
 *
 * The assertion is missing, swallowed, skipped, or scheduled to fire after
 * the runner has already marked the test done. The test is green regardless
 * of whether the code is correct.
 *
 * TypeScript, Jest/Vitest idioms (plus Mocha + Testing Library where natural).
 * The symbols referenced here do not need to exist - the examples illustrate
 * shape, they never run.
 */

import { describe, it, test, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createUser, process, compute, fetchUser, sendNotification } from './mymodule';

// ─── C2: empty test body ──────────────────────────────────────────────────────

// BAD: nothing inside the body, only proves the runner collected it
it('BAD c2 empty body', () => {
  // C2 - no statement at all, always green
});

// BAD: comment-only body
it('BAD c2 comment only', () => {
  // arrange the user
  // C2 - still no executable check
});

// CLEAN: an assertion runs
it('CLEAN c2', () => {
  expect(compute()).toBe(42);
});


// ─── C2b: calls the unit but never asserts ────────────────────────────────────

// BAD: invokes the SUT, discards the result
it('BAD c2b discards result', () => {
  process(data); // C2b - return value never asserted
});

// BAD: arrange-only, the side effect is never checked
it('BAD c2b setup only', () => {
  const user = createUser('Alice');
  db.save(user); // C2b - nothing verifies what was saved
});

// CLEAN: the result is asserted
it('CLEAN c2b', () => {
  expect(process(data)).toEqual({ ok: true });
});

// CLEAN (not C2b): supertest .expect() is a real assertion at the API layer
it('CLEAN c2b supertest', async () => {
  await request(app).get('/health').expect(200);
});


// ─── C20: assertion in dead code after return/throw ──────────────────────────

// BAD: the early return strands the assertion below it
it('BAD c20 after return', () => {
  if (!flag) return;
  return; // unconditional return
  expect(compute()).toBe(42); // C20 - unreachable
});

// BAD: assertion after a throw never executes
it('BAD c20 after throw', () => {
  throw new Error('TODO');
  expect(compute()).toBe(42); // C20 - dead code
});

// CLEAN: the assertion is on the live path
it('CLEAN c20', () => {
  if (!flag) return;
  expect(compute()).toBe(42);
});


// ─── C21: every assertion is conditional, none runs unconditionally ──────────

// BAD: both branches can be skipped, so zero assertions may run
it('BAD c21 all conditional', () => {
  const result = fetchSync();
  if (result) {
    expect(result.status).toBe('ok'); // C21 - skipped when result is falsy
  } else if (result === null) {
    expect(result).toBeNull(); // also conditional
  }
});

// CLEAN: an unconditional check runs first
it('CLEAN c21', () => {
  const result = fetchSync();
  expect(result).not.toBeNull();
  expect(result.status).toBe('ok');
});


// ─── CC: commented-out assertion ──────────────────────────────────────────────

// BAD: the only check is commented out
it('BAD cc commented assertion', () => {
  const result = compute();
  // expect(result).toBe(42); // CC - check disabled, test always green
  log(result);
});

// CLEAN: the assertion is live
it('CLEAN cc', () => {
  expect(compute()).toBe(42);
});


// ─── JS1: focused test (it.only / fit) skips the rest of the suite ───────────

describe('order totals (JS1 - focused test)', () => {
  // BAD: it.only silences every sibling test in this file. Those tests stop
  // running in CI but stay green, so a regression they would catch goes unseen.
  it.only('BAD js1 focused', () => {
    expect(total(order)).toBe(27); // JS1 - the only test that runs
  });

  it('this test is skipped while it.only is present', () => {
    expect(subtotal(order)).toBe(30);
  });
});

// CLEAN: no focus modifier, the whole suite runs
describe('order totals (CLEAN)', () => {
  it('CLEAN js1', () => {
    expect(total(order)).toBe(27);
  });
  it('CLEAN js1 sibling runs too', () => {
    expect(subtotal(order)).toBe(30);
  });
});


// ─── JS2: expect(x) with no matcher ───────────────────────────────────────────

// BAD: expect() with no matcher evaluates the argument and stops
it('BAD js2 no matcher', () => {
  const result = compute();
  expect(result); // JS2 - no matcher, nothing is checked
});

// CLEAN: a matcher is attached
it('CLEAN js2', () => {
  expect(compute()).toBe(42);
});


// ─── JS4: skipped test (it.skip / xit / it.todo) ──────────────────────────────

// BAD: skipped and never revisited
it.skip('BAD js4 skip', () => {
  expect(compute()).toBe(42); // JS4 - excluded from the run
});

// BAD: xit is the same skip in Jasmine/Jest dialect
xit('BAD js4 xit', () => {
  expect(compute()).toBe(42); // JS4
});

// BAD: it.todo declares an intent with no body and never fails
it.todo('BAD js4 todo - implement discount rounding'); // JS4

// CLEAN: an active test
it('CLEAN js4', () => {
  expect(compute()).toBe(42);
});


// ─── JS5: async query/event not awaited (findBy* / waitFor / user-event) ─────

// BAD: findBy* returns a Promise. Without await the test ends before the
// element resolves, and the assertion that follows never sees it.
it('BAD js5 findBy not awaited', () => {
  render(<Profile id={1} />);
  const name = screen.findByTestId('name'); // JS5 - Promise, not the element
  expect(name).toBeTruthy(); // always truthy: a pending Promise is truthy
});

// BAD: waitFor not awaited, its callback assertion floats
it('BAD js5 waitFor not awaited', () => {
  render(<Profile id={1} />);
  waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Alice')); // JS5
});

// BAD: user-event returns a Promise that is dropped
it('BAD js5 user-event not awaited', () => {
  render(<LoginForm />);
  userEvent.click(screen.getByRole('button')); // JS5 - click Promise dropped
  expect(screen.getByText('Welcome')).toBeInTheDocument();
});

// CLEAN: await the async query and the event
it('CLEAN js5', async () => {
  render(<Profile id={1} />);
  const name = await screen.findByTestId('name');
  expect(name).toHaveTextContent('Alice');
});


// ─── JS6: empty describe / suite ──────────────────────────────────────────────

// BAD: a describe with no test inside reports zero failures and looks healthy
describe('PaymentProcessor (JS6 - empty suite)', () => {
  // JS6 - no it()/test() inside, the suite verifies nothing
});

// CLEAN: the suite holds at least one real test
describe('PaymentProcessor (CLEAN)', () => {
  it('charges the card', () => {
    expect(charge(100)).toEqual({ status: 'ok' });
  });
});


// ─── JS7: assertion in a non-awaited setTimeout / then callback ──────────────

// BAD: the assertion inside setTimeout fires after the test has finished
it('BAD js7 setTimeout', () => {
  setTimeout(() => {
    expect(compute()).toBe(42); // JS7 - runs after the runner moved on
  }, 0);
});

// BAD: assertion inside a then() callback that is never awaited or returned
it('BAD js7 then not awaited', () => {
  fetchUser(1).then((user) => {
    expect(user.name).toBe('Alice'); // JS7 - settles after the test ends
  });
});

// CLEAN: await the promise, then assert
it('CLEAN js7', async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe('Alice');
});


// ─── JS9: assertion in a dead literal branch (if(false)) ─────────────────────

// BAD: a literal-false guard makes the assertion unreachable
it('BAD js9 if false', () => {
  if (false) {
    expect(compute()).toBe(42); // JS9 - branch never taken
  }
});

// BAD: while(false) is the same dead branch
it('BAD js9 while false', () => {
  while (false) {
    expect(compute()).toBe(42); // JS9
  }
});

// CLEAN: the branch can actually fire, and a check runs regardless
it('CLEAN js9', () => {
  const result = compute();
  if (result > 0) {
    expect(result).toBe(42);
  }
  expect(result).toBeGreaterThan(0); // unconditional anchor
});


// ─── JS11: try/catch swallows the assertion ───────────────────────────────────

// BAD: when expect() throws, the catch absorbs it and the test stays green
it('BAD js11 swallowed assertion', () => {
  try {
    expect(compute()).toBe(42); // JS11 - failure caught below, never reported
  } catch (e) {
    console.log(e);
  }
});

// BAD: empty catch is even quieter
it('BAD js11 empty catch', () => {
  try {
    expect(fetchSync()).not.toBeNull(); // JS11
  } catch {
    // swallowed
  }
});

// CLEAN: catch a specific non-assertion error, assert outside the try
it('CLEAN js11', () => {
  let result = null;
  try {
    result = riskyParse();
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
  }
  expect(result).not.toBeNull();
});


// ─── JS13: getBy* / queryBy* query as a loose statement, never asserted ──────

// BAD: getByText runs as a bare statement. It throws if absent, but the
// intended check on the element is never written.
it('BAD js13 query not asserted', () => {
  render(<Banner />);
  screen.getByText('Welcome'); // JS13 - the query result is discarded
});

// BAD: queryBy* never throws, so this proves nothing at all
it('BAD js13 queryBy discarded', () => {
  render(<Banner />);
  screen.queryByRole('alert'); // JS13 - returns null silently, no assertion
});

// CLEAN: assert on the query result
it('CLEAN js13', () => {
  render(<Banner />);
  expect(screen.getByText('Welcome')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});


// ─── JS17: commented-out test block ───────────────────────────────────────────

// BAD: the whole test is commented out, so it is not even collected
// it('BAD js17 commented test', () => {     // JS17 - test disabled wholesale
//   expect(compute()).toBe(42);
// });

// CLEAN: the test is live
it('CLEAN js17', () => {
  expect(compute()).toBe(42);
});


// ─── JS18: done callback instead of async/await ──────────────────────────────

// BAD: done() in a finally fires even when expect() throws, so the failure is
// swallowed and the test passes.
it('BAD js18 done in finally', (done) => {
  fetchUser(1).then((user) => {
    try {
      expect(user.name).toBe('Alice'); // JS18 - if this throws, done() still runs
    } finally {
      done();
    }
  });
});

// BAD: done() called before the assertion, the runner already closed the test
it('BAD js18 done before assert', (done) => {
  loadAsync((data) => {
    done(); // JS18 - test marked complete here
    expect(data.status).toBe('ok'); // throw is ignored
  });
});

// CLEAN: drop done(), use async/await so a throw fails the test
it('CLEAN js18', async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe('Alice');
});


// ─── JS21: matcher referenced but never called (no parentheses) ──────────────

// BAD: toBe is read as a property, never invoked, so no comparison happens
it('BAD js21 matcher not called', () => {
  expect(compute()).toBe; // JS21 - missing (42), nothing is compared
});

// BAD: spy matcher accessed without parentheses
it('BAD js21 spy matcher not called', () => {
  const spy = vi.fn();
  sendNotification('a@b.com');
  expect(spy).toHaveBeenCalled; // JS21 - property access, no ()
});

// CLEAN: the matcher is invoked
it('CLEAN js21', () => {
  expect(compute()).toBe(42);
});


// ─── JS22: empty it.each / test.each table ───────────────────────────────────

// BAD: an empty table generates zero cases, so the body never runs
it.each([])('BAD js22 empty table %s', (value) => {
  expect(process(value)).toBeGreaterThan(0); // JS22 - executes zero times
});

// BAD: test.each with an empty array, same vacuous result
test.each([])('BAD js22 empty test.each %s', (value) => {
  expect(process(value)).toBeGreaterThan(0); // JS22
});

// CLEAN: the table has real cases
it.each([1, 2, 3])('CLEAN js22 %s', (value) => {
  expect(process(value)).toBeGreaterThan(0);
});


// ─── Placeholder stubs (declared so the file reads as TypeScript) ────────────

declare const flag: boolean;
declare const data: unknown;
declare const order: unknown;
declare const db: { save(u: unknown): void };
declare const app: unknown;
declare function request(app: unknown): { get(p: string): { expect(n: number): Promise<void> } };
declare function fetchSync(): { status: string } | null;
declare function total(o: unknown): number;
declare function subtotal(o: unknown): number;
declare function charge(n: number): { status: string };
declare function log(x: unknown): void;
declare function riskyParse(): unknown;
declare function loadAsync(cb: (data: { status: string }) => void): void;
declare function Profile(props: { id: number }): JSX.Element;
declare function LoginForm(): JSX.Element;
declare function Banner(): JSX.Element;
